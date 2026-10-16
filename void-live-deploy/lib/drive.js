// Drive time between two places, from a live routing service (the rides family's rung out in the world: tools/rides-live.mjs
// asks the same router once a day and keeps the answer as a finding). The public OSRM demo router (router.project-osrm.org) needs
// no key; places given by name are found with Open-Meteo's geocoder (no key, the one the weather card uses). OSRM routes on the
// road network at free-flow speed: no live traffic, which every answer says. Pure, except drive(), which fetches.
export const ROUTER = 'https://router.project-osrm.org/route/v1/driving/';
export const GEOCODER = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=';
export const SERVICE = 'OSRM public demo router (router.project-osrm.org)';

/** a place as given: { lat, lon }, "37.62,-122.38", or a name to look up; null for nothing usable. Pure. */
export function placeOf(p) {
  if (p && typeof p === 'object' && Number.isFinite(+p.lat) && Number.isFinite(+p.lon)) return ok(+p.lat, +p.lon, p.name);
  const s = String(p == null ? '' : p).trim();
  const m = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s);
  if (m) return ok(+m[1], +m[2]);
  return s.length >= 2 && s.length <= 100 ? { name: s.replace(/\s+/g, ' ') } : null;
}
const ok = (lat, lon, name) => (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon, ...(name ? { name: String(name).slice(0, 100) } : {}) } : null);

/** the router's URL for two located places (longitude first, the order OSRM reads). Pure. */
export const routeUrl = (a, b) => ROUTER + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false&alternatives=false&steps=false';

/** the router's answer read: { minutes, km } for a route, or null. Pure. */
export function routeOf(body) {
  const r = body && body.code === 'Ok' && Array.isArray(body.routes) && body.routes[0];
  return r && r.duration > 0 && r.distance > 0 ? { minutes: Math.round(r.duration / 60), km: Math.round(r.distance / 100) / 10 } : null;
}

/** the geocoder's answer read: the first place, or null. Pure. */
export function geoOf(body, asked) {
  const g = body && Array.isArray(body.results) && body.results[0];
  return g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude) ? { lat: g.latitude, lon: g.longitude, name: [g.name, g.admin1, g.country].filter(Boolean).join(', ') || asked } : null;
}

/** from, to -> { ok, from, to, minutes, km, service, note } or { ok: false, error }. fetchFn is the network (a stub in tests). */
export async function drive(from, to, fetchFn = fetch) {
  const a0 = placeOf(from), b0 = placeOf(to);
  if (!a0 || !b0) return { ok: false, error: 'Give two places: names ("San Francisco"), "lat,lon", or { lat, lon }.' };
  const get = async (u) => { const r = await fetchFn(u, { headers: { 'user-agent': 'a2m-void-drive/1.0 (https://a-to-mind.com)', accept: 'application/json' } }); return r.ok ? r.json() : null; };
  const locate = async (p) => (p.lat != null ? p : geoOf(await get(GEOCODER + encodeURIComponent(p.name)).catch(() => null), p.name));
  const [a, b] = await Promise.all([locate(a0), locate(b0)]);
  if (!a || !b) return { ok: false, error: 'I could not find ' + (!a ? '"' + a0.name + '"' : '"' + b0.name + '"') + ' on the map.' };
  const body = await get(routeUrl(a, b)).catch(() => null), r = routeOf(body);
  if (!r) return { ok: false, error: 'The router found no driving route between those places' + (body && body.message ? ' (' + String(body.message).slice(0, 80) + ')' : '') + '.' };
  return { ok: true, from: a, to: b, ...r, service: SERVICE, note: 'free-flow road time: no live traffic' };
}
