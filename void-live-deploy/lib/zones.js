/**
 * zones: the time in any city, a time carried from one zone to another, and a meeting planner across a day (the tower's timeanddate.com floor,
 * a-to-mind.com/time/). Everything comes from the browser's own time-zone data (Intl), so it works offline and asks no service. The zone
 * arithmetic is the stage world clock's own (skills/worldtime.js offsetMin, instantIn, ymdIn, parseClock, gmt, zoneOf), reused, not copied.
 * Pure but for the browser's zone list. Tests: tools/zones.test.mjs.
 */
import { offsetMin, instantIn, ymdIn, parseClock, gmt, zoneOf } from '../skills/worldtime.js';
export { offsetMin, gmt };

// cities people ask for whose zone is named after another city (the zone list itself covers Tokyo, Paris, Sydney and 400 more)
const ALIAS = {
  'beijing': 'Asia/Shanghai', 'shenzhen': 'Asia/Shanghai', 'guangzhou': 'Asia/Shanghai', 'chengdu': 'Asia/Shanghai', 'osaka': 'Asia/Tokyo', 'kyoto': 'Asia/Tokyo',
  'mumbai': 'Asia/Kolkata', 'bombay': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata', 'bangalore': 'Asia/Kolkata', 'bengaluru': 'Asia/Kolkata', 'chennai': 'Asia/Kolkata', 'hyderabad': 'Asia/Kolkata', 'pune': 'Asia/Kolkata',
  'san francisco': 'America/Los_Angeles', 'seattle': 'America/Los_Angeles', 'san diego': 'America/Los_Angeles', 'portland': 'America/Los_Angeles', 'las vegas': 'America/Los_Angeles', 'san jose': 'America/Los_Angeles',
  'boston': 'America/New_York', 'washington': 'America/New_York', 'washington dc': 'America/New_York', 'miami': 'America/New_York', 'atlanta': 'America/New_York', 'philadelphia': 'America/New_York', 'orlando': 'America/New_York', 'nyc': 'America/New_York',
  'dallas': 'America/Chicago', 'houston': 'America/Chicago', 'austin': 'America/Chicago', 'minneapolis': 'America/Chicago', 'new orleans': 'America/Chicago', 'salt lake city': 'America/Denver',
  'montreal': 'America/Toronto', 'ottawa': 'America/Toronto', 'calgary': 'America/Edmonton', 'rio de janeiro': 'America/Sao_Paulo', 'rio': 'America/Sao_Paulo',
  'hawaii': 'Pacific/Honolulu', 'washington state': 'America/Los_Angeles', 'manchester': 'Europe/London', 'edinburgh': 'Europe/London', 'birmingham': 'Europe/London', 'glasgow': 'Europe/London',
  'milan': 'Europe/Rome', 'barcelona': 'Europe/Madrid', 'munich': 'Europe/Berlin', 'frankfurt': 'Europe/Berlin', 'hamburg': 'Europe/Berlin', 'geneva': 'Europe/Zurich', 'krakow': 'Europe/Warsaw',
  'st petersburg': 'Europe/Moscow', 'saint petersburg': 'Europe/Moscow', 'kiev': 'Europe/Kiev', 'kyiv': 'Europe/Kiev', 'abu dhabi': 'Asia/Dubai', 'tel aviv': 'Asia/Jerusalem', 'mecca': 'Asia/Riyadh',
  'cape town': 'Africa/Johannesburg', 'hanoi': 'Asia/Bangkok', 'ho chi minh city': 'Asia/Ho_Chi_Minh', 'saigon': 'Asia/Ho_Chi_Minh', 'canberra': 'Australia/Sydney', 'wellington': 'Pacific/Auckland',
  'kolkata': 'Asia/Kolkata', 'calcutta': 'Asia/Kolkata', 'peking': 'Asia/Shanghai', 'london': 'Europe/London', 'uk': 'Europe/London', 'england': 'Europe/London', 'japan': 'Asia/Tokyo', 'india': 'Asia/Kolkata', 'china': 'Asia/Shanghai',
};
const fallbackZones = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'Africa/Johannesburg'];
/** every zone the browser knows (about 400 IANA names). */
export const allZones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (_) { return fallbackZones; } };
/** the city part of a zone id, as people write it: "America/Argentina/Buenos_Aires" -> "Buenos Aires". Pure. */
export const cityOf = (tz) => String(tz).split('/').pop().replace(/_/g, ' ');
const key = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

/** a city, zone id or zone abbreviation typed by a person -> { name, tz }, or null: "tokyo", "Asia/Tokyo", "san francisco", "EST", "são paulo". */
export function findPlace(text, zones = allZones()) {
  const raw = String(text || '').trim(); if (!raw) return null;
  const k = key(raw.replace(/^(?:the\s+)?time\s+in\s+/i, '').replace(/\s+time$/i, ''));
  const exact = zones.find((z) => z.toLowerCase() === raw.toLowerCase()); if (exact) return { name: cityOf(exact), tz: exact };
  if (ALIAS[k]) return { name: title(k), tz: ALIAS[k] };
  const byCity = zones.find((z) => key(cityOf(z)) === k); if (byCity) return { name: cityOf(byCity), tz: byCity };
  const z = zoneOf(k); if (z) return { name: z.name, tz: z.timezone };
  const off = /^(?:utc|gmt)\s*([+-])\s*(\d{1,2})$/.exec(k); // UTC+9 -> Etc/GMT-9 (the IANA sign is backwards)
  if (off && +off[2] <= 14) { const tz = +off[2] === 0 ? 'UTC' : 'Etc/GMT' + (off[1] === '+' ? '-' : '+') + +off[2]; return { name: 'UTC' + off[1] + +off[2], tz }; }
  const starts = zones.find((z) => key(cityOf(z)).startsWith(k) && k.length >= 3); if (starts) return { name: cityOf(starts), tz: starts };
  return null;
}
const title = (k) => k.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).replace(/\bDc\b/, 'DC').replace(/\bNyc\b/, 'NYC').replace(/\bUk\b/, 'UK');

/** the wall clock in a zone at an instant: { h, m, s, ymd: [y, mo0, d], day: 'Sunday' }. Pure. */
export function wall(tz, at) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at), g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { h: +g('hour') % 24, m: +g('minute'), s: +g('second'), ymd: ymdIn(tz, at), day: g('weekday') };
}
/** "9:05 PM" or "21:05" (h24), with seconds when asked. Pure. */
export function clockText(h, m, { h24 = false, s = null } = {}) {
  const two = (n) => String(n).padStart(2, '0'), sec = s === null ? '' : ':' + two(s);
  return h24 ? two(h) + ':' + two(m) + sec : ((h % 12) || 12) + ':' + two(m) + sec + (h < 12 ? ' AM' : ' PM');
}
/** whether a zone keeps daylight saving time this year, and whether it is on now: { observes, now }. Pure. */
export function dst(tz, at) {
  const y = new Date(at).getUTCFullYear(), jan = offsetMin(tz, new Date(Date.UTC(y, 0, 1))), jul = offsetMin(tz, new Date(Date.UTC(y, 6, 1)));
  return { observes: jan !== jul, now: jan !== jul && offsetMin(tz, at) === Math.max(jan, jul) };
}
/** "3 hours ahead", "5.5 hours behind", "same time" for two offsets in minutes. Pure. */
export function gapText(min) {
  if (!min) return 'same time'; const h = Math.abs(min) / 60, n = Number.isInteger(h) ? String(h) : String(+h.toFixed(2));
  return n + (h === 1 ? ' hour ' : ' hours ') + (min > 0 ? 'ahead' : 'behind');
}
/** a time typed for a zone ("3pm", "15:30", "noon") on a day there ([y, mo0, d], today there by default) -> the instant, or null. Pure. */
export function instantOf(text, tz, ymd, now = new Date()) {
  const hm = parseClock(String(text || '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '')); if (!hm) return null;
  const [y, mo, d] = ymd || ymdIn(tz, now); return instantIn(tz, y, mo, d, hm[0], hm[1]);
}
/** the same instant as each zone sees it: [{ tz, h, m, ymd, dayShift (-1, 0, 1 against the first) }]. Pure. */
export function convert(at, zones) {
  const w0 = wall(zones[0], at), d0 = Date.UTC(...w0.ymd);
  return zones.map((tz) => { const w = wall(tz, at); return { tz, h: w.h, m: w.m, ymd: w.ymd, day: w.day, dayShift: Math.round((Date.UTC(...w.ymd) - d0) / 86400000) }; });
}
/** how an hour of the day suits a meeting: 'work' (8 to 18), 'edge' (7, 18 to 21) or 'night'. Pure. */
export const fit = (h) => (h >= 8 && h < 18 ? 'work' : h === 7 || (h >= 18 && h < 21) ? 'edge' : 'night');
/** a meeting planner: the 24 hours of the first zone's day `ymd`, each as every zone sees it, and which suit everyone. Pure.
 *  -> [{ at (ms), cells: [{ tz, h, m, dayShift, fit }], all: 'work' | 'edge' | 'night' }] */
export function planner(zones, ymd) {
  const [y, mo, d] = ymd, out = [];
  for (let h = 0; h < 24; h++) {
    const at = instantIn(zones[0], y, mo, d, h, 0), cells = convert(at, zones).map((c) => ({ ...c, fit: fit(c.h) }));
    out.push({ at: at.getTime(), cells, all: cells.every((c) => c.fit === 'work') ? 'work' : cells.every((c) => c.fit !== 'night') ? 'edge' : 'night' });
  }
  return out;
}
/** the hours that suit everyone, as "9 AM to 11 AM" spans in the first zone (or the edge hours when none do). Pure. */
export function bestSpans(rows, { h24 = false } = {}) {
  const pick = rows.some((r) => r.all === 'work') ? 'work' : 'edge', spans = []; let start = null;
  rows.forEach((r, i) => { const ok = r.all === pick; if (ok && start === null) start = i; if ((!ok || i === rows.length - 1) && start !== null) { const end = ok ? i + 1 : i; spans.push(clockText(rows[start].cells[0].h, 0, { h24 }) + ' to ' + clockText((rows[end - 1].cells[0].h + 1) % 24, 0, { h24 })); start = null; } });
  return rows.some((r) => r.all !== 'night') ? { kind: pick, spans } : { kind: 'none', spans: [] };
}
