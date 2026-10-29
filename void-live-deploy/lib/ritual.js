/**
 * Ritual template (asked by Verse: "a 'ritual-template' skill that allows users to export a pre-set sequence of habits (e.g.,
 * 'Morning Routine') as a single block of calendar events"). Parses "ritual template: meditate 10, stretch 15 at 6:30am" or a preset
 * ("morning routine as calendar events") into back-to-back steps, and writes them as one .ics file of consecutive events. Pure.
 */
import { fold, escText } from './ics.js';
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
  if ((m = /^(?:(?:export|download|save|add|put|make|turn) (?:my |a |the )?)?(morning|evening|workout) (?:routine|ritual)(?: template)?(?: as (?:calendar )?events| (?:to|into|in|on) (?:my )?calendar| as (?:an? )?(?:ics|calendar file))(?: (?:at|from|starting at) (\d{1,2}(?::\d\d)?\s*(?:am|pm)?))?$/.exec(t))) {
    const p = PRESETS[m[1]], start = timeOf(m[2] || p.start);
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
/** one .ics with every step as its own event, daily repeat when daily. Pure. */
export function ritualIcs(r, day = new Date(), { daily = true, now = new Date() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//a-to-mind//Verse ritual//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  blocksOf(r, day).forEach((b, i) => {
    L.push('BEGIN:VEVENT', 'UID:ritual-' + r.name.replace(/[^a-z0-9]/g, '') + '-' + i + '-' + utc(b.from) + '@a-to-mind.com', 'DTSTAMP:' + utc(now),
      'DTSTART:' + utc(b.from), 'DTEND:' + utc(b.to), 'SUMMARY:' + escText(b.title + ' (' + r.name + ' routine)'));
    if (daily) L.push('RRULE:FREQ=DAILY');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
