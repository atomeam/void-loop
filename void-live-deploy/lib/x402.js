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
    example: { input: { code: 'function f(x) {\n  if (x = 5) { return eval(x); }\n}' }, output: { tier: 'x402', review: 'model', findings: [{ line: 2, rule: 'assign-in-condition', message: '= in a condition', severity: 'high' }], answer: 'Line 2 assigns instead of comparing; use ===.' } },
  },
  // The services below are the same free routes the site's pages use (functions/api/<route>.js), run unchanged for the caller after the
  // payment verifies. The free pages stay free; a paid call is the same answer for an agent that pays per call, with no account or key.
  answer: {
    path: '/api/x402/answer', method: 'POST', units: 50000, route: 'answer',
    description: 'Verse answers a question: a direct answer from Verse\'s model, with the Wikipedia source linked when one matches. One call, one answer.',
    input: { ask: { type: 'string', description: 'the question, 3 to 600 characters', required: true } },
    output: { answer: 'the answer, text', sources: 'array of { title, url }' },
    tags: ['question-answering', 'search', 'knowledge'],
    example: { input: { ask: 'what is a black hole' }, output: { answer: 'A black hole is a region of space where gravity is so strong that nothing, not even light, escapes.', sources: [{ title: 'Black hole', url: 'https://en.wikipedia.org/wiki/Black_hole' }] } },
  },
  fix: {
    path: '/api/x402/fix', method: 'POST', units: 50000, route: 'answer', mode: 'fix',
    description: 'Verse fixes a broken automation: paste the error (Zapier, Make, n8n, Power Automate, GitHub Actions or code) and get what it means and the steps to fix it. One call, one fix.',
    input: { ask: { type: 'string', description: 'what broke, 3 to 600 characters', required: true }, details: { type: 'string', description: 'the error message or log, optional', required: false } },
    output: { answer: 'what it means and the steps to fix it, text' },
    tags: ['automation', 'debugging', 'developer-tools'],
    example: { input: { ask: 'my Zap fails with 401 Unauthorized', details: 'Error: 401 Unauthorized from Google Sheets' }, output: { answer: 'A 401 means the connected Google account is no longer authorized. Reconnect it in the Zap\'s app step and test the step again.' } },
  },
  translate: {
    path: '/api/x402/translate', method: 'POST', units: 50000, route: 'translate',
    description: 'Verse translates text between 100 languages (Meta\'s many-to-many model on Workers AI, MyMemory as the fallback). One call, one translation of up to the route\'s character limit.',
    input: { text: { type: 'string', description: 'the text to translate', required: true }, to: { type: 'string', description: 'target language code, like es', required: true }, from: { type: 'string', description: 'source language code, or auto', required: false } },
    output: { text: 'the translation', from: 'source language', to: 'target language', via: 'which translator answered' },
    tags: ['translation', 'language', 'nlp'],
    example: { input: { text: 'Good morning', to: 'es' }, output: { text: 'Buenos días', from: 'en', to: 'es', via: 'verse' } },
  },
  digest: {
    path: '/api/x402/digest', method: 'POST', units: 50000, route: 'digest',
    description: 'Verse digests a transcript or a PeerTube or Internet Archive video\'s open captions: the key points, answers to an optional question from the words themselves, and a short summary. One call, one digest.',
    input: { text: { type: 'string', description: 'a transcript, at least a few sentences (or send url)', required: false }, url: { type: 'string', description: 'a PeerTube or Internet Archive video link', required: false }, ask: { type: 'string', description: 'a question about it, optional', required: false } },
    output: { points: 'array of key lines', answer: 'array of lines that answer ask', summary: 'short summary, when the model is on' },
    tags: ['summarization', 'video', 'nlp'],
    example: { input: { text: 'In this lesson we cover three ways to store energy ...', ask: 'what are the three ways?' }, output: { ok: true, points: ['three ways to store energy'], answer: ['batteries, pumped water and flywheels'], summary: 'The lesson compares three ways to store energy.' } },
  },
  appraise: {
    path: '/api/x402/appraise', method: 'POST', units: 50000, route: 'appraise',
    description: 'Verse values an item from a photo: the vision model describes it and Verse gives an estimated value range with what it saw. People are never priced. One call, one appraisal.',
    input: { image: { type: 'string', description: 'a PNG, JPEG or WebP data URL, under 800 KB', required: true }, note: { type: 'string', description: 'what the item is, optional', required: false } },
    output: { seen: 'what the photo shows', value: '{ kind, cents, text }', text: 'the appraisal, text' },
    tags: ['vision', 'appraisal', 'pricing'],
    example: { input: { image: 'data:image/jpeg;base64,...', note: 'old pocket watch' }, output: { seen: 'a gold-colored pocket watch with a chain', value: { kind: 'watch', cents: 15000, text: 'about $150' }, text: 'About $150 as seen.' } },
  },
  image: {
    path: '/api/x402/image', method: 'POST', units: 50000, route: 'image',
    description: 'Verse paints one picture from a text prompt (up to 400 characters), safe for work. One call, one picture.',
    input: { prompt: { type: 'string', description: 'what to paint, up to 400 characters', required: true }, negative: { type: 'string', description: 'what to leave out, optional', required: false }, style: { type: 'string', description: 'a style from the page\'s list, optional', required: false }, shape: { type: 'string', description: 'square, portrait, landscape or wide, optional', required: false }, seed: { type: 'number', description: 'a whole-number seed, optional', required: false } },
    output: { state: '"art"', img: 'the picture, as a data URL or address', seed: 'the seed used' },
    tags: ['image-generation', 'art', 'text-to-image'],
    example: { input: { prompt: 'a lighthouse at dusk, watercolor' }, output: { state: 'art', img: 'data:image/jpeg;base64,...', seed: 42 } },
  },
  backtest: {
    path: '/api/x402/backtest', method: 'POST', units: 50000,
    description: 'Backtest a Verse trading bot (trend-50-200, breakout-20-10, dip-rsi2) on real BTC-USD or ETH-USD daily candles: your parameters, fee, slippage and dates; every trade, the equity curve, max drawdown, buy-and-hold beside it and a walk-forward out-of-sample test. Read only: nothing is traded.',
    input: { bot: { type: 'string', description: 'trend-50-200 | breakout-20-10 | dip-rsi2', required: true }, pair: { type: 'string', description: 'BTC-USD or ETH-USD', required: false }, params: { type: 'object', description: 'the bot\'s parameters, optional', required: false }, fee: { type: 'number', description: 'fee per trade as a fraction (0.008 = 0.8%)', required: false }, slippage: { type: 'number', description: 'slippage per trade as a fraction', required: false }, from: { type: 'string', description: 'YYYY-MM-DD, optional', required: false }, to: { type: 'string', description: 'YYYY-MM-DD, optional', required: false } },
    output: { stats: 'return, CAGR, max drawdown, trades, win rate, exposure', hold: 'buy and hold over the same days', trades: 'every trade', equity: 'daily equity', walkForward: 'yearly out-of-sample windows' },
    tags: ['trading', 'backtest', 'crypto', 'finance'],
    example: { input: { bot: 'trend-50-200', pair: 'BTC-USD', fee: 0.006, from: '2020-01-01' }, output: { bot: 'trend-50-200', pair: 'BTC-USD', stats: { totalReturn: 'fraction', maxDrawdown: 'fraction', trades: 'count' }, hold: { totalReturn: 'fraction', maxDrawdown: 'fraction' }, walkForward: { windows: 'one per year' } } },
  },
  arbitrage: {
    path: '/api/x402/arbitrage', method: 'POST', units: 50000,
    description: 'Scan BTC or ETH price gaps across Coinbase, Kraken, Bitstamp, Gemini and Uniswap v3 on Base, read now from their order books: for your size, every buy-here-sell-there pair with the net dollars after both taker fees, DEX gas and your transfer cost. Read only: nothing is traded.',
    input: { coin: { type: 'string', description: 'BTC or ETH', required: true }, size: { type: 'number', description: 'dollars per trade, 10 to 250000 (default 1000)', required: false }, fees: { type: 'object', description: 'your taker fee per venue as a fraction, optional', required: false }, transferUsd: { type: 'number', description: 'cost to move the coin between venues, dollars (default 0: you hold both sides)', required: false }, venues: { type: 'array', description: 'coinbase, kraken, bitstamp, gemini, uniswap; optional', required: false } },
    output: { rows: 'every venue pair, best first: buy, sell, average prices, top-of-book gap, fees, gas, net dollars and percent', spread: 'mid price per venue', missing: 'venues that did not answer' },
    tags: ['trading', 'arbitrage', 'crypto', 'market-data'],
    example: { input: { coin: 'ETH', size: 5000 }, output: { coin: 'ETH', size: 5000, rows: [{ buy: 'kraken', sell: 'uniswap', net: -41.2, netPct: -0.0082, filled: true }], missing: [] } },
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
  return { v1, v2, resourceInfo, units: s.units, bazaar: bazaarOf(s) };
}

/** The v2 discovery declaration (the "bazaar" extension, docs.x402.org/extensions/bazaar: info.input / info.output with examples, and a JSON
 *  schema of the body), so a facilitator that keeps a Bazaar can list the endpoint. Pure. */
export function bazaarOf(s) {
  const props = {}, required = [];
  for (const [k, f] of Object.entries(s.input)) { props[k] = { type: f.type, description: f.description }; if (f.required) required.push(k); }
  const ex = s.example || { input: {}, output: {} };
  return { info: { input: { type: 'http', method: s.method, bodyType: 'json', body: ex.input }, output: { type: 'json', example: ex.output } },
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { input: { type: 'object', properties: { type: { const: 'http' }, method: { const: s.method }, bodyType: { const: 'json' },
      body: { type: 'object', properties: props, ...(required.length ? { required } : {}) } }, required: ['type', 'method'] } }, required: ['input'] } };
}

/** The 402 answer: the v1 body (what most clients read today) and the v2 PAYMENT-REQUIRED header. */
export function paymentRequired(req, error = 'payment required') {
  const v2 = { x402Version: 2, error, resource: req.resourceInfo, accepts: [req.v2], extensions: { bazaar: req.bazaar } };
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
