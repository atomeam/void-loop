// Who visits Verse, the server half (owner chore, 2026-10-26; lib/visits.js has the rules). POST is the beacon /visit.js sends once per page
// load; GET ?days=N (1 to 31) reads the counts back: per day the views and unique visitors of each class (person, ours, bot), and over the range
// the top pages, referrer hosts and countries of people. tools/traffic.mjs reads it every day into domains/traffic.json.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account, cookie or key. The most a caller can do is:
//   - add 1 to a day's views of the class their own request falls in (lib/visits.js classify, from the user agent: the class is never taken from
//     the body), and, as a "person", 1 to a page (reduced to its first path segment), a referrer host (reduced to a public-looking host name, our
//     own dropped) and the country Cloudflare puts on the request. Nothing else a caller sends is stored, echoed or drawn: the response is integers
//     and host names that were each seen at least twice;
//   - be counted as one unique visitor a day: the key is SHA-256 of address + user agent + UTC day + the SALT secret, cut to 16 hex; the address
//     and the user agent are never stored, logged or returned, the key changes every day, and the day's first beacon deletes yesterday's keys;
//   - do that 20 times a minute (edge cache, lib/guard.js bump) and 300 times a day from one connection, and 8,000 times a day in all (the D1 write
//     budget: about 6 writes a beacon). Past a limit the answer is 429 with Retry-After;
//   - so push the count up. THAT IS NOT PREVENTED: the count is anonymous, so one person with many addresses (a botnet or a rotating proxy) can
//     inflate "people" by 300 views and one unique visitor per address per day; the ceilings bound how fast. The count is a curiosity that tells
//     the builders whether anyone comes, never a number that decides or pays anything;
//   - fill the table: at most 50 distinct pages, 50 referrer hosts and 50 countries a day (the rest count as "other"), plus 6 class rows.
// With no D1 or no SALT the route is off (503) rather than unguarded. No model, no KV, no third party. Same-origin writes only (lib/guard.js and
// the Origin check below); no CORS header.
import { bump } from '../../lib/guard.js';
import { dayOf, secondsToMidnight, clientKey } from '../../lib/reactions.js';
import { LIMITS, classify, parseBeacon, countryOf, summarize } from '../../lib/visits.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'the count is off for now' }, 503);
const slow = (secs, error = 'slow down') => json({ ok: false, error }, 429, { 'retry-after': String(secs) });

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_visits (day TEXT NOT NULL, kind TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, kind, k))').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_visit_seen (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run(); // k: a hashed daily key or "all"; no address
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again

const seen = async (env, k) => { const r = await env.DB.prepare('SELECT n, day FROM void_visit_seen WHERE k = ?').bind(k).first(); return r ? { n: Number(r.n) || 0, day: r.day } : null; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_visit_seen (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
const add = (env, day, kind, k) => env.DB.prepare('INSERT INTO void_visits (day, kind, k, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind, k) DO UPDATE SET n = MIN(n + 1, ?)').bind(day, kind, k, LIMITS.countCap).run();
// a page, host or country new today is kept only while the day has fewer than LIMITS.keysPerDay of that kind; past that it counts as "other"
async function addCapped(env, day, kind, k) {
  if (!k) return;
  const has = await env.DB.prepare('SELECT n FROM void_visits WHERE day = ? AND kind = ? AND k = ?').bind(day, kind, k).first();
  if (!has) { const c = await env.DB.prepare('SELECT COUNT(*) AS c FROM void_visits WHERE day = ? AND kind = ?').bind(day, kind).first(); if (c && Number(c.c) >= LIMITS.keysPerDay) k = 'other'; }
  await add(env, day, kind, k);
}

export async function onRequestGet({ request, env }) {
  const d = Number(new URL(request.url).searchParams.get('days') || 7);
  const days = Number.isInteger(d) && d >= 1 && d <= LIMITS.days ? d : 7;
  if (!env || !env.DB) return off();
  try {
    await ensure(env);
    const since = dayOf(Date.now() - (days - 1) * 864e5);
    const { results } = await env.DB.prepare('SELECT day, kind, k, n FROM void_visits WHERE day >= ?').bind(since).all();
    return json({ ok: true, since, ...summarize(results) });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url), from = request.headers.get('origin');
  if (from && from !== here.origin) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off(); // closed, not open: no way to hash the address or keep the day's count
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > LIMITS.body) return json({ ok: false, error: 'too big' }, 413);
  const p = parseBeacon(request.headers.get('content-type'), (await request.text()).slice(0, LIMITS.body + 1), here.hostname.replace(/^www\./, ''));
  if (!p.ok) return json({ ok: false, error: p.error }, p.status);
  const ua = request.headers.get('user-agent') || '';
  const cls = classify({ ua, test: request.headers.get('x-void-test'), webdriver: p.webdriver });
  const now = Date.now(), day = dayOf(now);
  const key = await clientKey((request.headers.get('cf-connecting-ip') || 'unknown') + '|' + ua, day, env.SALT);
  if ((await bump(here.origin, 'visit:c:' + key)) > LIMITS.perMinute) return slow(60); // the cheap limit first (edge cache, no D1)
  try {
    await ensure(env);
    const all = await seen(env, 'all'), allToday = all && all.day === day ? all.n : 0;
    if (allToday >= LIMITS.globalPerDay) return slow(secondsToMidnight(now), 'the count is full today');
    const mine = await seen(env, 'c:' + key);
    if (mine && mine.n >= LIMITS.perDay) return slow(secondsToMidnight(now), 'that is enough for today');
    if (allToday === 0) await env.DB.prepare('DELETE FROM void_visit_seen WHERE day < ?').bind(day).run(); // the day's first beacon clears yesterday's keys
    await add(env, day, 'views', cls);
    if (!mine) await add(env, day, 'uniq', cls);
    if (cls === 'person') { await addCapped(env, day, 'page', p.page); await addCapped(env, day, 'ref', p.ref); await addCapped(env, day, 'country', countryOf(request.cf && request.cf.country)); }
    await tick(env, 'c:' + key, day); await tick(env, 'all', day);
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (_) { return off(); }
}
