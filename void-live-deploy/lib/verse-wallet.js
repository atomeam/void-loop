// Verse's own wallet: where agents' x402 payments (lib/x402.js) land, what it holds, and the USDC income the treasury counts.
// Owner, 2026-11-06: "agents can have wallets now ... see if you can build verse one".
//
// The address, in this order (each a receive-only public address; Verse's code never signs, sends or holds a key):
//   1. VERSE_WALLET_ADDR                 any 0x address set as a Pages variable (for example an address of a wallet Atom made for Verse)
//      or VERSE_WALLET in lib/verse-wallet-address.js, the same address kept in the repo (public, no Cloudflare step needed)
//   2. Verse's Coinbase CDP server wallet  made by Verse itself the first time it is needed, once CDP_API_KEY_ID, CDP_API_KEY_SECRET and
//                                        CDP_WALLET_SECRET are set: POST /platform/v2/evm/accounts named "verse-treasury". The key is
//                                        generated and kept in Coinbase's secure enclave (docs.cdp.coinbase.com/server-wallets/v2); Verse
//                                        keeps only the address, in D1. Only two CDP calls exist here (create, get by name): nothing signs.
//   3. CRYPTO_USDC_BASE_ADDR             the store's existing USDC address (lib/alt-pay.js), so payments can land before 1 or 2 exist
// Income the treasury counts (real state only): an x402 payment once its transfer is read back on chain (5 confirmations, the exact
// amount to the address it was asked for), plus store orders paid in USDC on Base (lib/alt-pay.js already proved those on chain).
import { verifyUsdcTx } from './alt-pay.js';
import { USDC_BASE, centsOf } from './x402.js';
import { VERSE_WALLET } from './verse-wallet-address.js';

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
export const ACCOUNT_NAME = 'verse-treasury';
export const CDP_HOST = 'api.cdp.coinbase.com';
const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_wallet (id TEXT PRIMARY KEY, at TEXT NOT NULL, address TEXT, source TEXT, data TEXT)',
  'CREATE TABLE IF NOT EXISTS void_x402 (tx TEXT PRIMARY KEY, at TEXT NOT NULL, service TEXT, units TEXT NOT NULL, network TEXT, pay_to TEXT NOT NULL, status TEXT NOT NULL, checked TEXT, why TEXT)',
];
const ready = new WeakMap();
export const ensureWallet = (env) => { let p = ready.get(env.DB); if (!p) { p = env.DB.batch(TABLES.map((t) => env.DB.prepare(t))).catch((e) => { ready.delete(env.DB); throw e; }); ready.set(env.DB, p); } return p; };

export const cdpReady = (env = {}) => !!(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET && env.CDP_WALLET_SECRET);

// ---- CDP authentication (docs.cdp.coinbase.com/api-reference/v2/authentication) ----
const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => Uint8Array.from(atob(String(s).replace(/\s+/g, '')), (c) => c.charCodeAt(0));
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const part = (o) => b64url(enc.encode(JSON.stringify(o)));
/** keys sorted at every level, compact JSON: what the wallet token's reqHash is taken over. Pure. */
export const sortedJson = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

/** The bearer JWT for one request: EdDSA with the API key (base64, 64 bytes: 32-byte seed + 32-byte public key). */
export async function bearerJwt(env, method, path, now = Math.floor(Date.now() / 1000)) {
  const raw = fromB64(env.CDP_API_KEY_SECRET);
  if (raw.length !== 64) throw new Error('CDP_API_KEY_SECRET must be an Ed25519 key (base64, 64 bytes)');
  const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', d: b64url(raw.slice(0, 32)), x: b64url(raw.slice(32)) }, { name: 'Ed25519' }, false, ['sign']);
  const uri = method + ' ' + CDP_HOST + path;
  const head = part({ alg: 'EdDSA', kid: env.CDP_API_KEY_ID, typ: 'JWT', nonce: rand(16) });
  const body = part({ sub: env.CDP_API_KEY_ID, iss: 'cdp', aud: ['cdp_service'], nbf: now, exp: now + 120, uris: [uri] });
  return head + '.' + body + '.' + b64url(await crypto.subtle.sign({ name: 'Ed25519' }, key, enc.encode(head + '.' + body)));
}
/** The wallet token (X-Wallet-Auth): ES256 with the Wallet Secret (base64 PKCS#8 DER P-256), reqHash over the sorted body. */
export async function walletJwt(env, method, path, bodyObj, now = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('pkcs8', fromB64(env.CDP_WALLET_SECRET), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const claims = { iat: now, nbf: now, jti: rand(16), uris: [method + ' ' + CDP_HOST + path] };
  if (bodyObj && Object.keys(bodyObj).length) claims.reqHash = hex(await crypto.subtle.digest('SHA-256', enc.encode(sortedJson(bodyObj))));
  const head = part({ alg: 'ES256', typ: 'JWT' }), body = part(claims);
  return head + '.' + body + '.' + b64url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
}

/** Verse makes (or finds) its own CDP account. -> { address } | throws. Only create and get-by-name: nothing here can move money. */
export async function cdpAccount(env, fetchImpl = fetch) {
  const path = '/platform/v2/evm/accounts', body = { name: ACCOUNT_NAME };
  const r = await fetchImpl('https://' + CDP_HOST + path, { method: 'POST', headers: { 'content-type': 'application/json',
    authorization: 'Bearer ' + await bearerJwt(env, 'POST', path), 'x-wallet-auth': await walletJwt(env, 'POST', path, body), 'x-idempotency-key': 'verse-treasury-account-v1' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) {}
  if (r.status === 409) { // made before: read it back by name
    const p2 = path + '/by-name/' + ACCOUNT_NAME;
    const g = await fetchImpl('https://' + CDP_HOST + p2, { headers: { authorization: 'Bearer ' + await bearerJwt(env, 'GET', p2) } });
    j = await g.json().catch(() => null);
    if (!g.ok) throw new Error('CDP get account answered ' + g.status);
  } else if (!r.ok) throw new Error('CDP create account answered ' + r.status + (j && j.errorType ? ' ' + j.errorType : ''));
  if (!j || !ADDR_RE.test(String(j.address || ''))) throw new Error('CDP gave no address');
  return { address: j.address };
}

/** Verse's receiving address right now. -> { address, source, note } | null. Makes the CDP account once when its keys are set. */
export async function walletOf(env, fetchImpl = fetch, repoAddr = VERSE_WALLET) {
  if (ADDR_RE.test(String(env.VERSE_WALLET_ADDR || ''))) return { address: String(env.VERSE_WALLET_ADDR), source: 'set', note: 'Verse\'s wallet address, set on the site' };
  if (ADDR_RE.test(String(repoAddr || ''))) return { address: String(repoAddr), source: 'set', note: 'Verse\'s wallet address, kept with the site' };
  if (env.DB) {
    await ensureWallet(env);
    const row = await env.DB.prepare("SELECT address FROM void_wallet WHERE id = 'cdp'").first();
    if (row && ADDR_RE.test(String(row.address || ''))) return { address: row.address, source: 'cdp', note: 'Verse\'s own Coinbase server wallet (key held in Coinbase\'s enclave)' };
    if (cdpReady(env)) {
      try {
        const a = await cdpAccount(env, fetchImpl);
        await env.DB.prepare('INSERT INTO void_wallet (id, at, address, source) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET address = excluded.address, at = excluded.at').bind('cdp', new Date().toISOString(), a.address, 'cdp').run();
        return { address: a.address, source: 'cdp', note: 'Verse\'s own Coinbase server wallet (key held in Coinbase\'s enclave)' };
      } catch (e) { console.log('[wallet] CDP account not made: ' + String(e && e.message || e).slice(0, 200)); }
    }
  }
  if (ADDR_RE.test(String(env.CRYPTO_USDC_BASE_ADDR || ''))) return { address: String(env.CRYPTO_USDC_BASE_ADDR), source: 'store', note: 'the store\'s USDC address, until Verse\'s own wallet exists' };
  return null;
}

async function rpc(env, method, params, fetchImpl) {
  const r = await (fetchImpl || fetch)(env.BASE_RPC_URL || 'https://mainnet.base.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json().catch(() => ({})); if (j.error || j.result == null) throw new Error('rpc'); return j.result;
}
/** USDC the address holds on Base, read from the chain (balanceOf). -> units string | null when the chain is not reachable. */
export async function usdcBalance(env, address, fetchImpl) {
  try { return BigInt(await rpc(env, 'eth_call', [{ to: USDC_BASE, data: '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0') }, 'latest'], fetchImpl)).toString(); }
  catch (_) { return null; }
}

/** Record a settled x402 payment (counted only after it is read back on chain). */
export async function recordPayment(env, { tx, service, units, network, payTo }) {
  await ensureWallet(env);
  await env.DB.prepare('INSERT OR IGNORE INTO void_x402 (tx, at, service, units, network, pay_to, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(tx.toLowerCase(), new Date().toISOString(), service, String(units), network, payTo.toLowerCase(), 'settled').run();
}

/** Read up to `max` unconfirmed payments back from the chain. A transfer that is not there (or not the amount) is marked, never counted. */
export async function confirmPayments(env, { max = 5, fetchImpl } = {}) {
  await ensureWallet(env);
  const rows = (await env.DB.prepare("SELECT tx, units, pay_to FROM void_x402 WHERE status = 'settled' ORDER BY at LIMIT ?").bind(max).all()).results || [];
  const checks = await Promise.all(rows.map((r) => verifyUsdcTx(env, r.tx, r.pay_to, BigInt(r.units), fetchImpl).then((v) => ({ r, v }))));
  const now = new Date().toISOString();
  const stmts = checks.filter(({ v }) => !v.retry).map(({ r, v }) => env.DB.prepare('UPDATE void_x402 SET status = ?, checked = ?, why = ? WHERE tx = ?')
    .bind(v.ok ? 'verified' : 'not on chain', now, v.ok ? null : String(v.reason).slice(0, 200), r.tx));
  if (stmts.length) await env.DB.batch(stmts);
  return stmts.length;
}

/** USDC income, totals only: x402 payments read back on chain, and store orders paid in USDC on Base. Pure over rows. */
export function usdcIncome(x402Rows = [], storeRows = []) {
  const ok = x402Rows.filter((r) => r.status === 'verified'), waiting = x402Rows.filter((r) => r.status === 'settled');
  const x402_cents = ok.reduce((n, r) => n + centsOf(r.units), 0);
  const store_cents = storeRows.filter((r) => r.provider === 'usdc-base' && r.status === 'paid' && !r.refunded).reduce((n, r) => n + Math.max(0, Math.round(Number(r.cents) || 0)), 0);
  return { x402_payments: ok.length, x402_cents, x402_waiting: waiting.length, store_usdc_orders: storeRows.filter((r) => r.provider === 'usdc-base' && r.status === 'paid' && !r.refunded).length, store_usdc_cents: store_cents, cents: x402_cents + store_cents };
}
export async function incomeRows(env) {
  await ensureWallet(env);
  const x = (await env.DB.prepare('SELECT status, units FROM void_x402').all()).results || [];
  let s = [];
  try { s = (await env.DB.prepare("SELECT provider, status, cents, refunded FROM store_orders WHERE provider = 'usdc-base'").all()).results || []; } catch (_) {} // no store table on this deployment
  return { x, s };
}
