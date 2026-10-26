// The scores page's search box (void-live-deploy/scores/sports.js): GET /api/sportsearch?q=arsenal -> { ok, teams, events, venues, players }, one box across every sport,
// read from TheSportsDB's free public v1 API with its free test key (https://www.thesportsdb.com/documentation; the key is the public test key, not a secret, and its
// terms ask production use to go to a paid key: so every answer is edge-cached 24 hours and the page names TheSportsDB as the source).
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server ask TheSportsDB (one fixed host, four fixed paths) for a name of 2 to 40 letters, digits, spaces and a few marks: the caller picks no host, path
//     or header, so this is not a proxy;
//   - spend TheSportsDB's free allowance: a repeat is answered from the edge cache for a day, a miss costs four calls, and the caller's own allowance is 15 misses a minute
//     (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read public sports names. Only text fields are passed on (no pictures, no links, no HTML); no model, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';

export const HOST = 'https://www.thesportsdb.com/api/v1/json/123/', TTL = 86400, RL_MAX = 15;
const NAME = /^[\p{L}\p{N} .'’&-]{2,40}$/u;
const t = (v, n = 60) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
/** the plain question a request holds ({ q } letters and spaces only), or null. Pure. */
export const askIn = (url) => { const q = String(new URL(url).searchParams.get('q') || '').replace(/\s+/g, ' ').trim(); return NAME.test(q) ? { q } : null; };
/** TheSportsDB's four answers read into the fields the page shows, text only. Pure. */
export function readAll(teams, events, venues, players) {
  return {
    teams: arr(teams && teams.teams).slice(0, 8).map((x) => ({ id: t(x.idTeam, 12), name: t(x.strTeam), sport: t(x.strSport, 30), league: t(x.strLeague), country: t(x.strCountry, 40), stadium: t(x.strStadium) })).filter((x) => x.name),
    events: arr(events && events.event).slice(0, 8).map((x) => ({ id: t(x.idEvent, 12), name: t(x.strEvent), date: t(x.dateEvent, 10), league: t(x.strLeague), sport: t(x.strSport, 30), home: t(x.strHomeTeam), away: t(x.strAwayTeam), hs: t(x.intHomeScore, 4), as: t(x.intAwayScore, 4) })).filter((x) => x.name),
    venues: arr(venues && venues.venues).slice(0, 8).map((x) => ({ id: t(x.idVenue, 12), name: t(x.strVenue), city: t(x.strLocation), country: t(x.strCountry, 40), capacity: t(x.intCapacity, 10), sport: t(x.strSport, 30) })).filter((x) => x.name),
    players: arr(players && players.player).slice(0, 8).map((x) => ({ id: t(x.idPlayer, 12), name: t(x.strPlayer), team: t(x.strTeam), sport: t(x.strSport, 30), nationality: t(x.strNationality, 40), born: t(x.dateBorn, 10), position: t(x.strPosition, 30) })).filter((x) => x.name),
  };
}
export async function lookSearch(ask, fetchFn = fetch) {
  const get = (path, q) => fetchFn(HOST + path + encodeURIComponent(q), { headers: { accept: 'application/json' }, signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [a, b, c, d] = await Promise.all([get('searchteams.php?t=', ask.q), get('searchevents.php?e=', ask.q.replace(/ /g, '_')), get('searchvenues.php?v=', ask.q), get('searchplayers.php?p=', ask.q)]);
  if (!a && !b && !c && !d) return { ok: false };
  return { ok: true, ...readAll(a, b, c, d), source: 'thesportsdb' };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (!ask) return Response.json({ ok: false, kind: 'missing', say: 'Ask with ?q= and a name of 2 to 40 letters.' }, { status: 400 });
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-sportsearch/' + encodeURIComponent(ask.q.toLowerCase()));
  if (cache) { try { const hit = await cache.match(key); if (hit) return Response.json({ ...(await hit.json()), cached: true }, { headers: { 'cache-control': 'public, max-age=600' } }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'sportsearch', RL_MAX)) return Response.json({ ok: false, kind: 'limited', say: 'That is a lot of searches in a minute. Give it a moment.' }, { status: 429 });
  const out = await lookSearch(ask, fetchFn);
  if (!out.ok) return Response.json({ ok: false, kind: 'away', say: 'The sports database did not answer just now.' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {} }
  return Response.json(out, { headers: { 'cache-control': 'public, max-age=600' } });
}
