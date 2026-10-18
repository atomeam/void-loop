// Small time questions answered from the words alone (tools pack 2, owner 2026-10-18, items 33, 38, 39, 40): how long a
// meeting is, what week number a day falls in, days since a day, and an age. Pure: nothing is looked up or sent.
import { findDay, isoOf, isoWeek, ageOf, daysBetween, addDays, weekdayOf, clockMinutes, clockText, lengthText, labelOf, validIso, spanMinutes } from './date-words.js';

const T = '(\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?|noon|midnight)';
const RANGE = '\\s*(?:to|until|till|-|–|—)\\s*';
const clean = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** a meeting ask -> { start, end, minutes } (minutes after midnight; end may pass 1440), or null.
 *  "how long is a meeting from 9:30 to 11:15", "meeting 14:00-15:30", "meeting at 9:30 for 45 minutes". Pure. */
export function parseMeeting(text) {
  const t = clean(text).toLowerCase();
  let m = new RegExp('^(?:how\\s+long\\s+is\\s+|what\\s+is\\s+the\\s+length\\s+of\\s+)?(?:a\\s+|the\\s+|my\\s+)?meeting(?:\\s+length)?(?:\\s+(?:from|at|is))?\\s+' + T + RANGE + T + '$').exec(t)
    || new RegExp('^how\\s+long\\s+is\\s+(?:a\\s+|the\\s+|my\\s+)?meeting\\s+from\\s+' + T + RANGE + T + '$').exec(t);
  if (m) {
    const a = clockMinutes(m[1]), b = clockMinutes(m[2]);
    if (a === null || b === null) return null;
    const minutes = spanMinutes(a, b);
    return { start: a, end: a + minutes, minutes };
  }
  m = new RegExp('^(?:(?:when|what\\s+time)\\s+(?:does|will|is)\\s+)?(?:a\\s+|the\\s+|my\\s+)?meeting\\s+(?:starting\\s+)?(?:at|from)\\s+' + T + '\\s+(?:for|lasting|of|that\\s+lasts)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|h|minutes?|mins?|m)(?:\\s+(?:end|finish|over))?$').exec(t);
  if (m) {
    const a = clockMinutes(m[1]), n = parseFloat(m[2]), minutes = Math.round(/^h/.test(m[3]) ? n * 60 : n);
    if (a === null || !(minutes >= 1 && minutes <= 1440)) return null;
    return { start: a, end: a + minutes, minutes };
  }
  return null;
}

/** the calculator ask with no times: "meeting length calculator". Pure. */
export const isMeetingCalc = (text) => /^(?:a\s+|the\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?meeting\s+(?:length|duration|time)\s+calculator$/.test(clean(text).toLowerCase());
export const isAgeCalc = (text) => /^(?:a\s+|the\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?age\s+calculator$/.test(clean(text).toLowerCase());

/** "9:30 am to 11:15 am · 1 h 45 min" lines of a meeting. Pure. */
export function meetingLines(mt) {
  const end = mt.end % 1440, next = mt.end >= 1440 ? ' (next day)' : '';
  return { span: clockText(mt.start) + ' to ' + clockText(end) + next, length: lengthText(mt.minutes), minutes: mt.minutes + ' minutes', hours: (Math.round(mt.minutes / 60 * 100) / 100) + ' hours' };
}

/** a week-number ask -> { iso } (the day it asks about) or null. "what week number is it", "week number of oct 25",
 *  "which week of the year is 2026-12-31". A day with no year means this year's. Pure given `now`. */
export function parseWeek(text, now = new Date()) {
  const t = clean(text).toLowerCase();
  if (/^(?:what(?:'s|\s+is)?\s+)?(?:the\s+)?(?:current\s+|this\s+)?week\s+number(?:\s+(?:is\s+it|today|now|right\s+now))?$/.test(t)
    || /^(?:what|which)\s+week(?:\s+number)?(?:\s+of\s+the\s+year)?\s+(?:is\s+it|are\s+we\s+(?:in|on))(?:\s+(?:now|today|right\s+now))?$/.test(t)
    || /^what\s+week\s+of\s+the\s+year\s+is\s+it(?:\s+(?:now|today))?$/.test(t)) return { iso: isoOf(now) };
  const m = /^(?:what(?:'s|\s+is)?\s+(?:the\s+)?)?(?:week\s+number\s+(?:of|for|on)|(?:what|which)\s+(?:week(?:\s+number)?(?:\s+of\s+the\s+year)?)\s+(?:is|does|will)|(?:what|which)\s+week\s+(?:of\s+the\s+year\s+)?(?:is|falls)\s+)\s*(.+?)(?:\s+(?:in|fall\s+in|falls\s+in|on))?$/.exec(t);
  if (!m) return null;
  const body = m[1].replace(/\s+(?:in|on|fall|falls)$/, '');
  const d = findDay(body, new Date(now.getFullYear(), 0, 1), 'future');
  if (!d || d.rest) return null;
  return { iso: d.iso };
}

/** the week of a day in words. Pure. */
export function weekCard(iso) {
  const w = isoWeek(iso), mon = addDays(iso, -((weekdayOf(iso) + 6) % 7)), sun = addDays(mon, 6);
  const yearStart = iso.slice(0, 4) + '-01-01', doy = daysBetween(yearStart, iso) + 1;
  return { week: w.week, year: w.year, monday: mon, sunday: sun, dayOfYear: doy, dayName: WEEKDAY_NAMES[weekdayOf(iso)], date: labelOf(iso) };
}

/** "days since ..." -> { label, start } or null. The start is the day named (a day in the past) or today when none is named.
 *  A bare "days since the roman empire fell" is not a personal counter, so it needs a day or a personal word (I, my, we, our, last). Pure. */
export function parseSince(text, now = new Date()) {
  const m = /^(?:please\s+)?(?:(?:make|start|show|give\s+me|create|begin|add)\s+(?:me\s+)?(?:a\s+|my\s+)?(?:days?[\s-]+since\s+(?:counter|card)\s+(?:for\s+)?|counter\s+(?:for\s+)?)|how\s+many\s+)?days?\s+since\s+(.+)$/i.exec(clean(text));
  const first = m ? m[1] : (/^(?:make|start|show|give\s+me|create|begin|add)\s+(?:me\s+)?(?:a\s+|my\s+)?(?:days?[\s-]+since\s+(?:counter|card)\s+(?:for\s+)?)(.+)$/i.exec(clean(text)) || [])[1];
  if (!first) return null;
  let body = first.trim(), start = null;
  const d = findDay(body, now, 'past');
  if (d && daysBetween(d.iso, isoOf(now)) >= 0) { start = d.iso; body = d.rest.replace(/\b(?:on|since|from)\s*$/i, '').trim(); }
  else if (d) return null; // a day that has not happened is not a day since
  const personal = /^(?:i|i'?ve|my|we|our|the\s+last|last|me)\b/i.test(body);
  if (!start && !personal) return null;
  const label = body.replace(/^(?:the\s+)?last\s+time\s+(?:i\s+)?/i, '').replace(/^(?:i\s+|we\s+)/i, '').replace(/^(?:my|our)\s+/i, '').replace(/^last\s+/i, '').replace(/[,;:]+$/, '').trim().slice(0, 60);
  return { label: label || (start ? labelOf(start) : ''), start: start || isoOf(now), counted: !!start };
}

/** whole days since a start day. Pure. */
export const daysSince = (start, today) => Math.max(0, daysBetween(start, today));

/** an age in words. Pure. */
export function ageCard(birth, today) {
  const a = ageOf(birth, today);
  if (!a) return null;
  const parts = [a.years + (a.years === 1 ? ' year' : ' years'), a.months + (a.months === 1 ? ' month' : ' months'), a.days + (a.days === 1 ? ' day' : ' days')];
  return { ...a, line: parts.join(', '), next: labelOf(a.nextBirthday), nextDay: WEEKDAY_NAMES[weekdayOf(a.nextBirthday)] };
}
