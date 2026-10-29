// Special items: Cash App and crypto as extra rails beside Gumroad/Stripe (docs/payments.md, owner 2026-10-15).
// Both are MANUAL-FULFILLMENT rails: the buyer starts an order (server sets the exact amount), pays, then gives a reference.
// The order waits as 'awaiting' and unlocks only on proof the server checks itself, never on the buyer's claim:
//   cashapp    no public verification API: the order joins the owner's queue; only ownerOk (lib/guard.js) approves it.
//   usdc-base  read-only on-chain check of the tx: a USDC Transfer on Base to our address for the exact order amount
//              (the amount's last 4 decimals are the order's memo), >= CONFIRMATIONS deep, each tx used once.
// Verse never sends, signs or holds crypto; it only reads public chain data. No address or cashtag lives in the repo:
//   CASHAPP_CASHTAG       Adam's public $cashtag (Pages variable)          -> enables 'cashapp'
//   CRYPTO_USDC_BASE_ADDR Adam's own receive-only 0x address (Pages var.)  -> enables 'usdc-base'
//   BASE_RPC_URL          optional, defaults to the public https://mainnet.base.org
// A product opts in with "special": ["cashapp", "usdc-base"] in domains/store.products.json; price is always p.cents.
export const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // Circle's native USDC on Base, 6 decimals
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const CONFIRMATIONS = 5;
export const AWAIT_DAYS = 3;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/, TAG_RE = /^\$?[A-Za-z][A-Za-z0-9_]{0,19}$/, TX_RE = /^0x[0-9a-fA-F]{64}$/;

export function railsOf(env = {}) {
  const r = {};
  if (TAG_RE.test(String(env.CASHAPP_CASHTAG || ''))) r.cashapp = { tag: '$' + String(env.CASHAPP_CASHTAG).replace(/^\$/, '') };
  if (ADDR_RE.test(String(env.CRYPTO_USDC_BASE_ADDR || ''))) r['usdc-base'] = { address: String(env.CRYPTO_USDC_BASE_ADDR).toLowerCase() };
  return r;
}
// which rails a product can use right now: opted in, fixed price > 0, not unpublished, rail configured
export function specialRails(p, env = {}) {
  if (!p || !(p.cents > 0) || p.every || p.status === 'unpublished' || !Array.isArray(p.special)) return [];
  const on = railsOf(env); return p.special.filter((k) => on[k]);
}
// the order's memo: 1..9999 millionths of a dollar, from the order id, so the exact amount names the order
export function memoUnits(orderId) { let h = 2166136261; for (const c of String(orderId)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return 1 + (h % 9999); }
export const usdcUnits = (cents, orderId) => BigInt(cents) * 10000n + BigInt(memoUnits(orderId));
export const usdcText = (u) => { const s = u.toString().padStart(7, '0'); return s.slice(0, -6) + '.' + s.slice(-6); };

export function instructions(rail, p, order, env) {
  const R = railsOf(env)[rail], code = String(order.id).slice(-8).toUpperCase();
  if (rail === 'cashapp') return { rail, pay: '$' + (p.cents / 100).toFixed(2), to: R.tag, link: 'https://cash.app/' + R.tag + '/' + (p.cents / 100).toFixed(2), note: 'Verse ' + code,
    then: 'Put "Verse ' + code + '" in the Cash App note, then send your Cash App payment reference (from the receipt) with your order code. The owner confirms it by hand; your downloads unlock then.' };
  return { rail, pay: usdcText(usdcUnits(p.cents, order.id)) + ' USDC', exact_units: usdcUnits(p.cents, order.id).toString(), network: 'Base (chain 8453)', token: USDC_BASE, to: R.address,
    then: 'Send exactly this amount of USDC on Base (the last digits identify your order), then send the transaction hash with your order code. It unlocks after ' + CONFIRMATIONS + ' confirmations. Any other token, network or amount is not matched.' };
}

async function rpc(env, method, params, fetchImpl) {
  const r = await (fetchImpl || fetch)(env.BASE_RPC_URL || 'https://mainnet.base.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json().catch(() => ({})); if (j.error) throw new Error('rpc'); return j.result;
}
// read-only: is tx a confirmed USDC-on-Base transfer of exactly `units` to `to`? -> { ok, reason }
export async function verifyUsdcTx(env, tx, to, units, fetchImpl) {
  if (!TX_RE.test(String(tx || ''))) return { ok: false, reason: 'not a transaction hash' };
  let rc, head; try { [rc, head] = await Promise.all([rpc(env, 'eth_getTransactionReceipt', [tx], fetchImpl), rpc(env, 'eth_blockNumber', [], fetchImpl)]); } catch (_) { return { ok: false, retry: true, reason: 'chain not reachable, try again' }; }
  if (!rc) return { ok: false, retry: true, reason: 'not on chain yet' };
  if (rc.status !== '0x1') return { ok: false, reason: 'that transaction failed on chain' };
  if (Number(BigInt(head) - BigInt(rc.blockNumber)) < CONFIRMATIONS) return { ok: false, retry: true, reason: 'waiting for confirmations' };
  const pad = '0x' + to.slice(2).toLowerCase().padStart(64, '0');
  const hit = (rc.logs || []).find((l) => String(l.address).toLowerCase() === USDC_BASE && l.topics && l.topics[0] === TRANSFER_TOPIC && String(l.topics[2]).toLowerCase() === pad);
  if (!hit) return { ok: false, reason: 'no USDC (Base) transfer to the store address in that transaction' };
  if (BigInt(hit.data) !== BigInt(units)) return { ok: false, reason: 'amount does not match this order exactly' };
  return { ok: true };
}
