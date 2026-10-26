// The maps floor's working parts (Google Maps; /maps/ and its lane pages): the link that holds a place or a route, coordinates read in any common
// form, distances, the place search (OpenStreetMap's Nominatim) and the router (the FOSSGIS OSRM demo servers on OpenStreetMap data) read and spoken,
// saved places, GPX and GeoJSON out and in, and the same place or route opened on the big map sites. Pure: every network call is built here and made
// by lib/maps-ui.js, one a second at most (Nominatim's and the demo router's usage policies), and every answer is kept on the device so the same
// question is never asked twice. Tests: tools/maps.test.mjs.

/** the free services the pages use, each named with its terms on the page */
export const STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap: free, no key, no limits; attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"
export const NOMINATIM = 'https://nominatim.openstreetmap.org/';
export const ROUTERS = Object.freeze({ car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/', bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving/', foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' });
export const ELEVATION = 'https://api.open-meteo.com/v1/elevation';
export const MODES = ['car', 'bike', 'foot'];
export const ATTRIBUTION = 'OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors';

const num = (x) => (typeof x === 'number' ? x : parseFloat(x));
const okLat = (x) => Number.isFinite(x) && Math.abs(x) <= 90, okLon = (x) => Number.isFinite(x) && Math.abs(x) <= 180;
const round = (x, d = 5) => Math.round(x * 10 ** d) / 10 ** d;
/** a place { lat, lon } when both are in range, else null. Pure. */
export const pt = (lat, lon, name) => { lat = num(lat); lon = num(lon); return okLat(lat) && okLon(lon) ? { lat: round(lat, 6), lon: round(lon, 6), ...(name ? { name: String(name).slice(0, 120) } : {}) } : null; };

/** coordinates read from what people paste: "38.7223, -9.1393", "38.7223 N 9.1393 W", 38°43'20"N 9°8'21"W, geo:38.7,-9.1, a Google Maps link (@lat,lon or
 *  ?q=lat,lon), an OpenStreetMap link (#map=z/lat/lon or mlat/mlon), an Apple Maps link (ll=). null when it is not a coordinate. Pure. */
export function parseCoords(text) {
  const s = String(text || '').trim(); if (!s || s.length > 300) return null;
  let m = /[#&]map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(s); if (m) return pt(m[1], m[2]);
  m = /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/.exec(s); if (m) return pt(m[1], m[2]);
  m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$)/.exec(s); if (m) return pt(m[1], m[2]);
  m = /[?&](?:q|query|ll|sll|daddr|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i.exec(s); if (m) return pt(m[1], m[2]);
  m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(s); if (m) return pt(m[1], m[2]);
  // degrees, minutes and seconds, or decimal degrees with N/S/E/W letters
  const part = String.raw`(\d{1,3}(?:[.,]\d+)?)\s*[°º d]?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′m]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|''|s)\s*)?`;
  const re = new RegExp('^([NS])?\\s*' + part + '([NS])?\\s*[,;/ ]?\\s*([EWO])?\\s*' + part + '([EWO])?$', 'i');
  m = re.exec(s.replace(/\s+/g, ' '));
  if (m && (m[1] || m[5]) && (m[6] || m[10])) {
    const dec = (d, mi, se) => num(String(d).replace(',', '.')) + (mi ? num(String(mi).replace(',', '.')) / 60 : 0) + (se ? num(String(se).replace(',', '.')) / 3600 : 0);
    let lat = dec(m[2], m[3], m[4]), lon = dec(m[7], m[8], m[9]);
    if (/s/i.test(m[1] || m[5])) lat = -lat; if (/w/i.test(m[6] || m[10])) lon = -lon;
    return pt(lat, lon);
  }
  m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s); if (m) return pt(m[1], m[2]);
  return null;
}
/** degrees, minutes and seconds: 38°43′20.3″N 9°08′21.5″W. Pure. */
export function toDms(lat, lon) {
  const one = (v, pos, neg) => { const a = Math.abs(v); let d = Math.floor(a), mi = Math.floor((a - d) * 60), se = round(((a - d) * 60 - mi) * 60, 1); if (se >= 60) { se = 0; mi += 1; } if (mi >= 60) { mi = 0; d += 1; } return d + '°' + String(mi).padStart(2, '0') + '′' + se.toFixed(1).padStart(4, '0') + '″' + (v < 0 ? neg : pos); };
  return one(lat, 'N', 'S') + ' ' + one(lon, 'E', 'W');
}
/** decimal degrees, 5 places (about a metre). Pure. */
export const fmtLatLon = (lat, lon) => lat.toFixed(5) + ', ' + lon.toFixed(5);

/** the great-circle distance in km. Pure. */
export function haversine(a, b) {
  const R = 6371.0088, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** the length of a path of points in km. Pure. */
export const pathKm = (pts) => pts.reduce((s, p, i) => (i ? s + haversine(pts[i - 1], p) : 0), 0);
/** the area of a closed polygon of points in km² (spherical excess on the WGS84 mean radius; good to well under 1% for a town). Pure. */
export function areaKm2(pts) {
  if (!pts || pts.length < 3) return 0; const R = 6371.0088, r = Math.PI / 180; let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += (b.lon - a.lon) * r * (2 + Math.sin(a.lat * r) + Math.sin(b.lat * r)); }
  return Math.abs(s * R * R / 2);
}
/** a circle of `km` around a point as a closed ring of [lon, lat] (for drawing). Pure. */
export function circleRing(c, km, n = 72) {
  const R = 6371.0088, d = km / R, la = c.lat * Math.PI / 180, lo = c.lon * Math.PI / 180, out = [];
  for (let i = 0; i <= n; i++) { const br = 2 * Math.PI * i / n, lat = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br)), lon = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat)); out.push([round(((lon * 180 / Math.PI + 540) % 360) - 180, 6), round(lat * 180 / Math.PI, 6)]); }
  return out;
}
/** 12.3 km · 7.6 mi (a distance in both, metres under a kilometre). Pure. */
export function fmtKm(km, de = false) {
  const n = (x, d) => x.toLocaleString(de ? 'de-DE' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (km < 1) return n(Math.round(km * 1000), 0) + ' m · ' + n(Math.round(km * 3280.84), 0) + ' ft';
  return n(km, km < 10 ? 2 : km < 100 ? 1 : 0) + ' km · ' + n(km * 0.621371, km < 10 ? 2 : km < 100 ? 1 : 0) + ' mi';
}
/** 1 h 05 min, or 12 min. Pure. */
export function fmtMin(min) { min = Math.max(0, Math.round(min)); if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return h + ' h ' + String(m).padStart(2, '0') + ' min'; }

// ---------- the link ----------
/** what a maps link holds: q (a search), ll (the place), z (zoom), name, from, to, mode, r (radius km), pts (a path of lat,lon;lat,lon). Pure. */
export function readState(search) {
  const u = new URLSearchParams(String(search || '').replace(/^\?/, '')), s = {};
  const q = (u.get('q') || '').trim().slice(0, 200); if (q) s.q = q;
  const ll = u.get('ll') ? parseCoords(u.get('ll')) : null; if (ll) s.ll = ll;
  const z = num(u.get('z')); if (Number.isFinite(z) && z >= 0 && z <= 20) s.z = Math.round(z * 10) / 10;
  const name = (u.get('name') || '').trim().slice(0, 120); if (name) s.name = name;
  for (const k of ['from', 'to']) { const v = (u.get(k) || '').trim().slice(0, 200); if (v) s[k] = v; }
  const via = u.getAll('via').map((v) => v.trim().slice(0, 200)).filter(Boolean).slice(0, 8); if (via.length) s.via = via;
  const mode = u.get('mode'); if (MODES.includes(mode)) s.mode = mode;
  const r = num(u.get('r')); if (Number.isFinite(r) && r > 0 && r <= 20000) s.r = r;
  const pts = (u.get('pts') || '').split(';').map((x) => parseCoords(x)).filter(Boolean).slice(0, 200); if (pts.length) s.pts = pts;
  const lang = u.get('lang'); if (lang === 'de' || lang === 'en') s.lang = lang;
  return s;
}
/** the link for a state, on a page's path. Pure. */
export function stateLink(path, s, origin = 'https://a-to-mind.com') {
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q); if (s.ll) u.set('ll', s.ll.lat.toFixed(5) + ',' + s.ll.lon.toFixed(5)); if (s.z != null) u.set('z', String(s.z)); if (s.name) u.set('name', s.name);
  if (s.from) u.set('from', s.from); for (const v of s.via || []) u.append('via', v); if (s.to) u.set('to', s.to); if (s.mode && s.mode !== 'car') u.set('mode', s.mode);
  if (s.r) u.set('r', String(s.r)); if (s.pts && s.pts.length) u.set('pts', s.pts.map((p) => p.lat.toFixed(5) + ',' + p.lon.toFixed(5)).join(';'));
  const qs = u.toString().replace(/%2C/g, ',').replace(/%3B/g, ';'); return origin + path + (qs ? '?' + qs : '');
}

// ---------- place search: Nominatim ----------
/** the search address: on submit only (the policy asks for no search-as-you-type), the language of the page, a few results with the address parts. Pure. */
export const searchUrl = (q, lang = 'en', near = null) => NOMINATIM + 'search?format=jsonv2&addressdetails=1&limit=8&accept-language=' + lang + '&q=' + encodeURIComponent(String(q).trim().slice(0, 200)) + (near ? '&viewbox=' + [near.lon - 1, near.lat + 1, near.lon + 1, near.lat - 1].map((x) => x.toFixed(3)).join(',') : '');
/** what is at a point: one reverse lookup. Pure. */
export const reverseUrl = (p, lang = 'en', zoom = 18) => NOMINATIM + 'reverse?format=jsonv2&addressdetails=1&zoom=' + zoom + '&accept-language=' + lang + '&lat=' + p.lat.toFixed(6) + '&lon=' + p.lon.toFixed(6);
const KIND = (r) => String(r.type === 'yes' ? r.category || r.class || '' : r.type || r.category || r.class || '').replace(/_/g, ' ');
/** one place from a Nominatim answer: its short name, the address under it, its kind, the point and the box to fit. Pure. */
export function placeOf(r) {
  if (!r) return null; const p = pt(r.lat, r.lon); if (!p) return null;
  const a = r.address || {}, full = String(r.display_name || '');
  const name = String(r.name || a.attraction || a.amenity || a.shop || a.tourism || a.building || a.road || a.village || a.town || a.city || full.split(',')[0] || '').trim();
  const where = [a.house_number && a.road ? a.road + ' ' + a.house_number : a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village || a.municipality, a.state, a.country].filter((x, i, l) => x && x !== name && l.indexOf(x) === i).join(', ');
  const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(num) : null; // [south, north, west, east]
  return { ...p, name: name.slice(0, 120) || full.slice(0, 120), where: (where || full).slice(0, 200), full: full.slice(0, 300), kind: KIND(r).slice(0, 40), ...(bb && bb.every(Number.isFinite) ? { bbox: [bb[2], bb[0], bb[3], bb[1]] } : {}), ...(r.osm_type && r.osm_id ? { osm: String(r.osm_type)[0].toUpperCase() + r.osm_id } : {}) };
}
/** the places in a search answer. Pure. */
export const placesOf = (json) => (Array.isArray(json) ? json.map(placeOf).filter(Boolean) : []);

// ---------- directions: OSRM ----------
/** the router's address for points in order (two or more) and a mode: full route geometry as GeoJSON, the turn by turn steps, alternatives for two points. Pure. */
export function routeUrl(points, mode = 'car') {
  const base = ROUTERS[mode] || ROUTERS.car;
  return base + points.map((p) => p.lon.toFixed(6) + ',' + p.lat.toFixed(6)).join(';') + '?overview=full&geometries=geojson&steps=true' + (points.length === 2 ? '&alternatives=true' : '');
}
const DIRS = { en: { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right', 'sharp left': 'sharp left', 'sharp right': 'sharp right', straight: 'straight on', uturn: 'a U-turn' },
  de: { left: 'links', right: 'rechts', 'slight left': 'leicht links', 'slight right': 'leicht rechts', 'sharp left': 'scharf links', 'sharp right': 'scharf rechts', straight: 'geradeaus', uturn: 'wenden' } };
/** one step said in plain words, English or German: "Turn left onto Rua Augusta". Pure. */
export function stepText(step, de = false) {
  const m = (step && step.maneuver) || {}, type = m.type || '', mod = m.modifier || '', road = String(step.name || step.ref || '').trim(), L = de ? DIRS.de : DIRS.en, dir = L[mod] || mod;
  const onto = road ? (de ? ' auf ' + road : ' onto ' + road) : '', on = road ? (de ? ' auf ' + road : ' on ' + road) : '';
  if (de) {
    if (type === 'depart') return 'Starten Sie' + (road ? ' auf ' + road : '') + (mod && mod !== 'straight' ? ' Richtung ' + dir : '');
    if (type === 'arrive') return 'Sie sind am Ziel' + (mod === 'left' ? ', es liegt links' : mod === 'right' ? ', es liegt rechts' : '');
    if (type === 'roundabout' || type === 'rotary') return 'Im Kreisverkehr die ' + (m.exit || 1) + '. Ausfahrt nehmen' + onto;
    if (type === 'merge') return 'Einfädeln' + onto;
    if (type === 'fork') return 'An der Gabelung ' + dir + ' halten' + onto;
    if (type === 'on ramp') return 'Auffahrt ' + dir + ' nehmen' + onto;
    if (type === 'off ramp') return 'Ausfahrt ' + dir + ' nehmen' + onto;
    if (type === 'end of road') return 'Am Ende der Straße ' + dir + ' abbiegen' + onto;
    if (mod === 'uturn') return 'Wenden' + on;
    if (type === 'continue' || type === 'new name' || mod === 'straight') return 'Weiter ' + (mod && mod !== 'straight' ? dir : 'geradeaus') + on;
    return (dir ? dir.charAt(0).toUpperCase() + dir.slice(1) + ' abbiegen' : 'Weiter') + onto;
  }
  if (type === 'depart') return 'Head off' + (road ? ' on ' + road : '') + (mod && mod !== 'straight' ? ', bearing ' + dir : '');
  if (type === 'arrive') return 'Arrive' + (mod === 'left' ? ': it is on the left' : mod === 'right' ? ': it is on the right' : '');
  if (type === 'roundabout' || type === 'rotary') return 'At the roundabout take exit ' + (m.exit || 1) + onto;
  if (type === 'merge') return 'Merge' + (mod && mod !== 'straight' ? ' ' + dir : '') + onto;
  if (type === 'fork') return 'Keep ' + dir + ' at the fork' + onto;
  if (type === 'on ramp') return 'Take the ramp ' + dir + onto;
  if (type === 'off ramp') return 'Take the exit ' + dir + onto;
  if (type === 'end of road') return 'At the end of the road turn ' + dir + onto;
  if (mod === 'uturn') return 'Make a U-turn' + on;
  if (type === 'continue' || type === 'new name' || mod === 'straight') return 'Continue ' + (mod && mod !== 'straight' ? dir : 'straight') + on;
  return 'Turn ' + (dir || 'ahead') + onto;
}
/** the router's answer read: each route's km, minutes, its line ([lon, lat] pairs) and its steps in words. null when there is no route. Pure. */
export function routesOf(json, de = false) {
  if (!json || json.code !== 'Ok' || !Array.isArray(json.routes) || !json.routes.length) return null;
  return json.routes.slice(0, 3).map((r) => ({ km: r.distance / 1000, min: r.duration / 60, line: (r.geometry && r.geometry.coordinates) || [],
    steps: (r.legs || []).flatMap((l) => (l.steps || []).map((s) => ({ text: stepText(s, de), km: (s.distance || 0) / 1000, at: s.maneuver && s.maneuver.location ? { lon: s.maneuver.location[0], lat: s.maneuver.location[1] } : null }))) }));
}

// ---------- the big map sites: the same place or route there (use the sites as well as beat them) ----------
const G_MODE = { car: 'driving', bike: 'bicycling', foot: 'walking' }, OSM_MODE = { car: 'fossgis_osrm_car', bike: 'fossgis_osrm_bike', foot: 'fossgis_osrm_foot' }, A_MODE = { car: 'd', bike: 'c', foot: 'w' };
const ll = (p) => p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
/** links that open a place on Google Maps, OpenStreetMap and Apple Maps, and the device's own maps app (geo:). Pure. */
export function placeLinks(p, z = 16) {
  return [
    { id: 'google', name: 'Google Maps', url: 'https://www.google.com/maps/search/?api=1&query=' + ll(p) },
    { id: 'osm', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(6) + '&mlon=' + p.lon.toFixed(6) + '#map=' + Math.round(z) + '/' + p.lat.toFixed(5) + '/' + p.lon.toFixed(5) },
    { id: 'apple', name: 'Apple Maps', url: 'https://maps.apple.com/?ll=' + ll(p) + (p.name ? '&q=' + encodeURIComponent(p.name) : '') },
    { id: 'geo', name: 'Maps app on this device', url: 'geo:' + ll(p) + (p.name ? '?q=' + ll(p) + '(' + encodeURIComponent(p.name) + ')' : '') },
  ];
}
/** links that open the same route on Google Maps, OpenStreetMap and Apple Maps (Apple takes only the two ends). Pure. */
export function routeLinks(points, mode = 'car') {
  const a = points[0], b = points[points.length - 1], mid = points.slice(1, -1);
  return [
    { id: 'google', name: 'Google Maps', url: 'https://www.google.com/maps/dir/?api=1&origin=' + ll(a) + '&destination=' + ll(b) + (mid.length ? '&waypoints=' + mid.map(ll).join('%7C') : '') + '&travelmode=' + G_MODE[mode] },
    { id: 'osm', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/directions?engine=' + OSM_MODE[mode] + '&route=' + points.map((p) => p.lat.toFixed(5) + '%2C' + p.lon.toFixed(5)).join('%3B') },
    { id: 'apple', name: 'Apple Maps', url: 'https://maps.apple.com/?saddr=' + ll(a) + '&daddr=' + ll(b) + '&dirflg=' + A_MODE[mode] },
  ];
}
/** Google Maps with its traffic layer on, at a place: Verse has no live traffic of its own (no free source allows it), so the page sends people there. Pure. */
export const trafficLink = (p, z = 13) => 'https://www.google.com/maps/@' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ',' + Math.round(z) + 'z/data=!5m1!1e1';
/** Google Maps directions by public transport (Verse has no timetables). Pure. */
export const transitLink = (a, b) => 'https://www.google.com/maps/dir/?api=1&origin=' + ll(a) + '&destination=' + ll(b) + '&travelmode=transit';

// ---------- saved places, kept on the device ----------
export const SAVED_KEY = 'a2m.maps.saved.v1', CACHE_KEY = 'a2m.maps.cache.v1', RECENT_KEY = 'a2m.maps.recent.v1';
const store0 = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const read = (k, store, fb) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v == null ? fb : v; } catch (_) { return fb; } };
const write = (k, v, store) => { try { store.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
/** the saved places: [{ id, name, lat, lon, note, at }]. */
export function savedPlaces(store = store0()) { const l = read(SAVED_KEY, store, []); return Array.isArray(l) ? l.filter((p) => p && pt(p.lat, p.lon)).slice(0, 500) : []; }
export function savePlace(p, store = store0(), now = Date.now()) {
  const q = pt(p.lat, p.lon); if (!q) return savedPlaces(store); const list = savedPlaces(store);
  const same = list.find((x) => Math.abs(x.lat - q.lat) < 1e-5 && Math.abs(x.lon - q.lon) < 1e-5);
  if (same) { if (p.name) same.name = String(p.name).slice(0, 120); if (p.note != null) same.note = String(p.note).slice(0, 300); }
  else list.unshift({ id: 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6), name: String(p.name || fmtLatLon(q.lat, q.lon)).slice(0, 120), lat: q.lat, lon: q.lon, note: String(p.note || '').slice(0, 300), at: new Date(now).toISOString() });
  write(SAVED_KEY, list.slice(0, 500), store); return savedPlaces(store);
}
export function removePlace(id, store = store0()) { write(SAVED_KEY, savedPlaces(store).filter((p) => p.id !== id), store); return savedPlaces(store); }
export function renamePlace(id, name, store = store0()) { const l = savedPlaces(store); const p = l.find((x) => x.id === id); if (p && String(name || '').trim()) p.name = String(name).trim().slice(0, 120); write(SAVED_KEY, l, store); return savedPlaces(store); }

/** an answer kept on the device for 30 days, the newest 300 (the policies ask for answers to be cached). */
export function cacheGet(key, store = store0(), now = Date.now()) { const c = read(CACHE_KEY, store, {}); const e = c && c[key]; return e && now - e.at < 30 * 864e5 ? e.v : null; }
export function cachePut(key, v, store = store0(), now = Date.now()) {
  const c = read(CACHE_KEY, store, {}) || {}; c[key] = { at: now, v };
  const keys = Object.keys(c); if (keys.length > 300) keys.sort((a, b) => c[a].at - c[b].at).slice(0, keys.length - 300).forEach((k) => delete c[k]);
  if (!write(CACHE_KEY, c, store)) { write(CACHE_KEY, { [key]: { at: now, v } }, store); }
}
/** a gate that lets one call through a second at most per service (Nominatim's and the demo router's limit): wait() resolves when it is this call's turn. */
export function makeGate(gapMs = 1100, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let next = 0; return async () => { const t = now(), at = Math.max(t, next); next = at + gapMs; if (at > t) await sleep(at - t); };
}

// ---------- files ----------
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** a GPX 1.1 file: places as waypoints, a line (route or path) as a track. Pure. */
export function gpxOf({ places = [], line = [], name = 'Verse map' } = {}) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Verse (a-to-mind.com)" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + xesc(name) + '</name></metadata>\n'
    + places.map((p) => '<wpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lon.toFixed(6) + '">' + (p.ele != null ? '<ele>' + p.ele + '</ele>' : '') + '<name>' + xesc(p.name || '') + '</name>' + (p.note ? '<desc>' + xesc(p.note) + '</desc>' : '') + '</wpt>\n').join('')
    + (line.length ? '<trk><name>' + xesc(name) + '</name><trkseg>' + line.map((c) => '<trkpt lat="' + (+c[1]).toFixed(6) + '" lon="' + (+c[0]).toFixed(6) + '">' + (c[2] != null ? '<ele>' + c[2] + '</ele>' : '') + '</trkpt>').join('') + '</trkseg></trk>\n' : '') + '</gpx>\n';
}
/** a GeoJSON FeatureCollection of places (and a line). Pure. */
export function geojsonOf({ places = [], line = [] } = {}) {
  return JSON.stringify({ type: 'FeatureCollection', features: [...places.map((p) => ({ type: 'Feature', properties: { name: p.name || '', ...(p.note ? { note: p.note } : {}) }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })), ...(line.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }] : [])] }, null, 1);
}
/** places and a line read back from a GPX or GeoJSON file's text (waypoints, route points, track points). Pure, no DOM. */
export function readGeoFile(text) {
  const s = String(text || ''), places = [], line = [];
  if (/^\s*[{[]/.test(s)) {
    let j = null; try { j = JSON.parse(s); } catch (_) { return { places, line }; }
    const feats = j && j.type === 'FeatureCollection' ? j.features : j && j.type === 'Feature' ? [j] : [];
    for (const f of feats || []) { const g = f && f.geometry; if (!g) continue; const nm = f.properties && (f.properties.name || f.properties.title);
      if (g.type === 'Point') { const p = pt(g.coordinates[1], g.coordinates[0], nm); if (p) places.push(p); }
      else if (g.type === 'LineString') for (const c of g.coordinates) { if (pt(c[1], c[0])) line.push([+c[0], +c[1], ...(c[2] != null ? [+c[2]] : [])]); }
      else if (g.type === 'MultiLineString') for (const l of g.coordinates) for (const c of l) if (pt(c[1], c[0])) line.push([+c[0], +c[1]]); }
    return { places: places.slice(0, 500), line: line.slice(0, 20000) };
  }
  const attr = (tag, a) => { const m = new RegExp('\\b' + a + '\\s*=\\s*"([^"]*)"').exec(tag); return m ? m[1] : null; };
  const un = (x) => String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
  for (const m of s.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>|<wpt\b([^>]*)\/>/g)) { const tag = m[1] || m[3], body = m[2] || '', nm = /<name>([\s\S]*?)<\/name>/.exec(body); const p = pt(attr(tag, 'lat'), attr(tag, 'lon'), nm ? un(nm[1]) : ''); if (p) places.push(p); }
  for (const m of s.matchAll(/<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g)) { const lat = attr(m[1], 'lat'), lon = attr(m[1], 'lon'); if (pt(lat, lon)) { const e = /<ele>([-\d.]+)<\/ele>/.exec(m[2] || ''); line.push([+lon, +lat, ...(e ? [+e[1]] : [])]); } }
  return { places: places.slice(0, 500), line: line.slice(0, 20000) };
}
/** the elevation service's address for up to 100 points (Open-Meteo, free, no key; Copernicus DEM, 90 m). Pure. */
export const elevationUrl = (pts) => ELEVATION + '?latitude=' + pts.slice(0, 100).map((p) => p.lat.toFixed(5)).join(',') + '&longitude=' + pts.slice(0, 100).map((p) => p.lon.toFixed(5)).join(',');
/** up to n points spread evenly along a line of [lon, lat] (for an elevation profile). Pure. */
export function sampleLine(line, n = 100) { if (line.length <= n) return line.map((c) => ({ lon: c[0], lat: c[1] })); const out = []; for (let i = 0; i < n; i++) { const c = line[Math.round(i * (line.length - 1) / (n - 1))]; out.push({ lon: c[0], lat: c[1] }); } return out; }
/** climb and descent in metres over a list of heights (a 2 m dead band so noise does not count). Pure. */
export function climb(heights) { let up = 0, down = 0, last = null; for (const h of heights) { if (!Number.isFinite(h)) continue; if (last == null) { last = h; continue; } const d = h - last; if (Math.abs(d) >= 2) { if (d > 0) up += d; else down -= d; last = h; } } return { up: Math.round(up), down: Math.round(down) }; }
