// x402-pay — the paying side of one x402 call (https://docs.x402.org), for Verse's code review GitHub Action (review/action.yml,
// input x402-wallet-key): POST once, read the 402's terms, sign an EIP-3009 USDC TransferWithAuthorization for exactly the amount asked
// (never more than maxUnits), POST again with the payment header, and hand back the answer and its settlement.
// The key is the action user's own, from their repository's secrets, on their own runner: it signs here and goes nowhere else (the
// signature does; the facilitator broadcasts it and pays the gas). Verse never sees or holds it. Base mainnet USDC only.
//   import { payAndPost } from './x402-pay.mjs'
//   await payAndPost(url, body, { privateKey, maxUnits: 50000n })  -> { status, json, settlement, paid, units, payTo, why? }
// viem (pinned in the action's own install, never a repo dependency) signs; a test hands in its own `account`.
export const BASE_NET = { v1: 'base', v2: 'eip155:8453' };
export const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const ADDR = /^0x[0-9a-fA-F]{40}$/;
export const TYPES = { TransferWithAuthorization: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }] };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const unb64 = (s) => { try { return s ? JSON.parse(Buffer.from(String(s), 'base64').toString()) : null; } catch (_) { return null; } };

/** The one requirement this payer takes from a 402 (v2 header first, else the v1 body): exact scheme, USDC on Base, an address to pay,
 *  at most maxUnits. -> { version, accepted, units, resource } or { why }. Pure. */
export function pick(headers, body, maxUnits) {
  const v2 = unb64(headers.get('payment-required'));
  const list = v2 && Array.isArray(v2.accepts) ? v2.accepts.map((a) => ({ version: 2, a, units: a.amount, net: BASE_NET.v2 }))
    : body && Array.isArray(body.accepts) ? body.accepts.map((a) => ({ version: 1, a, units: a.maxAmountRequired, net: BASE_NET.v1 })) : [];
  if (!list.length) return { why: 'the 402 named no payment terms' };
  const fits = list.filter(({ a, net }) => a && a.scheme === 'exact' && a.network === net && String(a.asset || '').toLowerCase() === USDC_BASE && ADDR.test(String(a.payTo || '')));
  if (!fits.length) return { why: 'no terms in USDC on Base' };
  let ok; try { ok = fits.filter((f) => /^\d+$/.test(String(f.units)) && BigInt(f.units) > 0n && BigInt(f.units) <= BigInt(maxUnits)); } catch (_) { ok = []; }
  if (!ok.length) return { why: 'the price is over the limit of ' + String(maxUnits) + ' units (' + Number(maxUnits) / 1e6 + ' USDC)' };
  const f = ok[0];
  return { version: f.version, accepted: f.a, units: BigInt(f.units), resource: v2 && v2.resource };
}

/** The signed payment header for the chosen terms. -> [headerName, value] */
export async function paymentHeader(choice, account, now = Math.floor(Date.now() / 1000)) {
  // addresses go in lower case: viem refuses a mixed case that is not the address's checksum, and the payee compares in lower case
  const a = choice.accepted, nonce = '0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const authorization = { from: account.address, to: String(a.payTo).toLowerCase(), value: String(choice.units), validAfter: String(now - 60), validBefore: String(now + Math.max(30, Number(a.maxTimeoutSeconds) || 120)), nonce };
  const extra = a.extra || {};
  const signature = await account.signTypedData({ domain: { name: extra.name || 'USD Coin', version: extra.version || '2', chainId: 8453, verifyingContract: String(a.asset).toLowerCase() },
    types: TYPES, primaryType: 'TransferWithAuthorization',
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) } });
  const payload = { signature, authorization };
  return choice.version === 2 ? ['payment-signature', b64({ x402Version: 2, ...(choice.resource ? { resource: choice.resource } : {}), accepted: a, payload })]
    : ['x-payment', b64({ x402Version: 1, scheme: 'exact', network: BASE_NET.v1, payload })];
}

export async function payAndPost(url, body, { privateKey, account, maxUnits = 50000n, fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  if (!account) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(privateKey || '').trim())) return { status: 0, paid: false, why: 'the wallet key is not a 0x-prefixed 32-byte hex key' };
    const { privateKeyToAccount } = await import('viem/accounts');
    account = privateKeyToAccount(String(privateKey).trim());
  }
  const post = (headers = {}) => fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const first = await post();
  const firstJson = await first.json().catch(() => null);
  if (first.status !== 402) return { status: first.status, json: firstJson, paid: false, why: first.ok ? '' : 'the service answered ' + first.status + ' before any payment' };
  const choice = pick(first.headers, firstJson, maxUnits);
  if (choice.why) return { status: 402, json: firstJson, paid: false, why: choice.why };
  const [h, v] = await paymentHeader(choice, account);
  const res = await post({ [h]: v });
  const json = await res.json().catch(() => null);
  const settlement = unb64(res.headers.get('payment-response') || res.headers.get('x-payment-response'));
  return { status: res.status, json, settlement, paid: !!(settlement && settlement.success), units: choice.units, payTo: choice.accepted.payTo,
    why: settlement && settlement.success ? '' : String((json && (json.error || json.note)) || 'not settled, so nothing was paid').slice(0, 200) };
}
