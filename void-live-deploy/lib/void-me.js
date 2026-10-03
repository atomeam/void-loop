// Your Void follows you (plan item 6): shared server bits for /api/passkey and /api/mine.
// Tables are made on first use (same SQL as tools/d1/void_passkeys.sql) because the deploy doesn't run D1 SQL.
// If they can't be made, every call answers 503: no sign-in, no sync, nothing half-written.
import { randomB64u, sha256, b64u } from './webauthn.js';
import { PAGE_TABLE } from './pages.js';

export const RP_NAME = 'Void';
export const CHALLENGE_TTL_MS = 5 * 60e3;
export const SESSION_TTL_MS = 180 * 864e5;
export const MAX_DATA = 900000; // chars of JSON; D1 rows top out at 2 MB

// Production is https://a-to-mind.com only. PASSKEY_RP_ID / PASSKEY_ORIGINS exist for the local test suite; leave them unset live.
export function rp(env) {
  const id = String(env.PASSKEY_RP_ID || 'a-to-mind.com');
  const origins = String(env.PASSKEY_ORIGINS || 'https://a-to-mind.com').split(',').map((s) => s.trim()).filter(Boolean);
  return { id, origins };
}

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL, alg INTEGER NOT NULL, sign_count INTEGER NOT NULL, transports TEXT, backed_up INTEGER, at TEXT NOT NULL, used TEXT)',
  'CREATE INDEX IF NOT EXISTS void_passkeys_user ON void_passkeys (user_id)',
  'CREATE TABLE IF NOT EXISTS void_passkey_challenges (id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT, expires INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, at TEXT NOT NULL, expires INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS void_sessions_user ON void_sessions (user_id)',
  // Owner login: passkeys the owner bound with the key itself (/api/passkey 'owner-bind'). Signing in with one brings an owner session.
  'CREATE TABLE IF NOT EXISTS void_owner_passkeys (id TEXT PRIMARY KEY, at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_mine (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated TEXT NOT NULL)',
  // Plan item 12 (paid Void): a passkey account's tier. No row = 'free'. Only /api/gumroad writes it, after Gumroad's API confirms the sale.
  PAGE_TABLE, // a published Void (/@name): made here too so 'forget me' can always remove it
  "CREATE TABLE IF NOT EXISTS void_accounts (user_id TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')), sale_id TEXT UNIQUE, subscription_id TEXT, updated TEXT NOT NULL)",
];
// The account's tier. Fails closed: a missing row, an unknown value or any read error is 'free' (never paid by accident).
export async function tierOf(env, userId) {
  try {
    const row = await env.DB.prepare('SELECT tier FROM void_accounts WHERE user_id = ?').bind(userId).first();
    return row && row.tier === 'paid' ? 'paid' : 'free';
  } catch (_) { return 'free'; }
}
const made = new WeakMap();
export function ensureTables(env) {
  if (!env.DB) return Promise.reject(new Error('no DB binding'));
  let p = made.get(env.DB);
  if (!p) { p = env.DB.batch(TABLES.map((q) => env.DB.prepare(q))).catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

export const bad = (status, error, extra) => Response.json({ ok: false, error, ...(extra || {}) }, { status, headers: { 'cache-control': 'no-store' } });
export const good = (body) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
const hex = (u) => [...u].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sessionId = async (token) => hex(await sha256('void-session:' + token));

// Bearer <token> -> { userId, sid } or null. Only the SHA-256 of a token is stored.
export async function session(request, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  const sid = await sessionId(m[1]);
  const row = await env.DB.prepare('SELECT user_id, expires FROM void_sessions WHERE id = ?').bind(sid).first();
  if (!row || Number(row.expires) <= Date.now()) return null;
  return { userId: row.user_id, sid };
}
export async function newSession(env, userId) {
  const token = randomB64u(32);
  const stmt = env.DB.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').bind(await sessionId(token), userId, new Date().toISOString(), Date.now() + SESSION_TTL_MS);
  return { token, stmt, expires: new Date(Date.now() + SESSION_TTL_MS).toISOString() };
}
export const newUserId = () => b64u(crypto.getRandomValues(new Uint8Array(16)));

// Light per-isolate brake on anonymous challenge minting (each one is a D1 write).
const hits = new Map();
export function brake(request, max = 20) {
  const ip = request.headers.get('cf-connecting-ip') || 'local', now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60e3);
  if (h.length >= max) return true;
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return false;
}
