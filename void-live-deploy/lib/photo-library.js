// Verse Photos (owner, 2026-10-19: "Verse should become good at storing pictures ... better than facebook eventually"). Step 1: a photo library
// that lives on this device. The pure part is here: what a photo says about itself (when it was taken, where, which way up), the days and months
// a library falls into, the places it was taken, and search by date, place or album. No network and no model; the page keeps the pictures in
// IndexedDB (skills/photos.js). A photo is shared without its location (lib/safety.js stripMeta).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** when, where and which way up, from a JPEG's EXIF: { taken: 'YYYY-MM-DDTHH:MM:SS' | null, lat, lon (numbers or null), orientation (1-8) }.
 *  Anything it cannot read is null, never a guess. Pure. */
export function readExif(input) {
  const out = { taken: null, lat: null, lon: null, orientation: 1 };
  const b = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xda || m === 0xd9 || len < 2) break; // the picture data starts: no metadata after it
    if (m === 0xe1 && i + 10 <= b.length && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') { tiff(b, i + 10, Math.min(b.length, i + 2 + len), out); break; }
    i += 2 + len;
  }
  return out;
}
function tiff(b, t, end, out) {
  if (t + 8 > end) return;
  const le = b[t] === 0x49; // "II" little-endian, "MM" big-endian
  const u16 = (o) => (o + 2 > end ? 0 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (o + 4 > end ? 0 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const entries = (ifd) => { const o = t + ifd, n = u16(o), list = []; for (let k = 0; k < n && k < 400; k++) { const e = o + 2 + k * 12; if (e + 12 > end) break; list.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), at: e + 8 }); } return list; };
  const ascii = (e) => { const o = e.count > 4 ? t + u32(e.at) : e.at; let s = ''; for (let k = 0; k < e.count - 1 && o + k < end; k++) s += String.fromCharCode(b[o + k]); return s; };
  const rationals = (e) => { const o = t + u32(e.at), v = []; for (let k = 0; k < e.count && k < 3; k++) { const d = u32(o + k * 8 + 4); v.push(d ? u32(o + k * 8) / d : NaN); } return v; };
  const ifd0 = entries(u32(t + 4));
  let dateTime = null, exifAt = 0, gpsAt = 0;
  for (const e of ifd0) {
    if (e.tag === 0x0112) out.orientation = Math.min(8, Math.max(1, u16(e.at) || 1));
    else if (e.tag === 0x0132) dateTime = ascii(e);
    else if (e.tag === 0x8769) exifAt = u32(e.at);
    else if (e.tag === 0x8825) gpsAt = u32(e.at);
  }
  let original = null;
  if (exifAt) for (const e of entries(exifAt)) if (e.tag === 0x9003) original = ascii(e);
  out.taken = exifDate(original) || exifDate(dateTime); // a camera that wrote a blank original still has its DateTime
  if (gpsAt) {
    let latRef = 'N', lonRef = 'E', lat = null, lon = null;
    for (const e of entries(gpsAt)) {
      if (e.tag === 1) latRef = String.fromCharCode(b[e.at]);
      else if (e.tag === 3) lonRef = String.fromCharCode(b[e.at]);
      else if (e.tag === 2 && e.count === 3) lat = dms(rationals(e));
      else if (e.tag === 4 && e.count === 3) lon = dms(rationals(e));
    }
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
      out.lat = latRef === 'S' ? -lat : lat; out.lon = lonRef === 'W' ? -lon : lon;
    }
  }
}
const dms = (v) => (v.length === 3 && v.every(Number.isFinite) ? v[0] + v[1] / 60 + v[2] / 3600 : null);
/** "2024:06:15 18:30:05" -> "2024-06-15T18:30:05", null for a blank or impossible date. Pure. */
export function exifDate(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m || m[1] === '0000' || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null;
  return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
}

/** when a photo was taken, for sorting and grouping: its EXIF date, else the file's own date (lastModified, ms). Pure. */
export function whenOf(p) {
  if (p && p.taken) return p.taken;
  const d = p && Number.isFinite(p.fileTime) ? new Date(p.fileTime) : null;
  return d && !isNaN(d) ? d.toISOString().slice(0, 19) : '';
}
/** "Saturday 15 June 2024" for a day, "June 2024" for a month. Pure. */
export function dayLabel(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  if (isNaN(d)) return 'Date unknown';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export const monthLabel = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso)); return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : 'Date unknown'; };

/** the library as days, newest first: [{ key: 'YYYY-MM-DD' | '', label, month, photos: [...] }], photos in a day oldest first. Pure. */
export function byDay(photos) {
  const days = new Map();
  for (const p of photos || []) { const w = whenOf(p), k = w.slice(0, 10); if (!days.has(k)) days.set(k, []); days.get(k).push(p); }
  return [...days.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : b[0].localeCompare(a[0])))
    .map(([key, list]) => ({ key, label: key ? dayLabel(key) : 'Date unknown', month: key ? monthLabel(key) : 'Date unknown', photos: list.slice().sort((x, y) => whenOf(x).localeCompare(whenOf(y))) }));
}

/** a place as a grid cell about a kilometre across, so photos taken in the same spot fall together; '' without a location. Pure. */
export const placeKey = (p) => (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p.lat.toFixed(2) + ',' + p.lon.toFixed(2) : '');
/** how far apart two spots are, in kilometres (equirectangular: plenty for "the same place"). Pure. */
export function kmBetween(a, b) {
  const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
/** the places a library was taken in, most photos first: [{ key, lat, lon, count, first, last }]. A photo within a kilometre of a place joins
 *  it (so two photos a street apart are one place even across a grid line); the place sits where its first photo was taken. Pure. */
export function places(photos, km = 1) {
  const list = [];
  for (const p of photos || []) {
    if (!placeKey(p)) continue;
    const w = whenOf(p);
    let e = list.find((x) => kmBetween(x, p) <= km);
    if (!e) { e = { key: placeKey(p), lat: p.lat, lon: p.lon, count: 0, first: w, last: w }; list.push(e); }
    e.count++; if (w && (!e.first || w < e.first)) e.first = w; if (w > e.last) e.last = w;
  }
  return list.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

/** the photos an ask points at: a year ("2024"), a month ("june", "june 2024"), "this year", "last month", an album's name, or a place key; the words
 *  of the ask that are not a date must match the album, the file name or the caption. [] when nothing matches. Pure. */
export function search(photos, query, now = new Date()) {
  let q = String(query || '').toLowerCase().replace(/[^a-z0-9 ,.-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return (photos || []).slice();
  let year = null, month = null;
  const y = /\b(19|20)\d{2}\b/.exec(q); if (y) { year = y[0]; q = q.replace(y[0], ' '); }
  const mi = MONTHS.findIndex((m) => new RegExp('\\b' + m.toLowerCase().slice(0, 3) + '[a-z]*\\b').test(q));
  if (mi >= 0) { month = String(mi + 1).padStart(2, '0'); q = q.replace(new RegExp('\\b' + MONTHS[mi].toLowerCase().slice(0, 3) + '[a-z]*\\b'), ' '); }
  if (/\bthis year\b/.test(q)) { year = String(now.getUTCFullYear()); q = q.replace('this year', ' '); }
  if (/\blast year\b/.test(q)) { year = String(now.getUTCFullYear() - 1); q = q.replace('last year', ' '); }
  if (/\bthis month\b/.test(q)) { year = String(now.getUTCFullYear()); month = String(now.getUTCMonth() + 1).padStart(2, '0'); q = q.replace('this month', ' '); }
  if (/\blast month\b/.test(q)) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); year = String(d.getUTCFullYear()); month = String(d.getUTCMonth() + 1).padStart(2, '0'); q = q.replace('last month', ' '); }
  const words = q.replace(/\b(?:from|in|of|the|my|photos?|pictures?|pics?|show|me|taken|at|on)\b/g, ' ').split(' ').filter((w) => w.length > 1);
  return (photos || []).filter((p) => {
    const w = whenOf(p);
    if (year && w.slice(0, 4) !== year) return false;
    if (month && w.slice(5, 7) !== month) return false;
    if (!words.length) return !!(year || month);
    const hay = [p.album, p.name, p.caption, placeKey(p)].map((x) => String(x || '').toLowerCase()).join(' ');
    return words.every((x) => hay.includes(x));
  });
}

/** the albums in a library, most photos first: [{ name, count, cover }]. Pure. */
export function albums(photos) {
  const m = new Map();
  for (const p of photos || []) { const a = String(p.album || '').trim(); if (!a) continue; const e = m.get(a) || { name: a, count: 0, cover: p.id }; e.count++; m.set(a, e); }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
/** "1,284 photos · 37 days · 12 places", for the card's header. Pure. */
export function summary(photos) {
  const n = (photos || []).length, d = byDay(photos).filter((x) => x.key).length, pl = places(photos).length;
  const f = (k, one, many) => k.toLocaleString('en-US') + ' ' + (k === 1 ? one : many);
  return [f(n, 'photo', 'photos'), f(d, 'day', 'days'), pl ? f(pl, 'place', 'places') : ''].filter(Boolean).join(' · ');
}
