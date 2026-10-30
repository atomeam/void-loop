// The scores page's own API (void-live-deploy/scores/, lib/scores.js): GET /api/scores?league=epl&date=2025-05-25 -> { ok, games }, &view=standings
// -> { ok, groups }, &view=game&id=<digits> -> { ok, game, events, stats, lineups, players }, &view=team&team=<digits> -> { ok, games }. One shape
// for ESPN's public site API, openligadb.de (Bundesliga fallback) and Jolpica (F1), read once and kept on the edge (20 s while a game is live, six
// hours for a settled final, an hour for a table), so a page opens with its scores at once and a burst of visitors asks the sources once.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server ask one of three fixed hosts (site.api.espn.com, api.openligadb.de, api.jolpi.ca) for one fixed path shape: the league
//     comes from a closed list (lib/scores.js LEAGUES), the date must be a real day between 2000 and 400 days ahead, an id is 1 to 12 digits; the
//     caller picks no host, no path piece and no header, so this is not a proxy;
//   - spend those sources' free allowances: a repeat is answered from the edge cache, a miss is at most two calls, and the caller's own allowance
//     is 30 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit; one failed source is not retried in a loop;
//   - read public scores. No model, no token, no database, no write; a failure is never cached as an answer (a good older copy is served as
//     "stale" instead, and the page says so).
// Nothing is bet on, nothing is bought, and no key is used: all three sources are free without one.
import { rateLimited } from './answer.js';
import { leagueOf, dateOk, idOk, ymd, shiftDay, readScoreboard, readStandings, readSummary, readOpenLiga, seasonOf, readF1Races, readF1Results, readF1Standings, ttlFor, formOf, eloOf } from '../../lib/scores.js';

export const RL_MAX = 30, KEEP = 3 * 86400;
export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/', ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/', OPENLIGA = 'https://api.openligadb.de/getmatchdata/bl1/', JOLPICA = 'https://api.jolpi.ca/ergast/f1/';
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** what a request asks: { league, view, day, id } or null when it is not a plain, allowed question. Pure. */
export function askIn(url, now = Date.now()) {
  const p = new URL(url).searchParams, league = leagueOf(String(p.get('league') || '')), view = String(p.get('view') || 'scores');
  if (!league || !['scores', 'standings', 'game', 'team', 'form'].includes(view)) return null;
  if (view === 'standings') return { league, view };
  if (view === 'game' || view === 'team') {
    const id = String(p.get(view === 'game' ? 'id' : 'team') || '');
    return idOk(id) && league.kind === 'espn' ? { league, view, id } : null;
  }
  const day = String(p.get('date') || ymd(new Date(now))), span = p.get('span') === '7' && view === 'scores' ? 7 : 1;
  if (view === 'form' && league.kind !== 'espn') return null;
  return dateOk(day, now) && dateOk(shiftDay(day, span - 1), now) ? { league, view, day, span } : null;
}
async function get(fetchFn, url) {
  const r = await fetchFn(url, { headers: { accept: 'application/json' }, signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
  if (!r.ok) throw new Error('status ' + r.status);
  const t = await r.text(); if (t.length > 4000000) throw new Error('too large');
  return JSON.parse(t);
}
const d8 = (d) => d.replace(/-/g, '');
/** ESPN's games from one day to another, both YYYY-MM-DD. ESPN stopped answering a range (dates=from-to) in October 2026 with a 400 ("Failed
 *  to get events endpoint") while a single day and a whole month still answer (seen on production by the self-check, tools/self-check.mjs:
 *  /scores/ in week view had no games). So the range is asked first, and when it fails a week is asked day by day (at most 7 calls) and a longer
 *  span month by month (the form view's 6 weeks: 2 or 3 calls), keeping only the games inside it, each game once, in start order. */
export async function board(fetchFn, base, from, to) {
  const url = (dates) => base + '/scoreboard?limit=400&dates=' + dates;
  if (from === to) return readScoreboard(await get(fetchFn, url(d8(from))));
  try { return readScoreboard(await get(fetchFn, url(d8(from) + '-' + d8(to)))); } catch (_) {}
  const parts = [];
  if (to <= shiftDay(from, 6)) for (let d = from; d <= to; d = shiftDay(d, 1)) parts.push(d8(d));
  else for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftDay(m + '-28', 4).slice(0, 7)) parts.push(m.replace('-', ''));
  const got = await Promise.allSettled(parts.map((p) => get(fetchFn, url(p))));
  if (!got.some((r) => r.status === 'fulfilled')) throw new Error('no day answered');
  const seen = new Set(), games = [];
  for (const r of got) if (r.status === 'fulfilled') for (const g of readScoreboard(r.value)) {
    const day = String(g.start || '').slice(0, 10);
    if (seen.has(g.id) || (parts[0].length === 6 && day && (day < from || day > to))) continue; seen.add(g.id); games.push(g);
  }
  return games.sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 80);
}
/** the answer to one ask from the sources: { ok: true, ...data, source } or { ok: false }. Never throws. */
export async function lookScores(ask, fetchFn = fetch, now = Date.now()) {
  const { league, view } = ask;
  try {
    if (league.kind === 'f1') {
      if (view === 'standings') { const y = new Date(now).getUTCFullYear(); const [d, c] = await Promise.all([get(fetchFn, JOLPICA + y + '/driverStandings.json'), get(fetchFn, JOLPICA + y + '/constructorStandings.json')]); return { ok: true, ...readF1Standings(d, c), source: 'jolpica' }; }
      const season = ask.day.slice(0, 4), games = readF1Races(await get(fetchFn, JOLPICA + season + '.json?limit=100'), ask.day, now, ask.span);
      for (const g of games) if (g.state === 'final') g.results = readF1Results(await get(fetchFn, JOLPICA + g.season + '/' + g.round + '/results.json').catch(() => null));
      return { ok: true, games, source: 'jolpica' };
    }
    const base = ESPN + league.path;
    if (view === 'standings') return { ok: true, ...readStandings(await get(fetchFn, ESPN_V2 + league.path + '/standings'), league.grp), source: 'espn' };
    if (view === 'game') return { ok: true, ...readSummary(await get(fetchFn, base + '/summary?event=' + ask.id)), source: 'espn' };
    if (view === 'team') return { ok: true, games: readScoreboard(await get(fetchFn, base + '/teams/' + ask.id + '/schedule')), source: 'espn' };
    if (view === 'form') { const gs = await board(fetchFn, base, shiftDay(ask.day, -42), ask.day); return { ok: true, form: formOf(gs), elo: eloOf(gs), source: 'espn' }; }
    try { return { ok: true, games: await board(fetchFn, base, ask.day, shiftDay(ask.day, ask.span - 1)), source: 'espn' }; }
    catch (e) {
      if (league.alt !== 'openliga') throw e;
      // the Bundesliga's community database answers when ESPN does not (its games on that UTC day; the season is the year it started in)
      return { ok: true, games: readOpenLiga(await get(fetchFn, OPENLIGA + seasonOf(ask.day)), ask.day, now, ask.span), source: 'openligadb' };
    }
  } catch (_) { return { ok: false }; }
}
const keyOf = (u, ask) => new Request(u.origin + '/__void-scores/' + ask.league.id + '/' + ask.view + '/' + (ask.day || ask.id || '') + (ask.span > 1 ? '/w' : ''));
export async function onRequestGet({ request, env, fetchFn = fetch, waitUntil }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (!ask) return json({ ok: false, kind: 'missing', say: 'Ask for a league (?league=epl|laliga|bundesliga|seriea|ligue1|mls|ucl|nba|nfl|mlb|nhl|f1) and a day (&date=2025-05-25), or &view=standings.' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = keyOf(u, ask), keep = new Request(key.url + '/keep');
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=15' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'scores', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of score checks in a minute. Give it a moment.' }, 429);
  const now = Date.now();
  // stale while revalidate: a copy under 15 minutes old answers at once (a first load never waits on a slow feed) and the feed is asked again behind it;
  // an older one is only the fallback below, because a live score that old is wrong
  if (cache && waitUntil) { try { const old = await cache.match(keep); if (old) { const o = await old.json(); if (now - Date.parse(o.at) < 900000 && !(o.games || []).some((g) => g.state === 'live')) {
    waitUntil(lookScores(ask, fetchFn, now).then(async (fresh) => { if (fresh.ok) { const b = { ...fresh, league: ask.league.id, view: ask.view, ...(ask.day ? { date: ask.day, span: ask.span } : {}), at: new Date().toISOString() }; await cache.put(key, new Response(JSON.stringify(b), { headers: { 'cache-control': 'max-age=' + ttlFor(ask.view, b, ask.day ? shiftDay(ask.day, (ask.span || 1) - 1) : ymd(new Date()), Date.now()) } })); await cache.put(keep, new Response(JSON.stringify(b), { headers: { 'cache-control': 'max-age=' + KEEP } })); } }).catch(() => {}));
    return json({ ...o, stale: true, revalidating: true }, 200, { 'cache-control': 'no-store' }); } } } catch (_) {} }
  const out = await lookScores(ask, fetchFn, now);
  if (!out.ok) {
    if (cache) { try { const old = await cache.match(keep); if (old) { const o = await old.json(); return json({ ...o, stale: true }, 200, { 'cache-control': 'no-store' }); } } catch (_) {} }
    return json({ ok: false, kind: 'away', say: 'The score feed did not answer just now.' }, 502, { 'cache-control': 'no-store' });
  }
  const body = { ...out, league: ask.league.id, view: ask.view, ...(ask.day ? { date: ask.day, span: ask.span } : {}), at: new Date(now).toISOString() };
  if (cache) {
    const ttl = ttlFor(ask.view, body, ask.day ? shiftDay(ask.day, (ask.span || 1) - 1) : ymd(new Date(now)), now);
    try { await cache.put(key, new Response(JSON.stringify(body), { headers: { 'cache-control': 'max-age=' + ttl } })); await cache.put(keep, new Response(JSON.stringify(body), { headers: { 'cache-control': 'max-age=' + KEEP } })); } catch (_) {}
  }
  return json(body, 200, { 'cache-control': 'public, max-age=15' });
}
