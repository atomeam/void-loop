// The scores page's search box (void-live-deploy/scores/sports.js): GET /api/sportsearch?q=arsenal -> { ok, teams, events, venues, players }, one box across every sport,
// read from TheSportsDB's free public v1 API with its free test key, and from ESPN's public site search when TheSportsDB gives nothing or errors (each item says which) (https://www.thesportsdb.com/documentation; the key is the public test key, not a secret, and its
// terms ask production use to go to a paid key: so every answer is edge-cached 24 hours and the page names TheSportsDB as the source).
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server ask TheSportsDB (one fixed host, four fixed paths) or ESPN's public search (one fixed host and path) for a name of 2 to 40 letters, digits, spaces and a few marks: the caller picks no host, path
//     or header, so this is not a proxy;
//   - spend TheSportsDB's free allowance: a repeat is answered from the edge cache for a day, a miss costs four calls, and the caller's own allowance is 15 misses a minute
//     (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read public sports names. Only text fields are passed on (no pictures, no links, no HTML); no model, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';
import { ownerOk } from '../../lib/guard.js';

export const HOST = 'https://www.thesportsdb.com/api/v1/json/123/', ESPN_SEARCH = 'https://site.api.espn.com/apis/common/v3/search?limit=10&query=', TTL = 86400, TTL_EMPTY = 600, RL_MAX = 15;
const NAME = /^[\p{L}\p{N} .'’&-]{2,40}$/u;
const t = (v, n = 60) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
/** the plain question a request holds ({ q } letters and spaces only), or null. Pure. */
export const askIn = (url) => { const q = String(new URL(url).searchParams.get('q') || '').replace(/\s+/g, ' ').trim(); return NAME.test(q) ? { q } : null; };
/** TheSportsDB's four answers read into the fields the page shows, text only. Pure. */
export function readAll(teams, events, venues, players) {
  const src = 'TheSportsDB';
  return {
    teams: arr(teams && teams.teams).slice(0, 8).map((x) => ({ id: t(x.idTeam, 12), name: t(x.strTeam), sport: t(x.strSport, 30), league: t(x.strLeague), country: t(x.strCountry, 40), stadium: t(x.strStadium), src })).filter((x) => x.name),
    events: arr(events && events.event).slice(0, 8).map((x) => ({ id: t(x.idEvent, 12), name: t(x.strEvent), date: t(x.dateEvent, 10), league: t(x.strLeague), sport: t(x.strSport, 30), home: t(x.strHomeTeam), away: t(x.strAwayTeam), hs: t(x.intHomeScore, 4), as: t(x.intAwayScore, 4), src })).filter((x) => x.name),
    venues: arr(venues && venues.venues).slice(0, 8).map((x) => ({ id: t(x.idVenue, 12), name: t(x.strVenue), city: t(x.strLocation), country: t(x.strCountry, 40), capacity: t(x.intCapacity, 10), sport: t(x.strSport, 30), src })).filter((x) => x.name),
    players: arr(players && players.player).slice(0, 8).map((x) => ({ id: t(x.idPlayer, 12), name: t(x.strPlayer), team: t(x.strTeam), sport: t(x.strSport, 30), nationality: t(x.strNationality, 40), born: t(x.dateBorn, 10), position: t(x.strPosition, 30), src })).filter((x) => x.name),
  };
}
/** ESPN's public search answer read into teams and players (its other kinds, articles and the like, are left out). The shape is read defensively: items may sit under `items` or under `results[].contents`. Pure. */
export function readEspn(j) {
  const all = [...arr(j && j.items), ...arr(j && j.results).flatMap((r) => arr(r && r.contents))], src = 'ESPN', out = { teams: [], players: [] };
  for (const x of all) {
    const type = String(x && x.type || '').toLowerCase(), name = t(x && (x.displayName || x.name || x.title)); if (!name) continue;
    const league = t(x.league && typeof x.league === 'object' ? x.league.displayName || x.league.name : x.league || x.description || x.subtitle), sport = t(x.sport && typeof x.sport === 'object' ? x.sport.displayName || x.sport.name : x.sport, 30);
    if (type === 'team') out.teams.push({ id: t(x.id, 12), name, sport: sport.replace(/^./, (c) => c.toUpperCase()), league, country: '', stadium: '', src });
    else if (type === 'player' || type === 'athlete') out.players.push({ id: t(x.id, 12), name, team: t(x.subtitle || x.description), sport: sport.replace(/^./, (c) => c.toUpperCase()), nationality: '', born: '', position: '', src });
  }
  out.teams = out.teams.slice(0, 8); out.players = out.players.slice(0, 8); return out;
}
/** both sources' items together: TheSportsDB's first, ESPN's after, one of each name. Pure. */
export function merge(a, b) {
  const one = (xs, ys) => { const seen = new Set(xs.map((x) => x.name.toLowerCase())); return xs.concat(ys.filter((y) => !seen.has(y.name.toLowerCase()))).slice(0, 10); };
  return { teams: one(a.teams, b.teams), events: a.events, venues: a.venues, players: one(a.players, b.players) };
}
/** the answer to one ask: { ok, teams, events, venues, players, sources: { name: status }, source }, or { ok: false, sources } when no source answered at all; report lists each call (for the owner's diag). */
export async function lookSearch(ask, fetchFn = fetch) {
  const report = [], get = async (source, label, url) => {
    try { const r = await fetchFn(url, { headers: { accept: 'application/json' }, signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }); const st = r.status || (r.ok ? 200 : 0);
      if (!r.ok) { report.push({ source, call: label, status: st, count: 0 }); return null; } const j = await r.json(); report.push({ source, call: label, status: st, count: 0 }); return j; }
    catch (e) { report.push({ source, call: label, status: 'error', error: String((e && e.name) || 'error').slice(0, 30), count: 0 }); return null; } };
  const [a, b, c, d, e] = await Promise.all([get('thesportsdb', 'searchteams', HOST + 'searchteams.php?t=' + encodeURIComponent(ask.q)), get('thesportsdb', 'searchevents', HOST + 'searchevents.php?e=' + encodeURIComponent(ask.q.replace(/ /g, '_'))),
    get('thesportsdb', 'searchvenues', HOST + 'searchvenues.php?v=' + encodeURIComponent(ask.q)), get('thesportsdb', 'searchplayers', HOST + 'searchplayers.php?p=' + encodeURIComponent(ask.q)), get('espn', 'search', ESPN_SEARCH + encodeURIComponent(ask.q))]);
  const answered = report.filter((r) => r.status === 200).length; if (!answered) return { ok: false, sources: Object.fromEntries(report.map((r) => [r.source, r.status])), report };
  const sdb = readAll(a, b, c, d), es = readEspn(e), m = merge(sdb, es), n = { thesportsdb: sdb.teams.length + sdb.events.length + sdb.venues.length + sdb.players.length, espn: es.teams.length + es.players.length };
  for (const r of report) r.count = r.source === 'espn' ? n.espn : undefined;
  const sources = {}; for (const r of report) sources[r.source] = sources[r.source] === 200 || r.status === 200 ? 200 : r.status;
  return { ok: true, ...m, sources, found: n, source: [n.thesportsdb ? 'TheSportsDB' : '', n.espn ? 'ESPN' : ''].filter(Boolean).join(' and '), report };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (u.searchParams.get('diag') === '1') { // the owner's view of why a search is empty: each source's status and how many items it gave (never a key)
    if (!(await ownerOk(request, env || {}))) return Response.json({ ok: false, error: 'owner only' }, { status: 401 });
    if (!ask) return Response.json({ ok: false, error: 'add ?q=' }, { status: 400 });
    const out = await lookSearch(ask, fetchFn); return Response.json({ ok: out.ok, q: ask.q, sources: out.sources, found: out.found || null, calls: out.report }, { headers: { 'cache-control': 'no-store' } });
  }
  if (!ask) return Response.json({ ok: false, kind: 'missing', say: 'Ask with ?q= and a name of 2 to 40 letters.' }, { status: 400 });
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-sportsearch/' + encodeURIComponent(ask.q.toLowerCase()));
  if (cache) { try { const hit = await cache.match(key); if (hit) return Response.json({ ...(await hit.json()), cached: true }, { headers: { 'cache-control': 'public, max-age=600' } }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'sportsearch', RL_MAX)) return Response.json({ ok: false, kind: 'limited', say: 'That is a lot of searches in a minute. Give it a moment.' }, { status: 429 });
  const out = await lookSearch(ask, fetchFn);
  if (!out.ok) return Response.json({ ok: false, kind: 'away', say: 'The sports database did not answer just now.', sources: out.sources }, { status: 502, headers: { 'cache-control': 'no-store' } });
  const { report, ...body } = out, any = body.teams.length + body.events.length + body.venues.length + body.players.length > 0; // an answer with items is kept a day; an empty one only ten minutes, so a source that was refused can come back
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(body), { headers: { 'cache-control': 'max-age=' + (any ? TTL : TTL_EMPTY) } })); } catch (_) {} }
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=' + (any ? 600 : 60) } });
}
