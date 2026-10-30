// The weather page's own API (void-live-deploy/weather/, lib/weather.js): GET /api/weather?q=<place> -> { loc, w }: the place found and
// Open-Meteo's forecast for it, in one round trip, kept on the edge for ten minutes per place so a page opens with its forecast at once and a
// burst of visitors (or the tower gate's several loads) asks Open-Meteo once. The page still asks Open-Meteo itself when this does not answer.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server ask Open-Meteo's geocoder for one place name of at most 60 letters, spaces and a few marks (nothing else gets
//     through), then its forecast for the coordinates the geocoder gave: both hosts are fixed here, the caller picks no host, path or header;
//   - spend Open-Meteo's free allowance: a repeat inside ten minutes is answered from the edge cache, a miss costs two calls and the caller's own
//     allowance of 10 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read a forecast. No model, no token, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';
import { placeOf, geocodeUrl, forecastUrl, locOf } from '../../lib/weather.js';

export const RL_MAX = 10, TTL = 600;
const PLACE = /^[\p{L}\p{M}\p{N}\s.,'’-]{1,60}$/u;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** the place a request names, or '' when it is not a plain place name. Pure. */
export function placeIn(url) { const p = placeOf(new URL(url).searchParams.get('q') || ''); return PLACE.test(p) ? p : ''; }
/** the forecast for a place, asked of Open-Meteo: { ok, loc, w } or { ok: false, kind: 'missing' | 'away' }. */
export async function lookWeather(place, fetchFn = fetch) {
  const get = async (u) => { const r = await fetchFn(u, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('status ' + r.status); return r.json(); };
  let g; try { g = await get(geocodeUrl(place)); } catch (_) { return { ok: false, kind: 'away' }; }
  const loc = locOf(g && g.results && g.results[0]); if (!loc) return { ok: false, kind: 'missing' };
  let w; try { w = await get(forecastUrl(loc.lat, loc.lon)); } catch (_) { return { ok: false, kind: 'away' }; }
  if (!w || !w.current || !w.hourly || !w.daily) return { ok: false, kind: 'away' };
  return { ok: true, loc, w };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), place = placeIn(request.url);
  if (!place) return json({ ok: false, kind: 'missing', say: 'Give me a place: a city or town name of up to 60 letters, like Boston.' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-weather/' + encodeURIComponent(place.toLowerCase()));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=120' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'weather', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of places in a minute. Give me a moment and ask again.' }, 429);
  const out = await lookWeather(place, fetchFn);
  if (!out.ok) return json({ ...out, say: out.kind === 'missing' ? 'No place called "' + place + '" was found.' : 'The forecast service did not answer just now.' }, out.kind === 'missing' ? 404 : 502, { 'cache-control': 'no-store' });
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'public, max-age=120' });
}
