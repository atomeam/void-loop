// Dates and clock times as people type them (tools pack 2, owner 2026-10-18): "friday", "oct 25", "2026-10-25", "in 3 days",
// "9:30", "2:15pm". Pure and local: a day is a YYYY-MM-DD string, no time zone is involved, nothing is sent anywhere.

export const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
export const WEEKDAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
const DAYS_IN = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** a Date's local calendar day as YYYY-MM-DD. */
export const isoOf = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const numOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const fromNum = (n) => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };

/** is this a real YYYY-MM-DD day? Pure. */
export function validIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  return mo >= 0 && mo < 12 && d >= 1 && d <= DAYS_IN(y, mo);
}

/** whole days from a to b (b later = positive). Pure. */
export const daysBetween = (a, b) => numOf(b) - numOf(a);
/** a day plus n days. Pure. */
export const addDays = (iso, n) => fromNum(numOf(iso) + n);
/** weekday 0 (Sunday) to 6 of a day. Pure. */
export const weekdayOf = (iso) => (((numOf(iso) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday (4)

/** "Oct 25, 2026" style label. Pure. */
export function labelOf(iso) { const [y, m, d] = iso.split('-').map(Number); return MONTH_NAMES[m - 1].slice(0, 3) + ' ' + d + ', ' + y; }

/**
 * A day in the words. `prefer` says which way a bare month-and-day runs: 'future' (a due date) or 'past' (a day since).
 * Returns { iso, rest } with the matched words cut out of `text`, or null. Pure given `now`.
 */
export function findDay(text, now = new Date(), prefer = 'future') {
  const today = isoOf(now), src = String(text || '');
  const cut = (m, iso) => ({ iso, rest: (src.slice(0, m.index) + ' ' + src.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() });
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(src);
  if (m) return validIso(m[0]) ? cut(m, m[0]) : null;
  m = /\b(?:today|tonight)\b/i.exec(src); if (m) return cut(m, today);
  m = /\btomorrow\b/i.exec(src); if (m) return cut(m, addDays(today, 1));
  m = /\byesterday\b/i.exec(src); if (m) return cut(m, addDays(today, -1));
  m = /\bin\s+(\d{1,3})\s+(day|week)s?\b/i.exec(src); if (m) return cut(m, addDays(today, +m[1] * (m[2].toLowerCase() === 'week' ? 7 : 1)));
  m = /\bnext\s+week\b/i.exec(src); if (m) return cut(m, addDays(today, 7));
  const mon = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const ord = '(?:st|nd|rd|th)?';
  // "oct 25", "october 25th 2026", "25 oct", "3 may 1990"
  const md = new RegExp('\\b' + mon + '\\.?\\s+(\\d{1,2})' + ord + '(?:,?\\s+(\\d{4}))?\\b', 'i'), dm = new RegExp('\\b(\\d{1,2})' + ord + '\\s+(?:of\\s+)?' + mon + '\\.?(?:,?\\s+(\\d{4}))?\\b', 'i');
  let mo, d, y;
  if ((m = md.exec(src))) { mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = m[3] ? +m[3] : null; }
  else if ((m = dm.exec(src))) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = m[3] ? +m[3] : null; }
  if (m && mo !== undefined) {
    const ty = now.getFullYear();
    if (y) return d >= 1 && d <= DAYS_IN(y, mo) ? cut(m, y + '-' + p2(mo + 1) + '-' + p2(d)) : null;
    for (let k = 0; k < 9; k++) {
      const yy = prefer === 'past' ? ty - k : ty + k;
      if (d < 1 || d > DAYS_IN(yy, mo)) continue; // february 29 waits for a leap year
      const iso = yy + '-' + p2(mo + 1) + '-' + p2(d), diff = daysBetween(today, iso);
      if (prefer === 'past' ? diff <= 0 : diff >= 0) return cut(m, iso);
    }
    return null;
  }
  m = new RegExp('\\b(?:(?:on|by|this|next|coming)\\s+)?(' + Object.keys(WEEKDAYS).join('|') + ')\\b', 'i').exec(src);
  if (m) {
    const want = WEEKDAYS[m[1].toLowerCase()], here = weekdayOf(today);
    let gap = (want - here + 7) % 7;
    if (prefer === 'past') gap = -((here - want + 7) % 7);
    else if (gap === 0) gap = 7; // "friday" said on a friday is next week's
    return cut(m, addDays(today, gap));
  }
  return null;
}

/** ISO 8601 week of a day: { year, week }. Pure. */
export function isoWeek(iso) {
  const n = numOf(iso), wd = (weekdayOf(iso) + 6) % 7; // Monday = 0
  const thursday = n - wd + 3, ty = new Date(thursday * 86400000).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(ty, 0, 1) / 86400000);
  return { year: ty, week: Math.floor((thursday - jan1) / 7) + 1 };
}

/** age from a birth day on a given day: whole years, months, days, total days, and the days to the next birthday. Pure. */
export function ageOf(birth, today) {
  if (!validIso(birth) || !validIso(today) || daysBetween(birth, today) < 0) return null;
  const [by, bm, bd] = birth.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  let years = ty - by, months = tm - bm, days = td - bd;
  if (days < 0) { months -= 1; const pm = tm === 1 ? 12 : tm - 1, py = tm === 1 ? ty - 1 : ty; days += DAYS_IN(py, pm - 1); }
  if (months < 0) { years -= 1; months += 12; }
  // next birthday: a February 29 birthday is kept on March 1 in other years
  const on = (yy) => (bm === 2 && bd === 29 && DAYS_IN(yy, 1) < 29) ? yy + '-03-01' : yy + '-' + p2(bm) + '-' + p2(bd);
  let next = on(ty); if (daysBetween(today, next) < 0) next = on(ty + 1);
  return { years, months, days, totalDays: daysBetween(birth, today), nextBirthdayIn: daysBetween(today, next), nextBirthday: next };
}

/**
 * A time of day in minutes after midnight, or null: "9", "9:30", "9am", "2:15 pm", "14:00", "noon", "midnight".
 * With no am/pm, hours 1 to 6 are the afternoon, 7 to 12 as written (morning, noon), 0 and 13 to 23 as written.
 */
export function clockMinutes(s) {
  const t = String(s || '').trim().toLowerCase();
  if (t === 'noon') return 720;
  if (t === 'midnight') return 0;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(t);
  if (!m) return null;
  let h = +m[1]; const min = m[2] ? +m[2] : 0, ap = m[3] ? m[3][0] : '';
  if (min > 59 || h > 24) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap === 'p' ? 12 : 0); }
  else if (h >= 1 && h <= 6) h += 12;
  if (h === 24 && min) return null;
  return h * 60 + min;
}

/** minutes after midnight as "9:30 am" (12-hour) or "09:30" (24-hour). Pure. */
export function clockText(min, h24 = false) {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  if (h24) return p2(h) + ':' + p2(m);
  return ((h % 12) || 12) + ':' + p2(m) + (h < 12 ? ' am' : ' pm');
}

/** minutes as "1 h 45 min", "45 min", "2 h". Pure. */
export function lengthText(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' min' : '');
}

/** the minutes between two clock times; an end at or before the start runs on (to the afternoon, then the next day). Pure. */
export function spanMinutes(startMin, endMin) {
  if (endMin === startMin) return 0;
  let e = endMin;
  while (e <= startMin) e += 720;
  return e - startMin;
}
