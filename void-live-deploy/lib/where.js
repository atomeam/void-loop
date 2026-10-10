/**
 * where — where the visitor is, only as exactly as the sky needs (a degree of latitude moves the sun by a degree).
 * In order: a place they chose (kept in this browser only), the device's location when the browser already has permission
 * (never asks), the coarse location Cloudflare gives the connection (/api/where: city level, rounded to a tenth of a degree), and
 * last the city the time zone names. Nothing here is sent anywhere but Open-Meteo's geocoder, when a place name is typed.
 * Every dependency can be passed in, so tests run it without a browser.
 */
const KEY = 'void.where.v1';
const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } };
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const validPlace = (p) => p && num(p.lat) !== null && num(p.lon) !== null && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

export function savedPlace(store = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { const p = JSON.parse(store.getItem(KEY) || 'null'); return validPlace(p) ? { lat: p.lat, lon: p.lon, name: String(p.name || 'your place').slice(0, 80), tz: typeof p.tz === 'string' ? p.tz.slice(0, 60) : '', source: 'chosen' } : null; } catch (_) { return null; }
}
export function savePlace(p, store = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { if (!p) store.removeItem(KEY); else if (validPlace(p)) store.setItem(KEY, JSON.stringify({ lat: p.lat, lon: p.lon, name: String(p.name || '').slice(0, 80), tz: typeof p.tz === 'string' ? p.tz.slice(0, 60) : '' })); } catch (_) {}
}

// a place by name, through Open-Meteo's geocoder; null when nothing matches
export async function findPlace(name, fetchFn = (typeof fetch !== 'undefined' ? fetch : null)) {
  const q = String(name || '').trim().slice(0, 80); if (!q || !fetchFn) return null;
  try {
    const g = await fetchFn('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(q)).then((r) => r.json());
    const r = g && g.results && g.results[0];
    return r && validPlace({ lat: r.latitude, lon: r.longitude }) ? { lat: r.latitude, lon: r.longitude, name: r.name + (r.country ? ', ' + r.country : ''), tz: typeof r.timezone === 'string' ? r.timezone : '', source: 'chosen' } : null;
  } catch (_) { return null; }
}

export async function whereAmI(dep = {}) {
  const store = dep.store === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : dep.store;
  const fetchFn = dep.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const nav = dep.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const chosen = store && savedPlace(store); if (chosen) return chosen;
  // the device, only if the browser already allows it: asking would put a prompt in front of a calm page
  try {
    const granted = nav && nav.permissions && nav.geolocation && (await nav.permissions.query({ name: 'geolocation' })).state === 'granted';
    if (granted) {
      const p = await new Promise((res) => nav.geolocation.getCurrentPosition((x) => res(x), () => res(null), { timeout: 6000, maximumAge: 600000 }));
      if (p && validPlace({ lat: p.coords.latitude, lon: p.coords.longitude })) return { lat: Math.round(p.coords.latitude * 10) / 10, lon: Math.round(p.coords.longitude * 10) / 10, name: 'where you are', tz: browserTz(), source: 'device' };
    }
  } catch (_) {}
  if (fetchFn) {
    try {
      const r = await fetchFn('/api/where', { cache: 'no-store' }); const j = r && r.ok ? await r.json() : null;
      if (j && j.ok && validPlace(j)) return { lat: j.lat, lon: j.lon, name: [j.city, j.country].filter(Boolean).join(', ') || 'near you', tz: typeof j.timezone === 'string' ? j.timezone : '', source: 'network' };
    } catch (_) {}
    const tz = dep.timeZone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '') || '';
    const city = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : '';
    const p = city ? await findPlace(city, fetchFn) : null;
    if (p) return { ...p, source: 'timezone' };
  }
  return null;
}

// "51.5° N, 0.1° W"
export const latLonText = (lat, lon) => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
