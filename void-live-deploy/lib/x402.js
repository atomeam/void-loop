// x402: Verse charges agents per call in USDC on Base, into Verse's own wallet (lib/verse-wallet.js). Owner, 2026-11-06: "the point is
// for it to find the money not me, agents can have wallets now". The open standard (https://docs.x402.org, spec v1 and v2 in
// github.com/coinbase/x402/specs): a call without payment gets 402 with what to pay; the agent signs an EIP-3009 USDC authorization
// to Verse's address and retries with it in a header; Verse asks a facilitator to /verify it, does the work, asks it to /settle (the
// facilitator broadcasts the transfer and pays the gas), and answers with the settlement in a header. Verse never signs, sends or holds
// a key: the payer signs, the facilitator settles, the money lands at Verse's address.
//
// Facilitator: PayAI's public one by default (https://facilitator.payai.network; "exact" on Base mainnet without an API key, 1,000
// free settlements: docs.payai.network/x402/facilitators/introduction), or any other set in X402_FACILITATOR_URL.
// Both protocol versions are served: v1 (X-PAYMENT / X-PAYMENT-RESPONSE, network "base", maxAmountRequired) and v2 (PAYMENT-REQUIRED /
// PAYMENT-SIGNATURE / PAYMENT-RESPONSE, CAIP-2 network "eip155:8453", amount).
export const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // Circle's native USDC on Base, 6 decimals
export const USDC_DOMAIN = { name: 'USD Coin', version: '2' }; // USDC's EIP-712 domain on Base mainnet (EIP-3009 signatures)
export const NET = { v1: 'base', v2: 'eip155:8453' };
export const DEFAULT_FACILITATOR = 'https://facilitator.payai.network';
export const TIMEOUT_S = 120;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

// What Verse sells per call. units: USDC's 6-decimal atomic units (50000 = $0.05).
export const SERVICES = {
  review: {
    path: '/api/x402/review', method: 'POST', units: 50000,
    description: 'Verse code review, closer read: the instant checks plus an AI reviewer that confirms real findings, drops wrong ones and adds what patterns miss. One call, one review.',
    input: { code: { type: 'string', description: 'source code to review (or send diff)', required: false }, diff: { type: 'string', description: 'a unified diff; only added lines are reviewed', required: false }, lang: { type: 'string', description: 'language, optional', required: false }, ask: { type: 'string', description: 'what to look for, optional', required: false } },
    output: { findings: 'array of { line, rule, message, severity }', answer: 'the closer read, text', review: '"model"' },
    tags: ['code-review', 'security', 'developer-tools'],
  },
};

export const facilitatorOf = (env = {}) => {
  const u = String(env.X402_FACILITATOR_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(u) ? u : DEFAULT_FACILITATOR;
};
export const usdcText = (units) => { const s = String(BigInt(units)).padStart(7, '0'); return s.slice(0, -6) + '.' + s.slice(-6); };
export const centsOf = (units) => Number(BigInt(units) / 10000n); // whole cents received (a micro-remainder is never rounded up)

const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const unb64 = (s) => JSON.parse(decodeURIComponent(escape(atob(String(s).trim()))));

/** The payment requirements for a service, paying `payTo`, in both protocol shapes. Pure. */
export function requirements(name, payTo, origin) {
  const s = SERVICES[name];
  if (!s || !ADDR_RE.test(String(payTo || ''))) return null;
  const to = String(payTo), resource = origin + s.path, mimeType = 'application/json';
  const v1 = { scheme: 'exact', network: NET.v1, maxAmountRequired: String(s.units), resource, description: s.description, mimeType, payTo: to,
    maxTimeoutSeconds: TIMEOUT_S, asset: USDC_BASE, extra: { ...USDC_DOMAIN },
    outputSchema: { input: { type: 'http', method: s.method, bodyType: 'json', bodyFields: s.input, discoverable: true }, output: s.output } };
  const v2 = { scheme: 'exact', network: NET.v2, amount: String(s.units), asset: USDC_BASE, payTo: to, maxTimeoutSeconds: TIMEOUT_S, extra: { ...USDC_DOMAIN } };
  const resourceInfo = { url: resource, description: s.description, mimeType, serviceName: 'Verse', tags: s.tags };
  return { v1, v2, resourceInfo, units: s.units };
}

/** The 402 answer: the v1 body (what most clients read today) and the v2 PAYMENT-REQUIRED header. */
export function paymentRequired(req, error = 'payment required') {
  const v2 = { x402Version: 2, error, resource: req.resourceInfo, accepts: [req.v2], extensions: { bazaar: { info: { input: req.v1.outputSchema.input, output: req.v1.outputSchema.output } } } };
  return new Response(JSON.stringify({ x402Version: 1, error, accepts: [req.v1] }), { status: 402,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'payment-required': b64(v2) } });
}

/** The payment the client sent, if any: { version, payload, requirements } or { bad } (unreadable, wrong scheme, network, payee, amount). Pure. */
export function readPayment(request, req) {
  const h2 = request.headers.get('payment-signature'), h1 = request.headers.get('x-payment');
  if (!h1 && !h2) return null;
  let p; try { p = unb64(h2 || h1); } catch (_) { return { bad: 'the payment header is not base64 JSON' }; }
  const version = h2 ? 2 : Number(p && p.x402Version) === 2 ? 2 : 1;
  const want = version === 2 ? req.v2 : req.v1;
  const chosen = version === 2 ? (p.accepted || {}) : p;
  const auth = p && p.payload && p.payload.authorization;
  if (!p || chosen.scheme !== 'exact' || chosen.network !== want.network) return { bad: 'Verse takes the exact scheme on Base (' + want.network + ')' };
  if (!auth || String(auth.to || '').toLowerCase() !== want.payTo.toLowerCase()) return { bad: 'the authorization does not pay Verse\'s address' };
  let value; try { value = BigInt(auth.value); } catch (_) { return { bad: 'the authorization has no amount' }; }
  if (value < BigInt(req.units)) return { bad: 'the authorization is for less than ' + usdcText(req.units) + ' USDC' };
  if (version === 2 && chosen.asset && String(chosen.asset).toLowerCase() !== USDC_BASE) return { bad: 'Verse takes USDC on Base only' };
  return { version, payload: p, requirements: want };
}

async function ask(env, path, pay, fetchImpl) {
  const r = await (fetchImpl || fetch)(facilitatorOf(env) + path, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ x402Version: pay.version, paymentPayload: pay.payload, paymentRequirements: pay.requirements }) });
  let j = null; try { j = await r.json(); } catch (_) {}
  if (!j) throw new Error('facilitator answered ' + r.status + ' with no JSON');
  return j;
}
/** -> { ok, reason?, payer? } */
export async function verify(env, pay, fetchImpl) {
  const j = await ask(env, '/verify', pay, fetchImpl);
  return j.isValid === true ? { ok: true, payer: j.payer || null } : { ok: false, reason: String(j.invalidReason || j.error || 'not valid') };
}
/** -> { ok, transaction, network, payer?, reason? } */
export async function settle(env, pay, fetchImpl) {
  const j = await ask(env, '/settle', pay, fetchImpl);
  const tx = String(j.transaction || '');
  return j.success === true && /^0x[0-9a-fA-F]{64}$/.test(tx) ? { ok: true, transaction: tx, network: String(j.network || pay.requirements.network), payer: j.payer || null }
    : { ok: false, reason: String(j.errorReason || j.error || 'not settled'), transaction: tx };
}
/** The settlement header for the answer (X-PAYMENT-RESPONSE for v1, PAYMENT-RESPONSE for v2). Pure. */
export const settlementHeader = (version, s) => [version === 2 ? 'payment-response' : 'x-payment-response', b64({ success: !!s.ok, transaction: s.transaction || '', network: s.network || (version === 2 ? NET.v2 : NET.v1), payer: s.payer || '' })];
