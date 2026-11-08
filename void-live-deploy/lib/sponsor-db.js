// The sponsor grid's and the claim wall's tables (lib/sponsors.js has the rules). Shared by functions/api/sponsors.js, functions/api/claim.js,
// functions/api/x402/sponsor/[plan].js and functions/api/treasury.js. No address of a visitor is stored except the Base address a claimant
// gives for the payout, and that address is never returned by a public read.
import { ensureWallet } from './verse-wallet.js';

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_sponsor (id TEXT PRIMARY KEY, at TEXT NOT NULL, slot TEXT NOT NULL, title TEXT NOT NULL, text TEXT, url TEXT NOT NULL, plan TEXT NOT NULL, days INTEGER NOT NULL, units TEXT NOT NULL, starts TEXT NOT NULL, ends TEXT NOT NULL, tx TEXT, status TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_sponsor_views (day TEXT NOT NULL, tile TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, tile, kind))',
  'CREATE TABLE IF NOT EXISTS void_claims (id TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, who TEXT NOT NULL, address TEXT NOT NULL, units TEXT NOT NULL, status TEXT NOT NULL, tx TEXT)',
];
const ready = new WeakMap();
export async function ensureSponsor(env) {
  await ensureWallet(env);
  let p = ready.get(env.DB);
  if (!p) { p = env.DB.batch(TABLES.map((t) => env.DB.prepare(t))).catch((e) => { ready.delete(env.DB); throw e; }); ready.set(env.DB, p); }
  return p;
}

/** every bought tile, with the chain status of the payment that bought it ('settled' until read back, then 'verified' or 'not on chain') */
export async function tileRows(env) {
  await ensureSponsor(env);
  return (await env.DB.prepare('SELECT s.id, s.slot, s.title, s.text, s.url, s.plan, s.days, s.units, s.starts, s.ends, s.status, x.status AS chain FROM void_sponsor s LEFT JOIN void_x402 x ON x.tx = s.tx ORDER BY s.starts, s.id').all()).results || [];
}
/** tiles that still stand: a payment the chain did not show is taken off the grid */
export const standing = (rows) => (rows || []).filter((r) => r.status === 'paid' && r.chain !== 'not on chain');

/** sponsor income in units: verified on chain, and still waiting to be read back */
export async function sponsorUnits(env) {
  await ensureSponsor(env);
  const rows = (await env.DB.prepare("SELECT status, units FROM void_x402 WHERE service LIKE 'sponsor-%'").all()).results || [];
  let verified = 0n, waiting = 0n, payments = 0;
  for (const r of rows) { let u = 0n; try { u = BigInt(r.units); } catch (_) {} if (r.status === 'verified') { verified += u; payments++; } else if (r.status === 'settled') waiting += u; }
  return { verified, waiting, payments };
}
/** claims in units: all accepted ones (owed or paid), and the ones paid out */
export async function claimUnits(env) {
  await ensureSponsor(env);
  const rows = (await env.DB.prepare('SELECT status, units FROM void_claims').all()).results || [];
  let claimed = 0n, paid = 0n, owed = 0;
  for (const r of rows) { let u = 0n; try { u = BigInt(r.units); } catch (_) {} claimed += u; if (r.status === 'paid') paid += u; else owed++; }
  return { claimed, paid, owed, count: rows.length };
}
