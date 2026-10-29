// The chat relay (/chat/, lib/chat-core.js): it keeps sealed messages for a while so the people in a chat can fetch them, and nothing else.
//   GET  /api/chat?r=<room>&after=<n>   the sealed messages of a room after number n (at most 60), oldest first
//   POST /api/chat {r, c}               add one sealed message to a room; answers its number
// The room is a SHA-256 of the chat's key cut to 32 hex characters; the key itself lives in the invite link's fragment and never reaches here. A
// sealed message is AES-GCM ciphertext made in the browser: who wrote it, what it says and every picture are inside. This route cannot read a word.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open endpoint with no account, cookie or key.
//   - POST: put up to 8,000 base64url characters (a message) or 200,000 (a sealed picture) into any room name of the right shape, as a numbered
//     row kept 7 days (a picture 3 days). Nothing is shown to anyone but whoever asks for that same room, and a member's browser opens only what its
//     key seals: junk in a room is dropped there unread (lib/chat-core.js open() and clean()). Rates: 40 a minute (edge cache, per data centre, best
//     effort) and 1,500 a day per connection, 40 pictures a day per connection; 5,000 messages and 300 pictures a day in all (the D1 write budget:
//     4 writes a message). Past a limit the answer is 429 with Retry-After. Worst case stored: 300 x 200 KB x 3 days of pictures (about 180 MB) and
//     5,000 x 8 KB x 7 days of messages (about 280 MB); expired rows are swept on every write.
//   - GET: read the sealed rows of a room whose 32-hex name it knows (only a member knows it: it comes from the key). 60 rows a call; the
//     middleware caps requests per connection per minute (lib/guard.js LIMITS.chat). Sealed bytes are all it gets.
//   - THAT IS NOT PREVENTED: someone who guesses nothing but floods random room names fills rows within the daily caps above; the caps bound it.
// Kept about a writer: the day's count under a keyed hash of the address (SHA-256 of address + UTC day + SALT, cut; never the address; the key changes
// every day). With no D1 or no SALT the route is off (503) rather than unguarded. Same-origin only; no CORS header. No model, no KV, no third party.
import { bump } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/tally.js';
import { LIMITS, ROOM_RE, SEALED_RE } from '../../lib/chat-core.js';

export const RATES = Object.freeze({ perMinute: 40, perDay: 1500, picsPerDay: 40, allDay: 5000, allPics: 300, keepMs: 7 * 864e5, keepPicMs: 3 * 864e5, page: 60 });
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'the chat relay is off for now' }, 503);
const slow = (secs, error) => json({ ok: false, error }, 429, { 'retry-after': String(secs) });

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_chat (room TEXT NOT NULL, s INTEGER NOT NULL, at INTEGER NOT NULL, exp INTEGER NOT NULL, c TEXT NOT NULL, PRIMARY KEY (room, s))').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS void_chat_exp ON void_chat (exp)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_chat_rooms (room TEXT PRIMARY KEY, next INTEGER NOT NULL, last INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_chat_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL, pics INTEGER NOT NULL)').run(); // k: a hashed client key or "all"
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again
const intOf = (x) => (/^\d{1,12}$/.test(String(x || '')) ? +x : 0);

export async function onRequestGet({ request, env }) {
  const sp = new URL(request.url).searchParams, room = sp.get('r') || '';
  if (!ROOM_RE.test(room)) return json({ ok: false, error: 'not a room' }, 400);
  if (!env || !env.DB) return off();
  try {
    await ensure(env);
    const { results } = await env.DB.prepare('SELECT s, at, c FROM void_chat WHERE room = ? AND s > ? AND exp > ? ORDER BY s LIMIT ' + RATES.page).bind(room, intOf(sp.get('after')), Date.now()).all();
    return json({ ok: true, msgs: (results || []).map((r) => ({ s: r.s, at: r.at, c: r.c })), more: (results || []).length === RATES.page });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let d; try { d = JSON.parse((await request.text()).slice(0, LIMITS.blob + 200)); } catch (_) { return json({ ok: false, error: 'send JSON: {r, c}' }, 400); }
  const room = d && d.r, c = d && d.c;
  if (typeof room !== 'string' || !ROOM_RE.test(room)) return json({ ok: false, error: 'not a room' }, 400);
  if (typeof c !== 'string' || c.length < 40 || c.length > LIMITS.blob || !SEALED_RE.test(c)) return json({ ok: false, error: 'not a sealed message (40 to ' + LIMITS.blob + ' base64url characters)' }, c && c.length > LIMITS.blob ? 413 : 400);
  const pic = c.length > LIMITS.sealed, now = Date.now(), day = dayOf(now);
  const key = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'chat:c:' + key, now)) > RATES.perMinute) return slow(60, 'slow down: ' + RATES.perMinute + ' messages a minute');
  try {
    await ensure(env);
    const used = async (k) => { const r = await env.DB.prepare('SELECT day, n, pics FROM void_chat_days WHERE k = ?').bind(k).first(); return r && r.day === day ? { n: +r.n || 0, pics: +r.pics || 0 } : { n: 0, pics: 0 }; };
    const all = await used('all'), mine = await used(key);
    if (all.n >= RATES.allDay || (pic && all.pics >= RATES.allPics)) return slow(secondsToMidnight(now), pic ? 'the relay has carried all the pictures it can today; text still goes' : 'the relay has carried all it can today; it opens again at midnight UTC');
    if (mine.n >= RATES.perDay || (pic && mine.pics >= RATES.picsPerDay)) return slow(secondsToMidnight(now), pic ? RATES.picsPerDay + ' pictures a day from one connection' : RATES.perDay + ' messages a day from one connection');
    const tick = (k) => env.DB.prepare('INSERT INTO void_chat_days (k, day, n, pics) VALUES (?, ?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, pics = CASE WHEN day = excluded.day THEN pics + excluded.pics ELSE excluded.pics END, day = excluded.day').bind(k, day, pic ? 1 : 0).run();
    // sweep first: expired messages, then rooms quiet for 60 days (a room's numbers start again after that; a member's page notices)
    await env.DB.prepare('DELETE FROM void_chat WHERE rowid IN (SELECT rowid FROM void_chat WHERE exp < ? LIMIT 100)').bind(now).run();
    await env.DB.prepare('DELETE FROM void_chat_rooms WHERE room IN (SELECT room FROM void_chat_rooms WHERE last < ? LIMIT 50)').bind(now - 60 * 864e5).run();
    const n = await env.DB.prepare('INSERT INTO void_chat_rooms (room, next, last) VALUES (?, 1, ?) ON CONFLICT(room) DO UPDATE SET next = next + 1, last = excluded.last RETURNING next').bind(room, now).first();
    const s = n && n.next; if (!s) return off();
    await env.DB.prepare('INSERT INTO void_chat (room, s, at, exp, c) VALUES (?, ?, ?, ?, ?)').bind(room, s, now, now + (pic ? RATES.keepPicMs : RATES.keepMs), c).run();
    await tick('all'); await tick(key);
    return json({ ok: true, s, at: now }, 201);
  } catch (_) { return off(); }
}
