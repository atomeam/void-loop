/**
 * Ritual template (asked by Verse: "a 'ritual-template' skill that allows users to export a pre-set sequence of habits (e.g.,
 * 'Morning Routine') as a single block of calendar events"). Parses "ritual template: meditate 10, stretch 15 at 6:30am" or a preset
 * ("morning routine as calendar events") into back-to-back steps, and writes them as one .ics file of consecutive events. Pure.
 */
import { fold, escText, tzName } from './ics.js';
import { tzOffsetMs, isTz } from './calendar.js';
export const PRESETS = {
  morning: { start: '6:30am', steps: [['Water and light', 5], ['Stretch', 10], ['Meditate', 10], ['Journal', 10], ['Plan the day', 10]] },
  evening: { start: '9:00pm', steps: [['Tidy up', 10], ['Plan tomorrow', 10], ['Read', 20], ['Lights out', 5]] },
  workout: { start: '7:00am', steps: [['Warm up', 10], ['Strength', 25], ['Cardio', 15], ['Cool down', 10]] }
};
const tidy = (t) => String(t || '').toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
/** "6:30am" / "18:05" / "7 pm" -> [h, m] or null. Pure. */
export function timeOf(s) {
  const m = /^(\d{1,2})(?::(\d\d))?\s*(am|pm)?$/.exec(String(s || '').trim());
  if (!m) return null;
  let h = +m[1]; const min = +(m[2] || 0);
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3] === 'pm' ? 12 : 0); }
  return h < 24 && min < 60 ? [h, min] : null;
}
/** the ritual an ask names: { name, start:[h,m], steps:[[title, minutes]] } or null. Pure. */
export function ritualAsk(text) {
  const t = tidy(text); let m;
  if ((m = /^(?:make (?:me )?(?:a )?)?ritual template(?: for (\w+))?\s*[:-]\s*(.+?)(?: (?:at|from|starting at) (\d{1,2}(?::\d\d)?\s*(?:am|pm)?))?$/.exec(t))) {
    const steps = m[2].split(/\s*(?:,|;| then )\s*/).map((p) => /^(.+?)\s+(\d{1,3})\s*(?:m|min|mins|minutes)?$/.exec(p)).filter(Boolean)
      .map((x) => [x[1].replace(/^\w/, (c) => c.toUpperCase()).slice(0, 60), Math.min(240, Math.max(1, +x[2]))]).slice(0, 12);
    const start = timeOf(m[3] || '7:00am');
    return steps.length && start ? { name: m[1] || 'ritual', start, steps } : null;
  }
  // "make me a morning routine starting at 6:30" (2026-11-06, a-to-mind.com: it opened a recipe timer "Me a morning routine starting at 6",
  // one 30:00 step): a preset with its start time is a ritual too, with or without "as calendar events"
  if ((m = /^(?:(?:export|download|save|add|put|make|turn|build|plan|set up) (?:me )?(?:my |a |the )?)?(morning|evening|workout) (?:routine|ritual)(?: template)?(?:(?: as (?:calendar )?events| (?:to|into|in|on) (?:my )?calendar| as (?:an? )?(?:ics|calendar file))(?: (?:at|from|starting at) (\d{1,2}(?::\d\d)?\s*(?:am|pm)?))?| (?:at|from|starting at|starting|that starts at) (\d{1,2}(?::\d\d)?\s*(?:am|pm)?))$/.exec(t))) {
    const p = PRESETS[m[1]], start = timeOf(m[2] || m[3] || p.start);
    return start ? { name: m[1], start, steps: p.steps } : null;
  }
  return null;
}
/** the steps laid end to end from a start on a day: [{ title, from: Date, to: Date }]. Pure. */
export function blocksOf(r, day = new Date()) {
  let at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), r.start[0], r.start[1]);
  return r.steps.map(([title, min]) => { const from = at; at = new Date(at.getTime() + min * 60e3); return { title, from, to: at }; });
}
const pad = (n) => String(n).padStart(2, '0');
const utc = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
// a VTIMEZONE for a named zone (RFC 5545 3.6.5), worked out with Intl through lib/calendar.js tzOffsetMs, so an event written as
// DTSTART;TZID=<zone>:<wall time> keeps its clock time in Outlook too (Google and Apple read the IANA name on its own). Pure.
const offText = (ms) => { const m = Math.round(ms / 60000), a = Math.abs(m); return (m < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + pad(a % 60); };
const wallUtc = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
/** a zone's clock changes in one year: [{ at (ms, the instant), from, to (offsets in ms) }], found to the minute. Pure. */
export function zoneChanges(tz, year) {
  const out = [], end = Date.UTC(year + 1, 0, 1); let prev = tzOffsetMs(tz, Date.UTC(year, 0, 1));
  for (let x = Date.UTC(year, 0, 2); x <= end; x += 864e5) {
    const o = tzOffsetMs(tz, x); if (o === prev) continue;
    let lo = x - 864e5, hi = x; while (hi - lo > 60000) { const mid = Math.floor((lo + hi) / 120000) * 60000; if (tzOffsetMs(tz, mid) === prev) lo = mid; else hi = mid; }
    out.push({ at: hi, from: prev, to: o }); prev = o;
  }
  return out;
}
// a change as a yearly rule: its month and its weekday counted from the start of the month (2SU) or, in the last week, from the end (-1SU)
const ruleOf = (c) => { const w = new Date(c.at + c.from), dim = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth() + 1, 0)).getUTCDate();
  return 'FREQ=YEARLY;BYMONTH=' + (w.getUTCMonth() + 1) + ';BYDAY=' + (w.getUTCDate() + 7 > dim ? -1 : Math.ceil(w.getUTCDate() / 7)) + ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][w.getUTCDay()]; };
/** the VTIMEZONE lines for `tz` around `year`, or [] for a name this browser does not know. A zone with no clock change is one STANDARD; one
 *  whose changes follow the same yearly rule for three years running gets that rule, and any other gets each change of those years written out. Pure. */
export function vtimezone(tz, year) {
  if (!tzName(tz) || !isTz(tz)) return [];
  const L = ['BEGIN:VTIMEZONE', 'TZID:' + tz], years = [year - 1, year, year + 1].map((y) => zoneChanges(tz, y));
  const obs = (c, rule) => { const k = c.to > c.from ? 'DAYLIGHT' : 'STANDARD'; L.push('BEGIN:' + k, 'DTSTART:' + wallUtc(new Date(c.at + c.from)), ...(rule ? ['RRULE:' + rule] : []), 'TZOFFSETFROM:' + offText(c.from), 'TZOFFSETTO:' + offText(c.to), 'END:' + k); };
  if (years.every((y) => !y.length)) { const o = offText(tzOffsetMs(tz, Date.UTC(year, 0, 1))); L.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:' + o, 'TZOFFSETTO:' + o, 'END:STANDARD'); }
  else if (years.every((y) => y.length === years[0].length && y.every((c, i) => ruleOf(c) === ruleOf(years[0][i]) && c.from === years[0][i].from && c.to === years[0][i].to))) years[0].forEach((c) => obs(c, ruleOf(c)));
  else years.flat().forEach((c) => obs(c, ''));
  L.push('END:VTIMEZONE');
  return L;
}
const wall = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
/** one .ics with every step as its own event, daily repeat when daily. tz (time-zone-detect, asked by Verse: "Add a 'time-zone-detect' skill to the
 *  export so .ics files are automatically adjusted to the user's local browser time"): the browser's zone. Each step is written as the clock time
 *  typed, in that zone (DTSTART;TZID=, with its VTIMEZONE), so a daily repeat stays at 6:30 across a daylight saving change; until 2026-11-06 the
 *  steps were UTC instants and the repeat moved an hour at the next clock change. With no zone the times are floating: each app shows them at
 *  the clock time written. Pure. */
export function ritualIcs(r, day = new Date(), { daily = true, now = new Date(), tz = '' } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//a-to-mind//Verse ritual//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const vt = vtimezone(tz, day.getFullYear()), zone = vt.length ? tzName(tz) : '', at = zone ? ';TZID=' + zone + ':' : ':';
  if (zone) L.push('X-WR-TIMEZONE:' + zone, ...vt);
  blocksOf(r, day).forEach((b, i) => {
    L.push('BEGIN:VEVENT', 'UID:ritual-' + r.name.replace(/[^a-z0-9]/g, '') + '-' + i + '-' + utc(b.from) + '@a-to-mind.com', 'DTSTAMP:' + utc(now),
      'DTSTART' + at + wall(b.from), 'DTEND' + at + wall(b.to), 'SUMMARY:' + escText(b.title + ' (' + r.name + ' routine)'));
    if (daily) L.push('RRULE:FREQ=DAILY');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
