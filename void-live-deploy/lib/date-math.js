// Pure date math for the date-calc and date-grid skills (tools pack 11, owner 2026-10-18: DATES & CALENDARS 341-400).
// A day is a 'YYYY-MM-DD' string and counted in UTC days, so nothing here depends on the machine's time zone or on
// daylight saving; "today" and "now" are always passed in (tests pass fixed ones). Times of day are minutes after midnight
// or naive 'YYYY-MM-DDTHH:MM' strings. Only the zone helpers use Intl, and only with an instant that is passed in.
// Dates only: nothing here moves money or claims which rule applies to a visa, lease or warranty.

const pad = (n, w = 2) => String(n).padStart(w, '0');
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** true for a real calendar day written YYYY-MM-DD (not 2026-02-30). Pure. */
export function isDay(s) {
  const m = ISO.exec(String(s || ''));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** days since 1970-01-01 for a day string. Pure. */
export function dayNum(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
/** the day string for a day number. Pure. */
export function isoOf(n) { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
export const parts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
export const mk = (y, m, d) => pad(y, 4) + '-' + pad(m) + '-' + pad(d);

/** 341 and 342: n days later (or earlier when negative). */
export const addDays = (iso, n) => isoOf(dayNum(iso) + Math.trunc(n));
export const addWeeks = (iso, n) => addDays(iso, 7 * n);
/** n months later; a day that does not exist in the target month lands on its last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso, n) {
  const { y, m, d } = parts(iso), t = (y * 12 + (m - 1)) + Math.trunc(n), ny = Math.floor(t / 12), nm = t - ny * 12 + 1;
  return mk(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
export const addYears = (iso, n) => addMonths(iso, 12 * n);
/** 0 = Sunday ... 6 = Saturday. */
export const weekday = (iso) => ((dayNum(iso) % 7) + 11) % 7; // 1970-01-01 was a Thursday (4)
export const isWeekend = (iso) => { const w = weekday(iso); return w === 0 || w === 6; };
export const dayName = (iso) => DAY_NAMES[weekday(iso)];

/** 343: n business days (Monday to Friday, minus the manual holiday list) later, or earlier when negative. */
export function addBusinessDays(iso, n, holidays = []) {
  const off = new Set(holidays);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(Math.trunc(n)), cur = iso;
  while (left > 0) { cur = addDays(cur, step); if (!isWeekend(cur) && !off.has(cur)) left--; }
  return cur;
}
/** business days from a (exclusive) to b (inclusive), the way "5 business days after" counts; negative when b is earlier. */
export function businessDaysBetween(a, b, holidays = []) {
  if (a === b) return 0;
  const off = new Set(holidays), sign = dayNum(b) >= dayNum(a) ? 1 : -1;
  let n = 0, cur = a;
  while (cur !== b) { cur = addDays(cur, sign); if (!isWeekend(cur) && !off.has(cur)) n += sign; }
  return n;
}

/** 344 and 345: the next (strictly after) or previous (strictly before) given weekday; wd 0..6. */
export function nextWeekday(iso, wd) { const diff = (wd - weekday(iso) + 7) % 7; return addDays(iso, diff === 0 ? 7 : diff); }
export function prevWeekday(iso, wd) { const diff = (weekday(iso) - wd + 7) % 7; return addDays(iso, -(diff === 0 ? 7 : diff)); }

/** 346 and 347 */
export const startOfMonth = (iso) => { const { y, m } = parts(iso); return mk(y, m, 1); };
export const endOfMonth = (iso) => { const { y, m } = parts(iso); return mk(y, m, daysInMonth(y, m)); };
/** 348 and 349: calendar quarters (Q1 starts 1 Jan). */
export const quarterOf = (iso) => Math.floor((parts(iso).m - 1) / 3) + 1;
export const quarterStart = (iso) => { const { y } = parts(iso); return mk(y, (quarterOf(iso) - 1) * 3 + 1, 1); };
export const quarterEnd = (iso) => endOfMonth(mk(parts(iso).y, quarterOf(iso) * 3, 1));
/** 350: the Monday that starts the ISO week this day is in. */
export const isoWeekStart = (iso) => addDays(iso, -((weekday(iso) + 6) % 7));
/** the ISO 8601 week number and its week-year. */
export function isoWeek(iso) {
  const thu = addDays(isoWeekStart(iso), 3), y = parts(thu).y;
  return { year: y, week: Math.floor((dayNum(thu) - dayNum(mk(y, 1, 1))) / 7) + 1 };
}

/** 351: a day in a few fixed styles ("iso", "long", "us", "eu", "short"). English names on purpose: the output never depends on the machine's locale. */
export function formatDay(iso, style = 'long') {
  const { y, m, d } = parts(iso), dn = dayName(iso), mn = MONTH_NAMES[m - 1];
  switch (style) {
    case 'iso': return iso;
    case 'us': return pad(m) + '/' + pad(d) + '/' + y;
    case 'eu': return pad(d) + '/' + pad(m) + '/' + y;
    case 'short': return dn.slice(0, 3) + ' ' + d + ' ' + mn.slice(0, 3) + ' ' + y;
    default: return dn + ', ' + mn + ' ' + d + ', ' + y;
  }
}

const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const monIdx = (s) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(s.slice(0, 3).toLowerCase()) + 1;
const WD_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
export const wdIdx = (s) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(String(s).slice(0, 3).toLowerCase());
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const num = (s) => (/^\d+$/.test(s) ? +s : NUMW[String(s).toLowerCase()]);

/** 352 and 355: a day from words, with today passed in. Takes 2026-10-03, Oct 3 2026, 3 October 2026, October 3 (the next one
 *  from today), 10/3/2026 (month first), today, tomorrow, yesterday, next week, last week, in 3 days, 3 days ago, next monday, last friday,
 *  end of month, start of next month. null when it cannot tell. Pure. */
export function parseDay(text, today, sameYear = false) {
  const t = String(text || '').toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ').replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/\b(\d{1,2}) of /, '$1 ').trim();
  if (!t) return null;
  let m;
  if (ISO.test(t)) return isDay(t) ? t : null;
  if (t === 'today' || t === 'now') return today;
  if (t === 'tomorrow') return addDays(today, 1);
  if (t === 'yesterday') return addDays(today, -1);
  if (t === 'next week') return addDays(today, 7);
  if (t === 'last week') return addDays(today, -7);
  if (t === 'next month') return addMonths(today, 1);
  if (t === 'last month') return addMonths(today, -1);
  if (t === 'next year') return addYears(today, 1);
  if (t === 'last year') return addYears(today, -1);
  if ((m = /^(?:in\s+)?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(day|week|month|year)s?(?:\s+(ago|from now|from today))?$/.exec(t))) {
    const n = num(m[1]); if (!n && n !== 0) return null;
    const sign = m[3] === 'ago' ? -1 : 1, u = m[2];
    if (!m[3] && !/^in\s/.test(t)) return null; // "3 days" alone is a length, not a day
    return u === 'day' ? addDays(today, sign * n) : u === 'week' ? addWeeks(today, sign * n) : u === 'month' ? addMonths(today, sign * n) : addYears(today, sign * n);
  }
  if ((m = new RegExp('^(next|last|this)\\s+' + WD_RE + '$').exec(t))) {
    const wd = wdIdx(m[2]);
    if (m[1] === 'next') return nextWeekday(today, wd);
    if (m[1] === 'last') return prevWeekday(today, wd);
    return weekday(today) === wd ? today : nextWeekday(today, wd);
  }
  if ((m = new RegExp('^' + WD_RE + '$').exec(t))) return weekday(today) === wdIdx(m[1]) ? today : nextWeekday(today, wdIdx(m[1]));
  if ((m = /^(?:the\s+)?(end|start|beginning|first day|last day)(?:\s+of)?\s+(?:the\s+)?(this|next|last)?\s*(month|quarter|week|year)$/.exec(t)) || (m = /^(end|start|beginning) of (month|quarter|week|year)$/.exec(t))) {
    const which = m.length === 4 ? m[2] : 'this', unit = m.length === 4 ? m[3] : m[2], end = /^(end|last)/.test(m[1]);
    const base = which === 'next' ? (unit === 'month' ? addMonths(today, 1) : unit === 'quarter' ? addMonths(today, 3) : unit === 'week' ? addDays(today, 7) : addYears(today, 1))
      : which === 'last' ? (unit === 'month' ? addMonths(today, -1) : unit === 'quarter' ? addMonths(today, -3) : unit === 'week' ? addDays(today, -7) : addYears(today, -1)) : today;
    if (unit === 'month') return end ? endOfMonth(base) : startOfMonth(base);
    if (unit === 'quarter') return end ? quarterEnd(base) : quarterStart(base);
    if (unit === 'week') return end ? addDays(isoWeekStart(base), 6) : isoWeekStart(base);
    return end ? mk(parts(base).y, 12, 31) : mk(parts(base).y, 1, 1);
  }
  // month name forms
  if ((m = new RegExp('^' + MON_RE + ' (\\d{1,2}) (\\d{4})$').exec(t)) || (m = new RegExp('^(\\d{1,2}) ' + MON_RE + ' (\\d{4})$').exec(t))) {
    const dayFirst = /^\d/.test(t), mo = monIdx(dayFirst ? m[2] : m[1]), d = +(dayFirst ? m[1] : m[2]), y = +m[3], iso = mk(y, mo, d);
    return isDay(iso) ? iso : null;
  }
  if ((m = new RegExp('^' + MON_RE + ' (\\d{1,2})$').exec(t)) || (m = new RegExp('^(\\d{1,2}) ' + MON_RE + '$').exec(t))) {
    const dayFirst = /^\d/.test(t), mo = monIdx(dayFirst ? m[2] : m[1]), d = +(dayFirst ? m[1] : m[2]);
    const { y } = parts(today);
    for (const yy of sameYear ? [y] : [y, y + 1]) { const iso = mk(yy, mo, d); if (isDay(iso) && (sameYear || dayNum(iso) >= dayNum(today))) return iso; }
    return null;
  }
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { const iso = mk(+m[3], +m[1], +m[2]); return isDay(iso) ? iso : null; } // month first, like US dates; day first only when the first number is above 12
  return null;
}
/** a US-style 13/05/2026 (first number above 12) read day first; parseDay stays month-first for the rest. Pure. */
export function parseDayLoose(text, today) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim());
  if (m && +m[1] > 12) { const iso = mk(+m[3], +m[2], +m[1]); return isDay(iso) ? iso : null; }
  return parseDay(text, today);
}

/** 356: whole days between two days (b - a). */
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
/** 357: do two day ranges (inclusive ends) overlap, and by which days. */
export function rangeOverlap(a1, a2, b1, b2) {
  const s1 = dayNum(a1) <= dayNum(a2) ? [a1, a2] : [a2, a1], s2 = dayNum(b1) <= dayNum(b2) ? [b1, b2] : [b2, b1];
  const start = dayNum(s1[0]) > dayNum(s2[0]) ? s1[0] : s2[0], end = dayNum(s1[1]) < dayNum(s2[1]) ? s1[1] : s2[1];
  if (dayNum(start) > dayNum(end)) return { overlap: false, days: 0, start: null, end: null, gap: dayNum(start) - dayNum(end) - 1 };
  return { overlap: true, days: dayNum(end) - dayNum(start) + 1, start, end, gap: 0 };
}

/** 358: every n days from a start, `count` times. skip = days to leave out (a manual holiday list): a day on it is dropped and the run goes on, so you still get `count` dates. */
export function everyNDays(start, n, count, skip = []) {
  const off = new Set(skip), out = [];
  const step = Math.max(1, Math.trunc(n)), cap = Math.min(Math.max(1, count), 60);
  let cur = start;
  for (let i = 0; i < 400 && out.length < cap; i++) { if (!off.has(cur)) out.push(cur); cur = addDays(cur, step); }
  return out;
}
/** 359: the next `count` days that fall on the given weekdays (0..6), from `from` (included). */
export function weeklyDays(from, wds, count) {
  const want = new Set(wds), out = [], cap = Math.min(Math.max(1, count), 60);
  let cur = from;
  for (let i = 0; i < 800 && out.length < cap && want.size; i++) { if (want.has(weekday(cur))) out.push(cur); cur = addDays(cur, 1); }
  return out;
}
/** 360: take a list of days and leave out (skip) or move to the next free working day (shift) the ones on the manual holiday list. */
export function skipHolidays(days, holidays, mode = 'skip') {
  const off = new Set(holidays);
  if (mode === 'skip') return days.filter((d) => !off.has(d));
  return days.map((d) => { let x = d; while (off.has(x) || isWeekend(x)) x = addDays(x, 1); return x; });
}

/** 361 and 362: days to go (positive) or since (negative) a target, from today. */
export const daysUntil = (today, target) => daysBetween(today, target);
/** 363: the next birthday or anniversary on or after today. A 29 Feb falls on 28 Feb in a common year. */
export function nextAnnual(origin, today) {
  const { y: oy, m, d } = parts(origin), { y } = parts(today);
  const at = (yy) => mk(yy, m, Math.min(d, daysInMonth(yy, m)));
  let yy = y; if (dayNum(at(yy)) < dayNum(today)) yy++;
  return { date: at(yy), days: daysBetween(today, at(yy)), years: yy - oy };
}
/** 364: age as whole years, months and days; null while the birth day is in the future. */
export function ageParts(birth, today) {
  if (dayNum(birth) > dayNum(today)) return null;
  const b = parts(birth), t = parts(today);
  let years = t.y - b.y, months = t.m - b.m, days = t.d - b.d;
  if (days < 0) { months--; const pm = t.m === 1 ? 12 : t.m - 1, py = t.m === 1 ? t.y - 1 : t.y; days += daysInMonth(py, pm); }
  if (months < 0) { years--; months += 12; }
  return { years, months, days, totalMonths: years * 12 + months, totalDays: daysBetween(birth, today) };
}

const SIGNS = [[1, 20, 'Capricorn'], [2, 19, 'Aquarius'], [3, 21, 'Pisces'], [4, 20, 'Aries'], [5, 21, 'Taurus'], [6, 21, 'Gemini'], [7, 23, 'Cancer'], [8, 23, 'Leo'], [9, 23, 'Virgo'], [10, 23, 'Libra'], [11, 22, 'Scorpio'], [12, 22, 'Sagittarius']];
/** 365: the sun sign for a day, just for fun (the usual tropical dates). */
export function zodiac(iso) {
  const { m, d } = parts(iso);
  for (const [mo, cut, name] of SIGNS) if (m === mo) return d < cut ? name : SIGNS[mo % 12][2];
  return 'Capricorn';
}
/** 366: the moon's phase, approximate (mean synodic month from the new moon of 2000-01-06 18:14 UTC; good to about a day). */
export function moonPhase(iso) {
  const SYN = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const [y, mo, d] = iso.split('-').map(Number), at = Date.UTC(y, mo - 1, d, 12) / 86400000;
  let age = (at - ref) % SYN; if (age < 0) age += SYN;
  const frac = age / SYN, illum = Math.round((1 - Math.cos(2 * Math.PI * frac)) / 2 * 100);
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  return { name: names[Math.floor(frac * 8 + 0.5) % 8], age: Math.round(age * 10) / 10, illumination: illum };
}

/** 368: minutes left until midnight at a clock time (minutes after midnight). */
export const minutesToMidnight = (minutesNow) => 1440 - (((minutesNow % 1440) + 1440) % 1440);
/** minutes after midnight for '9:30', '09:30', '9am', '5:15pm', 'noon', 'midnight'; null otherwise. */
export function parseClock(s) {
  const t = String(s || '').trim().toLowerCase();
  if (t === 'noon') return 720; if (t === 'midnight') return 0;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = +m[1]; const mi = m[2] ? +m[2] : 0;
  if (mi > 59) return null;
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3] === 'pm' ? 12 : 0); } else if (h > 23) return null;
  return h * 60 + mi;
}
export const clockText = (min) => pad(Math.floor(((min % 1440) + 1440) % 1440 / 60)) + ':' + pad(((min % 60) + 60) % 60);
/** 369: how far through the working day a clock time is (0 to 1; before the start 0, after the end 1). */
export function workdayFraction(nowMin, startMin = 540, endMin = 1020) {
  if (endMin <= startMin) return 0;
  return Math.min(1, Math.max(0, (nowMin - startMin) / (endMin - startMin)));
}
/** 370: minutes rounded to a billing step (15 by default), up or to the nearest; returns minutes and hours. */
export function billableRound(minutes, step = 15, mode = 'up') {
  const s = Math.max(1, Math.trunc(step)), m = Math.max(0, minutes);
  const r = mode === 'nearest' ? Math.round(m / s) * s : Math.ceil(m / s) * s;
  return { minutes: r, hours: Math.round(r / 60 * 100) / 100 };
}

/** 387: red when the date has passed or is within `redDays` (2), amber within `amberDays` (7), else green. */
export function trafficLight(today, due, amberDays = 7, redDays = 2) {
  const left = daysBetween(today, due);
  return { light: left < 0 || left <= redDays ? 'red' : left <= amberDays ? 'amber' : 'green', days: left };
}

// naive local date-times: 'YYYY-MM-DDTHH:MM'
export function splitDT(dt) { const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(dt || ''); return m ? { day: m[1], min: +m[2] * 60 + +m[3] } : null; }
export const joinDT = (day, min) => { const extra = Math.floor(min / 1440), mm = ((min % 1440) + 1440) % 1440; return addDays(day, extra) + 'T' + clockText(mm); };
export const addMinutes = (dt, n) => { const s = splitDT(dt); return joinDT(s.day, s.min + Math.trunc(n)); };
/** 388 to 390: snooze a date-time one hour, one day, or until the coming Monday at `atMin` (9:00 by default). */
export function snooze(dt, how, atMin = 540) {
  const s = splitDT(dt);
  if (!s) return null;
  if (how === 'hour') return joinDT(s.day, s.min + 60);
  if (how === 'day') return joinDT(addDays(s.day, 1), s.min);
  return joinDT(nextWeekday(s.day, 1), atMin);
}

/** 380 to 382: does one appointment clash with others (each { start, end } as minutes on the same day or 'YYYY-MM-DDTHH:MM')? A buffer widens each. */
const mins = (v) => (typeof v === 'number' ? v : (() => { const s = splitDT(v); return s ? dayNum(s.day) * 1440 + s.min : NaN; })());
export function conflicts(list, buffer = 0) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], as = mins(a.start), ae = mins(a.end), bs = mins(b.start), be = mins(b.end);
    if (![as, ae, bs, be].every(Number.isFinite)) continue;
    const gap = Math.max(bs - ae, as - be); // negative = overlap, 0 = back to back
    if (gap < buffer) out.push({ a: i, b: j, gap, overlap: gap < 0 });
  }
  return out;
}
/** 382: when to leave: start minus travel minutes minus a buffer. Returns minutes after midnight (can go below 0 = the day before). */
export const leaveBy = (startMin, travelMin, bufferMin = 10) => startMin - travelMin - bufferMin;

// time zones (Intl with an explicit instant; the zone must be an IANA name)
export const ZONES = { 'new york': 'America/New_York', nyc: 'America/New_York', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', chicago: 'America/Chicago', denver: 'America/Denver', toronto: 'America/Toronto', vancouver: 'America/Vancouver', 'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires',
  london: 'Europe/London', dublin: 'Europe/Dublin', lisbon: 'Europe/Lisbon', paris: 'Europe/Paris', berlin: 'Europe/Berlin', madrid: 'Europe/Madrid', rome: 'Europe/Rome', amsterdam: 'Europe/Amsterdam', stockholm: 'Europe/Stockholm', athens: 'Europe/Athens', istanbul: 'Europe/Istanbul', moscow: 'Europe/Moscow', cairo: 'Africa/Cairo', lagos: 'Africa/Lagos', nairobi: 'Africa/Nairobi', johannesburg: 'Africa/Johannesburg',
  dubai: 'Asia/Dubai', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata', bangkok: 'Asia/Bangkok', singapore: 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong', shanghai: 'Asia/Shanghai', beijing: 'Asia/Shanghai', seoul: 'Asia/Seoul', tokyo: 'Asia/Tokyo', sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', auckland: 'Pacific/Auckland', honolulu: 'Pacific/Honolulu', utc: 'UTC', gmt: 'UTC' };
/** the IANA zone for a city name (small built-in list) or an IANA name itself; null when unknown. */
export function zoneOf(name) {
  const k = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (ZONES[k]) return ZONES[k];
  if (/^[a-z]+\/[a-z_]+(?:\/[a-z_]+)?$/i.test(k)) { try { new Intl.DateTimeFormat('en', { timeZone: name.trim() }); return name.trim(); } catch (_) { return null; } }
  return null;
}
/** a zone's offset from UTC in minutes at a UTC instant (ms). */
export function offsetMinutes(zone, atMs) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; for (const x of f.formatToParts(new Date(atMs))) p[x.type] = x.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 60000);
}
/** the UTC instant (ms) of a naive local date-time in a zone (looked up twice so a clock change near the time is handled). */
export function instantOf(dt, zone) {
  const s = splitDT(dt), naive = dayNum(s.day) * 86400000 + s.min * 60000;
  let guess = naive - offsetMinutes(zone, naive) * 60000;
  guess = naive - offsetMinutes(zone, guess) * 60000;
  return guess;
}
/** the naive local date-time in a zone at a UTC instant. */
export function localIn(zone, atMs) {
  const off = offsetMinutes(zone, atMs), t = atMs + off * 60000;
  const d = new Date(t);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}
/** 383: a time in one zone shown in another. */
export const convertZone = (dt, fromZone, toZone) => localIn(toZone, instantOf(dt, fromZone));
/** 386: working hours (9 to 17) and quiet hours (22 to 7) flags for a clock time. */
export function hourFlags(min, work = [540, 1020], quiet = [1320, 420]) {
  const m = ((min % 1440) + 1440) % 1440;
  const inQuiet = quiet[0] > quiet[1] ? (m >= quiet[0] || m < quiet[1]) : (m >= quiet[0] && m < quiet[1]);
  return { working: m >= work[0] && m < work[1], quiet: inQuiet };
}
/** 384 and 385: one meeting time (a naive date-time in the first zone) in each listed zone, with the flags and a verdict. */
export function meetingAcross(dt, zones) {
  const at = instantOf(dt, zones[0]);
  const rows = zones.map((z) => { const l = localIn(z, at), s = splitDT(l); return { zone: z, local: l, ...hourFlags(s.min) }; });
  return { rows, allWorking: rows.every((r) => r.working), anyQuiet: rows.some((r) => r.quiet) };
}

/** 399: the fiscal year a day falls in when the year starts on `startMonth` (1..12); labelled by the year it ends in. */
export function fiscalYear(iso, startMonth = 4) {
  const { y, m } = parts(iso), sm = Math.min(12, Math.max(1, Math.trunc(startMonth)));
  const startY = m >= sm ? y : y - 1, start = mk(startY, sm, 1), end = addDays(addMonths(start, 12), -1);
  return { label: 'FY' + (sm === 1 ? startY : startY + 1), start, end, quarter: Math.floor(((m - sm + 12) % 12) / 3) + 1 };
}
/** 398: sprints of `length` days from a start: the current one and the next, with their number (1-based). */
export function sprintAt(start, length, today) {
  const len = Math.max(1, Math.trunc(length)), diff = daysBetween(start, today);
  if (diff < 0) return { n: 0, notStarted: true, nextStart: start, daysToStart: -diff };
  const n = Math.floor(diff / len), s = addDays(start, n * len), e = addDays(s, len - 1);
  return { n: n + 1, start: s, end: e, dayOf: diff - n * len + 1, daysLeft: daysBetween(today, e), next: addDays(s, len) };
}
/** 397: how far through a term (start and end days) a day is. */
export function termProgress(start, end, today) {
  const total = daysBetween(start, end) + 1, done = Math.min(total, Math.max(0, daysBetween(start, today) + 1));
  return { totalDays: total, doneDays: done, weeksLeft: Math.max(0, Math.ceil((daysBetween(today, end)) / 7)), pct: Math.round(done / total * 100), state: dayNum(today) < dayNum(start) ? 'not started' : dayNum(today) > dayNum(end) ? 'over' : 'in progress' };
}
/** 396: the next pay dates for a cycle anchored on a known pay day: weekly, biweekly, semimonthly (the 15th and the last day), monthly (same day each month). */
export function payDates(cycle, anchor, today, count = 3) {
  const out = [], cap = Math.min(Math.max(1, count), 24);
  if (cycle === 'weekly' || cycle === 'biweekly') {
    const step = cycle === 'weekly' ? 7 : 14; let cur = anchor;
    if (dayNum(cur) < dayNum(today)) cur = addDays(cur, Math.ceil(daysBetween(cur, today) / step) * step);
    for (let i = 0; i < cap; i++) { out.push(cur); cur = addDays(cur, step); }
  } else if (cycle === 'semimonthly') {
    let cur = startOfMonth(today);
    while (out.length < cap) { for (const d of [mk(parts(cur).y, parts(cur).m, 15), endOfMonth(cur)]) if (dayNum(d) >= dayNum(today) && out.length < cap) out.push(d); cur = addMonths(cur, 1); }
  } else {
    let k = 0; while (dayNum(addMonths(anchor, k)) < dayNum(today)) k++;
    for (let i = 0; i < cap; i++) out.push(addMonths(anchor, k + i));
  }
  return out;
}
/** 394: the next renewal on or after today for a plan that renews every `months` months from a first day (anchored, so 31 Jan stays 28 Feb, 31 Mar). */
export function nextRenewal(first, months, today) {
  const step = Math.max(1, Math.trunc(months));
  let k = 0; while (dayNum(addMonths(first, k * step)) < dayNum(today)) k++;
  const date = addMonths(first, k * step);
  return { date, days: daysBetween(today, date), count: k };
}

/** 372 to 375: the cells of a month grid starting on Monday: weeks of 7 entries, each a day string or null for the padding. */
export function monthGrid(iso) {
  const { y, m } = parts(iso), first = mk(y, m, 1), lead = (weekday(first) + 6) % 7, n = daysInMonth(y, m), cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(mk(y, m, d));
  while (cells.length % 7) cells.push(null);
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
/** the 7 days of the ISO week of a day, Monday first. */
export const weekDays = (iso) => { const s = isoWeekStart(iso); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
/** 374: a 7 by 5 block (35 days, 5 weeks, Monday first) ending in the week of `iso`. */
export function heatGrid(iso) { const end = addDays(isoWeekStart(iso), 6), start = addDays(end, -34); return Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d))); }
/** 375: current streak of consecutive marked days up to today (or yesterday while today is open), and the longest run. */
export function streakInfo(days, today) {
  const set = new Set(days);
  let cur = 0, n = dayNum(today); if (!set.has(today)) n--;
  while (set.has(isoOf(n))) { cur++; n--; }
  const nums = [...set].filter(isDay).map(dayNum).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const v of nums) { run = prev !== null && v === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = v; }
  return { current: cur, best };
}
/** 376: toggle a day in a list of marked days (sorted, deduped); `state` forces 'done' / 'skip' / off. */
export function markDay(marks, iso, state) {
  const out = { ...(marks || {}) };
  if (!state || out[iso] === state) delete out[iso]; else out[iso] = state;
  return out;
}
/** 378 and 379: the marked days as plain text lines ("2026-10-03 done"), and back. */
export function exportMarks(marks) { return Object.keys(marks || {}).filter(isDay).sort().map((d) => d + ' ' + marks[d]).join('\n'); }
export function importMarks(text, today = '2026-01-01') {
  const out = {};
  for (const line of String(text || '').split(/[\n;,]+/)) {
    const m = /(\d{4}-\d{2}-\d{2})\s*(done|skip(?:ped)?)?/i.exec(line);
    if (m && isDay(m[1])) out[m[1]] = /skip/i.test(m[2] || '') ? 'skip' : 'done';
  }
  return out;
}
/** 371: a timesheet row for a week: Monday to Sunday dates with hours per day (an array of 7 numbers), total and rounded. */
export function timesheetRow(weekOf, hours = []) {
  const days = weekDays(weekOf), h = days.map((_, i) => Math.max(0, +hours[i] || 0));
  return { days, hours: h, total: Math.round(h.reduce((a, b) => a + b, 0) * 100) / 100 };
}
