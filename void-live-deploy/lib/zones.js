/**
 * zones: the time in any city, a time carried from one zone to another, and a meeting planner across a day (the tower's timeanddate.com floor,
 * a-to-mind.com/time/). Everything comes from the browser's own time-zone data (Intl), so it works offline and asks no service. The zone
 * arithmetic is the stage world clock's own (skills/worldtime.js offsetMin, instantIn, ymdIn, parseClock, gmt, zoneOf), reused, not copied.
 * Pure but for the browser's zone list. Tests: tools/zones.test.mjs.
 */
import { offsetMin, instantIn, ymdIn, parseClock, gmt, zoneOf } from '../skills/worldtime.js';
import { daysBetween, addDays, isWeekend, addBusinessDays, businessDaysBetween, formatDay } from './date-math.js';
export { offsetMin, gmt, instantIn, ymdIn };

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
/** a clock's place as a city another page can look up: its own name ("Kyoto"), its zone's city for a short form ("NYC" -> "New York") or for
 *  the visitor's own clock ("Your time (Chicago)" -> "Chicago"), and '' for a bare offset or UTC, which is no place. Pure. */
export const cityName = (p) => (p && p.tz && p.tz.includes('/') && !/^Etc\//.test(p.tz) ? (p.you || /^[A-Z]{2,4}$/.test(p.name || '') || !p.name ? cityOf(p.tz) : p.name) : '');
/** the stage card for the clocks open: "time in <city>" for the city asked for, else "world clock for <cities>" (up to 8). A city keeps
 *  its name ("Mumbai"), but a short form ("NYC") is said as its zone's city ("New York") for the stage's geocoder; UTC offsets have none. Pure. */
export function timeAsk(main, places = []) {
  if (main) { const c = cityName(main); if (c) return 'time in ' + c; }
  const names = [...new Set(places.map(cityName).filter(Boolean))].slice(0, 8);
  return names.length ? 'world clock for ' + names.join(', ') : 'world clock';
}
const key = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

/** a city, zone id or zone abbreviation typed by a person -> { name, tz }, or null: "tokyo", "Asia/Tokyo", "san francisco", "EST", "são paulo". */
const realZone = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; } };
export function findPlace(text, zones = allZones()) {
  const raw = String(text || '').trim(); if (!raw) return null;
  const k = key(raw.replace(/^(?:the\s+)?time\s+in\s+/i, '').replace(/\s+time$/i, ''));
  const exact = zones.find((z) => z.toLowerCase() === raw.toLowerCase()); if (exact) return { name: cityOf(exact), tz: exact };
  const named = /^(.+?)@([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*)$/.exec(raw); // "Kyoto@Asia/Tokyo", from a card's link (skills/worldtime.js timePage): its own name, in that zone
  if (named && (zones.includes(named[2]) || realZone(named[2]))) return { name: named[1].trim(), tz: named[2] }; // a geocoder's zone may be an alias the list leaves out (Asia/Ho_Chi_Minh)
  if (ALIAS[k]) return { name: title(k), tz: ALIAS[k] };
  const byCity = zones.find((z) => key(cityOf(z)) === k); if (byCity) return { name: cityOf(byCity), tz: byCity };
  const z = zoneOf(k); if (z) return { name: z.name, tz: z.timezone };
  const off = /^(?:utc|gmt)\s*([+-])\s*(\d{1,2})$/.exec(k); // UTC+9 -> Etc/GMT-9 (the IANA sign is backwards)
  if (off && +off[2] <= 14) { const tz = +off[2] === 0 ? 'UTC' : 'Etc/GMT' + (off[1] === '+' ? '-' : '+') + +off[2]; return { name: 'UTC' + off[1] + +off[2], tz }; }
  const starts = zones.find((z) => key(cityOf(z)).startsWith(k) && k.length >= 3); if (starts) return { name: cityOf(starts), tz: starts };
  return null;
}
/** a place a link names with its zone, "City@Area/Zone" (as the flights page writes for an airport's city): { name, tz }, or null when the text has no
 *  "@" or the zone is not one this device's clock knows (an alias like Asia/Kolkata counts). The name keeps its own spelling, at most 60 characters. Pure. */
export function placeAt(text) {
  const raw = String(text || ''), i = raw.lastIndexOf('@'); if (i < 1) return null;
  const tz = raw.slice(i + 1).trim(), name = raw.slice(0, i).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name || !/^[A-Za-z][\w+-]*(?:\/[\w+-]+){0,2}$/.test(tz)) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return { name, tz }; } catch (_) { return null; }
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

// where the cities /time/ knows stand (latitude north, longitude east, to 0.01°), for their sunrise and sunset: a city a zone is named after, and
// the cities people ask for under another city's zone. A zone with no city here (EST, UTC+5, a small zone) has no coordinate and says so: never guessed.
const COORDS = Object.fromEntries(('tokyo 35.69 139.69;osaka 34.69 135.50;kyoto 35.01 135.77;seoul 37.57 126.98;shanghai 31.23 121.47;beijing 39.90 116.41;'
  + 'shenzhen 22.54 114.06;guangzhou 23.13 113.26;chengdu 30.57 104.07;hong kong 22.32 114.17;taipei 25.03 121.57;manila 14.60 120.98;singapore 1.35 103.82;'
  + 'kuala lumpur 3.14 101.69;jakarta -6.21 106.85;bangkok 13.76 100.50;hanoi 21.03 105.85;ho chi minh city 10.82 106.63;saigon 10.82 106.63;yangon 16.87 96.20;'
  + 'dhaka 23.81 90.41;kathmandu 27.72 85.32;kolkata 22.57 88.36;calcutta 22.57 88.36;mumbai 19.08 72.88;bombay 19.08 72.88;delhi 28.70 77.10;new delhi 28.61 77.21;'
  + 'bangalore 12.97 77.59;bengaluru 12.97 77.59;chennai 13.08 80.27;hyderabad 17.39 78.49;pune 18.52 73.86;karachi 24.86 67.01;kabul 34.56 69.21;tashkent 41.30 69.24;'
  + 'almaty 43.24 76.89;dubai 25.20 55.27;abu dhabi 24.45 54.38;muscat 23.59 58.41;qatar 25.29 51.53;doha 25.29 51.53;riyadh 24.71 46.68;mecca 21.39 39.86;'
  + 'baghdad 33.31 44.36;tehran 35.69 51.39;baku 40.41 49.87;tbilisi 41.72 44.78;yerevan 40.18 44.51;jerusalem 31.77 35.21;tel aviv 32.09 34.78;beirut 33.89 35.50;'
  + 'amman 31.95 35.93;damascus 33.51 36.28;istanbul 41.01 28.98;cairo 30.04 31.24;nairobi -1.29 36.82;addis ababa 9.03 38.74;lagos 6.52 3.38;accra 5.60 -0.19;'
  + 'casablanca 33.57 -7.59;algiers 36.75 3.06;tunis 36.81 10.18;johannesburg -26.20 28.05;cape town -33.92 18.42;kinshasa -4.44 15.27;dakar 14.72 -17.47;'
  + 'moscow 55.76 37.62;st petersburg 59.93 30.34;saint petersburg 59.93 30.34;kyiv 50.45 30.52;kiev 50.45 30.52;minsk 53.90 27.56;warsaw 52.23 21.01;krakow 50.06 19.94;'
  + 'prague 50.08 14.44;vienna 48.21 16.37;budapest 47.50 19.04;bucharest 44.43 26.10;sofia 42.70 23.32;athens 37.98 23.73;belgrade 44.79 20.45;zagreb 45.81 15.98;'
  + 'berlin 52.52 13.41;munich 48.14 11.58;frankfurt 50.11 8.68;hamburg 53.55 9.99;zurich 47.38 8.54;geneva 46.20 6.14;paris 48.86 2.35;brussels 50.85 4.35;'
  + 'amsterdam 52.37 4.90;luxembourg 49.61 6.13;copenhagen 55.68 12.57;oslo 59.91 10.75;stockholm 59.33 18.07;helsinki 60.17 24.94;tallinn 59.44 24.75;riga 56.95 24.11;'
  + 'vilnius 54.69 25.28;rome 41.90 12.50;milan 45.46 9.19;madrid 40.42 -3.70;barcelona 41.39 2.17;lisbon 38.72 -9.14;dublin 53.35 -6.26;london 51.51 -0.13;'
  + 'manchester 53.48 -2.24;birmingham 52.49 -1.89;edinburgh 55.95 -3.19;glasgow 55.86 -4.25;reykjavik 64.15 -21.94;'
  + 'new york 40.71 -74.01;nyc 40.71 -74.01;boston 42.36 -71.06;washington 38.91 -77.04;washington dc 38.91 -77.04;philadelphia 39.95 -75.17;miami 25.76 -80.19;'
  + 'atlanta 33.75 -84.39;orlando 28.54 -81.38;detroit 42.33 -83.05;toronto 43.65 -79.38;montreal 45.50 -73.57;ottawa 45.42 -75.70;chicago 41.88 -87.63;'
  + 'dallas 32.78 -96.80;houston 29.76 -95.37;austin 30.27 -97.74;minneapolis 44.98 -93.27;new orleans 29.95 -90.07;mexico city 19.43 -99.13;winnipeg 49.90 -97.14;'
  + 'denver 39.74 -104.99;phoenix 33.45 -112.07;salt lake city 40.76 -111.89;edmonton 53.55 -113.49;calgary 51.05 -114.07;los angeles 34.05 -118.24;'
  + 'san francisco 37.77 -122.42;san jose 37.34 -121.89;san diego 32.72 -117.16;seattle 47.61 -122.33;portland 45.52 -122.68;las vegas 36.17 -115.14;'
  + 'vancouver 49.28 -123.12;anchorage 61.22 -149.90;honolulu 21.31 -157.86;hawaii 21.31 -157.86;halifax 44.65 -63.58;st johns 47.56 -52.71;'
  + 'bogota 4.71 -74.07;lima -12.05 -77.04;caracas 10.48 -66.90;santiago -33.45 -70.67;buenos aires -34.60 -58.38;montevideo -34.90 -56.16;sao paulo -23.55 -46.63;'
  + 'rio de janeiro -22.91 -43.17;rio -22.91 -43.17;havana 23.11 -82.37;panama 8.98 -79.52;sydney -33.87 151.21;melbourne -37.81 144.96;brisbane -27.47 153.03;'
  + 'perth -31.95 115.86;adelaide -34.93 138.60;darwin -12.46 130.84;hobart -42.88 147.33;canberra -35.28 149.13;auckland -36.85 174.76;wellington -41.29 174.78;'
  + 'fiji -18.14 178.44;longyearbyen 78.22 15.65').split(';').map((r) => { const m = /^(.+) (-?[\d.]+) (-?[\d.]+)$/.exec(r); return [m[1], [+m[2], +m[3]]]; }));
/** where a place stands: { lat, lon } from the table by its own name, else by the city its zone is named after when the name is that city; or null. Pure. */
export function coordsOf(place) {
  if (!place) return null; const n = key(place.name), z = key(cityOf(place.tz || ''));
  const c = COORDS[n] || (place.you || n === z ? COORDS[z] : null); return c ? { lat: c[0], lon: c[1] } : null;
}
/** "10 hours 42 minutes". Pure. */
export const lengthText = (min) => { const h = Math.floor(min / 60), m = min % 60; return h + (h === 1 ? ' hour ' : ' hours ') + m + (m === 1 ? ' minute' : ' minutes'); };

/** from one day to another ('YYYY-MM-DD'), the way timeanddate.com counts: the start day counted, the end day not. { days, weeks, weekdays,
 *  weekendDays, hours }, negative when the end is earlier. Weekends only: no public holidays are known offline. lib/date-math.js does the counting. Pure. */
export function dateSpan(a, b) {
  const days = daysBetween(a, b), weekdays = days ? businessDaysBetween(addDays(a, -1), addDays(b, -1)) : 0;
  return { days, weeks: Math.trunc(days / 7), rest: days % 7 || 0, weekdays, weekendDays: days - weekdays, hours: days * 24 };
}
/** a day n business days (Monday to Friday) after a day, or before it when n is negative: the date and its name. Pure. */
export function businessDay(iso, n) { const d = addBusinessDays(iso, n); return { iso: d, text: formatDay(d) }; }
export { isWeekend, formatDay };

/** the next time the clocks change in a zone after `at` (within 400 days): { at (the instant, a Date), from, to (offsets in minutes),
 *  forward (true when the clocks go forward), before and after (the wall clock either side, [h, m]) }, or null for a zone that keeps one
 *  offset. Found a fortnight at a time, then to the minute. Pure. */
const FMT = new Map(); // one formatter per zone: making one is the slow part of asking an offset, and the search asks ~45 times
function offsetFast(tz, t) {
  let f = FMT.get(tz); if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }); FMT.set(tz, f); }
  const p = {}; for (const x of f.formatToParts(new Date(t))) p[x.type] = +x.value;
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(t / 60000) * 60000) / 60000);
}
export function nextChange(tz, at = new Date()) {
  const offsetMin = (z, d) => offsetFast(z, +d);
  const t0 = +new Date(at), base = offsetMin(tz, new Date(t0)), DAY = 864e5; let lo = t0, hi = null;
  // a fortnight at a time (no zone changes its clocks twice in two weeks), then halved down to the minute: about 45 lookups, not 400
  for (let d = 14; d <= 406; d += 14) { const t = t0 + d * DAY; if (offsetMin(tz, new Date(t)) !== base) { hi = t; lo = t - 14 * DAY; break; } }
  if (hi === null) return null;
  while (hi - lo > 60000) { const mid = lo + Math.floor((hi - lo) / 120000) * 60000 || lo + 60000; if (offsetMin(tz, new Date(mid)) === base) lo = mid; else hi = mid; }
  const to = offsetMin(tz, new Date(hi)), wb = wall(tz, new Date(hi - 60000)), wa = wall(tz, new Date(hi));
  return { at: new Date(hi), from: base, to, forward: to > base, before: [(wb.h + (wb.m === 59 ? 1 : 0)) % 24, (wb.m + 1) % 60], after: [wa.h, wa.m] };
}
