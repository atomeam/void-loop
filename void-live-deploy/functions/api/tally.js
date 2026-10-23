// Everyone's tally, the server half (owner, 2026-10-23: the global counter for the coin-flip stats; lib/tally.js has the closed list and the rules).
// POST { of, v, n } adds n to a value of a tally; GET ?of= reads the counts: all time and today.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account, cookie or key. The most a caller can do is:
//   - add 1 to 20 to one value of one tally (both from closed lists in lib/tally.js; anything else is a 400) and read the counts back. Nothing a
//     caller types is stored, echoed or drawn: the response is integers;
//   - do that 30 times a minute and 600 times a day from one connection (keyed by SHA-256 of address + UTC day + the SALT secret, cut to 16 hex: the
//     address itself is never stored, logged or returned, and the key changes every day), and 20,000 times a day in all (the D1 write budget: about
//     3 writes a request). Past a limit the answer is 429 with Retry-After;
//   - so push a count up. THAT IS NOT PREVENTED: the tally is anonymous, so one person with many addresses (a botnet or a rotating proxy) can skew
//     it, by at most 20 x 600 a day per address; the ceilings above bound how fast, and a day's count stops at 9,999,999. The counts are a curiosity
//     ("everyone today: 51% heads"), never a vote that decides anything;
//   - fill the table: two rows a day per tally (one per value), because the lists are closed.
// The minute limits live in the edge cache (lib/guard.js bump, per data centre, best effort); the daily limits are rows in D1. With no D1 or no SALT
// the route is off (503) rather than unguarded. No model, no KV, no third party. Same-origin only: no CORS header, and a foreign Origin is refused.
import { bump } from '../../lib/guard.js';
import { LIMITS, TALLIES, isTally, parseTally, countsOf, dayOf, secondsToMidnight, clientKey } from '../../lib/tally.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'the tally is off for now' }, 503);
const slow = (secs, error = 'slow down') => json({ ok: false, error }, 429, { 'retry-after': String(secs) });

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_tally (tally TEXT NOT NULL, v TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (tally, v, day))').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_tally_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run(); // k: a hashed client key or "all"; no address
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again

async function readCounts(env, of, day) {
  const { results } = await env.DB.prepare('SELECT v, day, n FROM void_tally WHERE tally = ?').bind(of).all();
  return countsOf(of, results, day);
}
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_tally_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_tally_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();

export async function onRequestGet({ request, env }) {
  const of = new URL(request.url).searchParams.get('of');
  if (!isTally(of)) return json({ ok: false, error: 'not a tally' }, 400);
  if (!env || !env.DB) return off();
  try { await ensure(env); return json({ ok: true, counts: await readCounts(env, of, dayOf()) }); } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off(); // closed, not open: no way to hash the address or keep the day's count
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > LIMITS.body) return json({ ok: false, error: 'too big' }, 413);
  const p = parseTally(request.headers.get('content-type'), (await request.text()).slice(0, LIMITS.body + 1));
  if (!p.ok) return json({ ok: false, error: p.error }, p.status);
  const now = Date.now(), day = dayOf(now);
  const key = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'tally:c:' + key)) > LIMITS.perMinute) return slow(60); // the cheap limit first (edge cache, no D1)
  try {
    await ensure(env);
    const all = await used(env, 'all', day);
    if (all >= LIMITS.globalPerDay) return slow(secondsToMidnight(now), 'the crowd is loud today');
    if ((await used(env, 'c:' + key, day)) >= LIMITS.perDay) return slow(secondsToMidnight(now), 'that is enough for today');
    if (all === 0) await env.DB.prepare('DELETE FROM void_tally_days WHERE day < ?').bind(day).run(); // the day's first request clears yesterday's counters
    await env.DB.prepare('INSERT INTO void_tally (tally, v, day, n) VALUES (?, ?, ?, ?) ON CONFLICT(tally, v, day) DO UPDATE SET n = MIN(n + excluded.n, ?)').bind(p.of, p.v, day, p.n, LIMITS.countCap).run();
    await tick(env, 'c:' + key, day); await tick(env, 'all', day);
    return json({ ok: true, counts: await readCounts(env, p.of, day) });
  } catch (_) { return off(); }
}
export const VALUES = TALLIES; // for the page's own reading of the list
