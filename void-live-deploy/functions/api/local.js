// The local TV and radio page's own API (void-live-deploy/local/, lib/local-media.js). GET only, one route, three asks:
//   (nothing)                                        -> { ok, place }     where this connection is, roughly (request.cf, city level)
//   ?place=<name>                                    -> { ok, place }     a place someone typed, found by Open-Meteo's free geocoder (no key)
//   ?lat=<n>&lon=<n>&cc=<CC>[&region=<name>]         -> { ok, stations }  the radio stations near a place, from Radio Browser
//   ?world[&country=<CC>][&tag=<t>][&q=<name>][&offset=<n>] -> { ok, stations, next }  any other station that plays in the page, by country,
//                                                       topic (a Radio Browser tag) or name, most voted first, WORLD_PAGE at a time
// TV needs no call: the page reads the country's table from /local/tv/<CC>.json (tools/local-tv.mjs) and picks the stations itself.
// Audio and video are never fetched or proxied here: a stream's address goes to the page and the browser plays it from the station.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server ask Open-Meteo's geocoder for one place name of at most 60 letters, spaces and a few marks, or ask Radio Browser for
//     the stations near one point (two numbers rounded to a tenth of a degree), in one two-letter country and one region name of at most 60
//     letters: the hosts and paths are fixed here, the caller picks no host, path or header; or for one page (a fixed size, an offset of at
//     most WORLD_MAX) of stations in one two-letter country, one tag and one name of at most 40 and 60 letters;
//   - spend those free services' allowance: answers are kept on the edge (a place a day, a point's stations 30 minutes), a miss costs at most
//     three calls, and the caller has 20 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - learn its own connection's coarse place (the no-input ask), which is never cached, so one visitor's place is never served to another.
// No model, no token, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';
import { mergeRadio, radioRow, placeFromCf, placeFromGeocoder, placeTries, pickPlace, MAX_RADIO, RADIO_KM } from '../../lib/local-media.js';

export const RL_MAX = 20, PLACE_TTL = 86400, RADIO_TTL = 1800, TIMEOUT_MS = 8000, WORLD_PAGE = 50, WORLD_MAX = 2000;
export const RADIO_HOSTS = Object.freeze(['de1.api.radio-browser.info', 'all.api.radio-browser.info']);
const UA = 'VerseBot/1.0 (+https://a-to-mind.com/local/)';
const NAME = /^[\p{L}\p{M}\p{N}\s.,'’()-]{1,60}$/u, TAG = /^[\p{L}\p{M}\p{N} &'-]{1,40}$/u;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });

/** what a request asks: { kind: 'here' } | { kind: 'place', name } | { kind: 'radio', lat, lon, cc, region }
 *  | { kind: 'world', country, tag, q, offset } | null. Pure. */
export function askIn(url) {
  const p = new URL(url).searchParams, get = (k) => String(p.get(k) || '').replace(/\s+/g, ' ').trim();
  if (p.has('world')) {
    const country = get('country').toUpperCase(), tag = get('tag').toLowerCase(), q = get('q'), off = get('offset') || '0';
    if (country && !/^[A-Z]{2}$/.test(country)) return null; if (tag && !TAG.test(tag)) return null; if (q && !NAME.test(q)) return null;
    if (!/^\d{1,4}$/.test(off) || +off > WORLD_MAX || +off % WORLD_PAGE) return null;
    return { kind: 'world', country, tag, q, offset: +off };
  }
  if (p.has('place')) { const n = get('place'); return NAME.test(n) ? { kind: 'place', name: n } : null; }
  if (p.has('lat') || p.has('lon')) {
    const lat = Number(get('lat')), lon = Number(get('lon')), cc = get('cc').toUpperCase(), region = get('region');
    if (!get('lat') || !get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    if (cc && !/^[A-Z]{2}$/.test(cc)) return null; if (region && !NAME.test(region)) return null;
    return { kind: 'radio', lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, cc, region };
  }
  return [...p.keys()].length ? null : { kind: 'here' };
}
/** the Radio Browser searches for a point: by distance, and (with a country and region) every station that names the region. Pure. */
export function radioPaths({ lat, lon, cc, region }) {
  const base = '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=' + MAX_RADIO;
  const out = [base + '&geo_lat=' + lat + '&geo_long=' + lon + '&geo_distance=' + RADIO_KM * 1000];
  if (cc && region) out.push(base + '&countrycode=' + cc + '&state=' + encodeURIComponent(region));
  return out;
}
/** the Radio Browser search for one page of the world list, most voted first. Pure. */
export function worldPath({ country, tag, q, offset }) {
  let out = '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=' + WORLD_PAGE + '&offset=' + offset;
  if (country) out += '&countrycode=' + country; if (tag) out += '&tag=' + encodeURIComponent(tag) + '&tagExact=true'; if (q) out += '&name=' + encodeURIComponent(q);
  return out;
}
async function getJson(url, fetchFn) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { const r = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': UA } }); if (!r.ok) throw new Error('status ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
/** one Radio Browser search, tried on each host in turn; null when none answered. */
async function radioSearch(path, fetchFn) {
  for (const h of RADIO_HOSTS) { try { const j = await getJson('https://' + h + path, fetchFn); if (Array.isArray(j)) return j; } catch (_) {} }
  return null;
}
/** the stations near a point: { ok, stations } or { ok: false, kind: 'away' }. */
export async function lookRadio(ask, fetchFn = fetch) {
  const lists = await Promise.all(radioPaths(ask).map((p) => radioSearch(p, fetchFn)));
  if (lists.every((l) => l == null)) return { ok: false, kind: 'away' };
  return { ok: true, stations: mergeRadio(...lists) };
}
/** one page of the world list: { ok, stations, next } (only stations that play in the page; next is null on the last page) or { ok: false }. */
export async function lookWorld(ask, fetchFn = fetch) {
  const list = await radioSearch(worldPath(ask), fetchFn);
  if (list == null) return { ok: false, kind: 'away' };
  const seen = new Set(), stations = [];
  for (const s of list) { const r = radioRow(s); if (!r || !r.play || seen.has(r.id)) continue; seen.add(r.id); stations.push(r); }
  const next = list.length >= WORLD_PAGE && ask.offset + WORLD_PAGE <= WORLD_MAX ? ask.offset + WORLD_PAGE : null;
  return { ok: true, stations, next };
}
/** a typed place: { ok, place } or { ok: false, kind: 'missing' | 'away' }. Tries the whole name, then the town with the rest as its region or
 *  country (placeTries: "Lufkin Texas" -> Lufkin in Texas), at most 3 geocoder calls, stopping at the first match. */
export async function lookPlace(name, fetchFn = fetch) {
  let answered = false;
  for (const t of placeTries(name)) {
    let g; try { g = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=' + (t.hint ? 10 : 1) + '&language=en&name=' + encodeURIComponent(t.q), fetchFn); answered = true; } catch (_) { continue; }
    const place = placeFromGeocoder(pickPlace(g && g.results, t.hint)); if (place) return { ok: true, place };
  }
  return { ok: false, kind: answered ? 'missing' : 'away' };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const ask = askIn(request.url);
  if (!ask) return json({ ok: false, kind: 'bad', say: 'Ask with nothing, a place name (?place=Boston), a point (?lat=42.4&lon=-71.1&cc=US) or the world list (?world&country=FR&tag=news).' }, 400);
  if (ask.kind === 'here') {
    const place = placeFromCf(request.cf);
    return json(place ? { ok: true, place, from: 'connection' } : { ok: false, kind: 'unknown', say: 'Your connection does not say where it is. Type a town or city.' }, 200, { 'cache-control': 'private, no-store' });
  }
  const u = new URL(request.url), id = ask.kind === 'place' ? 'place/' + encodeURIComponent(ask.name.toLowerCase())
    : ask.kind === 'world' ? 'world/' + ask.country + ',' + encodeURIComponent(ask.tag) + ',' + encodeURIComponent(ask.q.toLowerCase()) + ',' + ask.offset
      : 'radio/' + ask.lat + ',' + ask.lon + ',' + ask.cc + ',' + encodeURIComponent(ask.region.toLowerCase());
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-local/' + id);
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=300' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'local', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of places in a minute. Give me a moment and ask again.' }, 429);
  const out = ask.kind === 'place' ? await lookPlace(ask.name, fetchFn) : ask.kind === 'world' ? await lookWorld(ask, fetchFn) : await lookRadio(ask, fetchFn);
  if (!out.ok) return json({ ...out, say: out.kind === 'missing' ? 'No place called "' + ask.name + '" was found.' : 'The station directory did not answer just now.' }, out.kind === 'missing' ? 404 : 502, { 'cache-control': 'no-store' });
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + (ask.kind === 'place' ? PLACE_TTL : RADIO_TTL) } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'public, max-age=300' });
}
