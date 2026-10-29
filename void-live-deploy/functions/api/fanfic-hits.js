// /fanfic/ hits (owner's coordinator, 2026-10-29: "count real reads only", "1 hit per visitor per story per day", "no IP or personal data",
// "atomic store"): how many readers opened each story.
//   GET  /api/fanfic-hits?ids=<board>/<no>,...   { ok, hits: { 'board/no': n } } for up to 100 stories; a story never read is left out
//   POST /api/fanfic-hits?b=<board>&t=<no>       count one read of that story; { ok, hits, counted }
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (AGENTS.md "Never": an unauthenticated POST is thought through first).
//   - POST: raise a story's count by at most 1 a day from one connection. The read is counted only for a live (not hidden, not deleted)
//     story on a fan fiction board, never for a challenge, and never for a known bot or an empty user agent. One connection is counted at
//     most RATE_MIN times a minute in the route (D1), on top of the guard's per-connection limit (lib/guard.js). Worst case: many
//     addresses inflate a count by one each a day.
//   - GET: read numbers that are public anyway.
// What is kept: per story, its count. Per read, an HMAC of (address, story) keyed by the server's SALT and the day, so a visitor cannot be
// followed from one day to the next or from one story to another; those rows are deleted after a day. No address, no cookie, nothing else.
import { isFicBoard, readChallenge } from '../../lib/fanfic.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const DAY = 864e5, MIN = 60e3;
export const RATE_MIN = 30; // counted reads a minute from one connection
export const KEY_RE = /^([a-z0-9]{1,10})\/([1-9]\d{0,8})$/;
/** a crawler, a link preview, a script or a headless browser: their visits are not reads. An empty agent counts as one. Pure. */
export const isBotAgent = (ua) => !String(ua || '').trim() || /bot\b|bot\/|crawl|spider|slurp|scrap|headless|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python|httpclient|okhttp|go-http|java\/|node-fetch|axios|undici|lighthouse|pagespeed|monitor|uptime|feed|rss|archive\.org|ia_archiver/i.test(String(ua));

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_fanfic_hits (board TEXT NOT NULL, no INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (board, no))',
  'CREATE TABLE IF NOT EXISTS void_fanfic_hit_seen (h TEXT PRIMARY KEY, day INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS void_fanfic_hit_seen_day ON void_fanfic_hit_seen (day)',
  'CREATE TABLE IF NOT EXISTS void_fanfic_hit_rate (h TEXT PRIMARY KEY, m INTEGER NOT NULL, n INTEGER NOT NULL)',
];
let ready = null;
async function tables(env) {
  if (!ready) ready = (async () => { for (const t of TABLES) await env.DB.prepare(t).run(); })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again

/** a key that lives one day: HMAC(SALT and the day number, what). The same visitor gives unrelated keys on other days and other stories. */
export async function dayKey(env, day, what) {
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-fanfic-hits:' + env.SALT + ':' + day), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(what))).slice(0, 32);
}

export async function onRequestGet({ request, env }) {
  const keys = [...new Set(String(new URL(request.url).searchParams.get('ids') || '').split(',').filter((x) => KEY_RE.test(x)))].slice(0, 100);
  if (!env.DB || !keys.length) return json({ ok: true, hits: {} });
  await tables(env);
  const pairs = keys.map((k) => KEY_RE.exec(k)), where = pairs.map(() => '(board = ? AND no = ?)').join(' OR ');
  const { results } = await env.DB.prepare('SELECT board, no, n FROM void_fanfic_hits WHERE ' + where).bind(...pairs.flatMap((m) => [m[1], +m[2]])).all(); // void-review: ok (only fixed placeholders are pasted; the values are bound)
  return json({ ok: true, hits: Object.fromEntries((results || []).filter((r) => r.n > 0).map((r) => [r.board + '/' + r.no, Number(r.n)])) });
}

export async function onRequestPost({ request, env, now = Date.now() }) {
  const sp = new URL(request.url).searchParams, m = KEY_RE.exec((sp.get('b') || '') + '/' + (sp.get('t') || ''));
  if (!m) return json({ ok: false, say: 'send ?b=<board>&t=<story>' }, 400);
  if (!env.DB || !env.SALT) return json({ ok: false, say: 'hits are not set up here' }, 503);
  await tables(env);
  const board = m[1], no = +m[2];
  const count = async () => Number(((await env.DB.prepare('SELECT n FROM void_fanfic_hits WHERE board = ? AND no = ?').bind(board, no).first()) || {}).n) || 0;
  const op = await env.DB.prepare('SELECT p.body, b.code, b.title, b.about FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.board = ? AND p.no = ? AND p.thread = p.no AND p.deleted = 0 AND p.hidden = 0').bind(board, no).first();
  if (!op || !isFicBoard(op) || readChallenge(op.body)) return json({ ok: false, say: 'that story is not here' }, 404);
  if (isBotAgent(request.headers.get('user-agent'))) return json({ ok: true, hits: await count(), counted: false });
  const day = Math.floor(now / DAY), minute = Math.floor(now / MIN), ip = request.headers.get('cf-connecting-ip') || 'local';
  // the rate, per connection per minute: one atomic upsert that restarts the count when the minute changes
  const rate = await env.DB.prepare('INSERT INTO void_fanfic_hit_rate (h, m, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = CASE WHEN m = excluded.m THEN n + 1 ELSE 1 END, m = excluded.m RETURNING n')
    .bind(await dayKey(env, day, 'rate|' + ip), minute).first();
  if (rate && rate.n > RATE_MIN) return json({ ok: false, say: 'slow down' }, 429);
  // once a day per visitor and story: the insert is the check, so two reads at the same moment cannot both count
  const h = await dayKey(env, day, 'seen|' + ip + '|' + board + '/' + no);
  const seen = await env.DB.prepare('INSERT OR IGNORE INTO void_fanfic_hit_seen (h, day) VALUES (?, ?)').bind(h, day).run();
  if (!seen.meta || !seen.meta.changes) return json({ ok: true, hits: await count(), counted: false });
  const r = await env.DB.prepare('INSERT INTO void_fanfic_hits (board, no, n) VALUES (?, ?, 1) ON CONFLICT(board, no) DO UPDATE SET n = n + 1 RETURNING n').bind(board, no).first();
  if (h.startsWith('0')) { // about one counted read in 16 clears yesterday's keys and old rate rows
    await env.DB.prepare('DELETE FROM void_fanfic_hit_seen WHERE day < ?').bind(day).run();
    await env.DB.prepare('DELETE FROM void_fanfic_hit_rate WHERE m < ?').bind(minute - 5).run();
  }
  return json({ ok: true, hits: Number(r && r.n) || 1, counted: true });
}
