// The owner's Searches log (owner, 2026-11-20): every ask typed into Verse, kept 90 days in Verse's own D1 for safety and better answers. Each row
// holds the time, the ask, a visitor ID (a salted hash of the connection and the browser, never a raw IP), the card type and whether the minors /
// illegal block caught it. Strikes: 3 blocked asks in 24 hours slows a visitor down, 5 locks them until the owner decides (the Ban button lifts or
// confirms it). Pure logic over a small store, so the tests run on a memory store and the API on D1 (functions/api/searches.js).
import { unsafeText, minorBlocked } from './image-safety.js';

export const RETAIN_DAYS = 90, DAY = 864e5, SLOW_AT = 3, LOCK_AT = 5, ASK_MAX = 300;

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** a stable visitor ID: v- + 12 hex of SHA-256(salt, connection, browser). The raw IP is never kept or shown. */
export async function visitorId(request, env = {}) {
  const h = (k) => (request.headers.get(k) || '');
  return 'v-' + (await sha('searches|' + (env.SALT || 'verse') + '|' + h('cf-connecting-ip') + '|' + h('user-agent'))).slice(0, 12);
}
/** blocked: 'minor' when the ask is caught by the minors / illegal block (lib/image-safety.js), else ''. */
export const blockedOf = (ask) => (minorBlocked(unsafeText(ask)) ? 'minor' : '');
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** a memory store with the same four calls as the D1 one (tests, local). */
export function memoryStore() {
  const rows = [], bans = new Map();
  return {
    rows, bans,
    async add(r) { rows.push(r); },
    async list({ who = '', q = '', limit = 200 } = {}) { return rows.filter((r) => (!who || r.who === who) && (!q || r.ask.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.at - a.at).slice(0, limit); },
    async blockedSince(who, since) { return rows.filter((r) => r.who === who && r.blocked && r.at >= since).length; },
    async ban(who) { return bans.get(who) || null; },
    async setBan(who, state, why) { if (state) bans.set(who, { who, state, why, at: Date.now() }); else bans.delete(who); },
    async prune(before) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].at < before) rows.splice(i, 1); },
  };
}
/** one ask: logged, then judged. Returns { logged, blocked, state: ''|'slow'|'locked'|'banned' }. */
export async function record(store, { ask, who, kind = '', now = Date.now() }) {
  const a = clean(ask, ASK_MAX); if (!a || !who) return { logged: false, blocked: '', state: '' };
  const ban = await store.ban(who);
  const blocked = blockedOf(a);
  await store.add({ at: now, ask: a, who, kind: clean(kind, 30), blocked });
  if (ban && ban.state === 'banned') return { logged: true, blocked, state: 'banned' };
  if (ban && ban.state === 'locked') return { logged: true, blocked, state: 'locked' };
  if (!blocked) return { logged: true, blocked, state: '' };
  const n = await store.blockedSince(who, now - DAY);
  if (n >= LOCK_AT) { await store.setBan(who, 'locked', n + ' blocked asks in 24 hours'); return { logged: true, blocked, state: 'locked' }; }
  return { logged: true, blocked, state: n >= SLOW_AT ? 'slow' : '' };
}
/** the owner's view: the rows, each with its visitor's repeat count of blocked asks and ban state. */
export async function view(store, { who = '', q = '', limit = 200 } = {}) {
  const rows = await store.list({ who, q, limit }), counts = {}, states = {};
  for (const r of rows) if (r.blocked) counts[r.who] = (counts[r.who] || 0) + 1;
  for (const w of new Set(rows.map((r) => r.who))) { const b = await store.ban(w); if (b) states[w] = b.state; }
  return rows.map((r) => ({ ...r, repeats: counts[r.who] || 0, ban: states[r.who] || '' }));
}
/** the D1 store (tables made on first use). */
export function d1Store(db) {
  let ready = null;
  const init = () => (ready = ready || db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS void_searches (at INTEGER, ask TEXT, who TEXT, kind TEXT, blocked TEXT)'),
    db.prepare('CREATE INDEX IF NOT EXISTS void_searches_at ON void_searches (at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS void_searches_who ON void_searches (who, at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS void_search_bans (who TEXT PRIMARY KEY, state TEXT, why TEXT, at INTEGER)'),
  ]));
  return {
    async add(r) { await init(); await db.prepare('INSERT INTO void_searches (at, ask, who, kind, blocked) VALUES (?, ?, ?, ?, ?)').bind(r.at, r.ask, r.who, r.kind, r.blocked).run(); },
    async list({ who = '', q = '', limit = 200 } = {}) { await init(); const r = await db.prepare('SELECT at, ask, who, kind, blocked FROM void_searches WHERE (? = \'\' OR who = ?) AND (? = \'\' OR ask LIKE ?) ORDER BY at DESC LIMIT ?').bind(who, who, q, '%' + q + '%', limit).all(); return r.results || []; },
    async blockedSince(who, since) { await init(); const r = await db.prepare('SELECT COUNT(*) AS n FROM void_searches WHERE who = ? AND blocked != \'\' AND at >= ?').bind(who, since).first(); return (r && r.n) || 0; },
    async ban(who) { await init(); return (await db.prepare('SELECT who, state, why, at FROM void_search_bans WHERE who = ?').bind(who).first()) || null; },
    async setBan(who, state, why) { await init(); if (state) await db.prepare('INSERT INTO void_search_bans (who, state, why, at) VALUES (?, ?, ?, ?) ON CONFLICT(who) DO UPDATE SET state = excluded.state, why = excluded.why, at = excluded.at').bind(who, state, why || '', Date.now()).run(); else await db.prepare('DELETE FROM void_search_bans WHERE who = ?').bind(who).run(); },
    async prune(before) { await init(); await db.prepare('DELETE FROM void_searches WHERE at < ?').bind(before).run(); },
  };
}
