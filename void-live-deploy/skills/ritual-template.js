/**
 * ritual-template skill (asked by Verse) - "morning routine as calendar events", "ritual template: meditate 10, stretch 15 at 6:30am":
 * a sequence of habits laid back to back from a start time, shown as a timeline and downloaded as one .ics file (each step its own
 * event, repeating daily) that Google, Apple and Outlook calendars import. Built on this device; nothing is sent anywhere. lib/ritual.js.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { ritualAsk, blocksOf, ritualIcs } from '../lib/ritual.js';
const hm = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function saveFile(text, name) {
  const a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function run(text, api) {
  const { showPage, esc } = api, r = ritualAsk(text), now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), b = blocksOf(r, day), ics = ritualIcs(r, day, { now });
  const total = r.steps.reduce((s, x) => s + x[1], 0), file = 'verse-' + r.name.replace(/[^a-z0-9]/g, '') + '-routine.ics';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(r.name.replace(/^\w/, (c) => c.toUpperCase())) + ' routine</h2><p>' + esc(r.steps.length) + ' steps, ' + esc(total) + ' minutes, from ' + esc(hm(b[0].from)) + ' to ' + esc(hm(b[b.length - 1].to)) + ', starting tomorrow and repeating every day.</p>'
      + '<ol data-ritual>' + b.map((x) => '<li>' + esc(hm(x.from)) + ' to ' + esc(hm(x.to)) + ': ' + esc(x.title) + '</li>').join('') + '</ol>'
      + '<button type="button" class="tr-copy" data-ritual-ics>Download ' + esc(file) + '</button> <span class="sub" data-ritual-said></span>'
      + '<p class="sub">Make your own: <b>ritual template: meditate 10, stretch 15, journal 10 at 6:30am</b>.</p>'
      + '<div class="src">Built on this device as a standard .ics file (RFC 5545); nothing is sent anywhere.</div>';
    const k = el.querySelector('[data-ritual-ics]');
    if (k) k.addEventListener('click', () => { saveFile(ics, file); const s = el.querySelector('[data-ritual-said]'); if (s) s.textContent = 'downloading'; });
  });
  return 'ritual-template';
}
export default {
  name: 'ritual-template',
  about: 'A sequence of habits (morning, evening, workout, or your own) as back-to-back daily calendar events in one .ics file.',
  examples: ['morning routine as calendar events', 'export my evening routine to my calendar', 'ritual template: meditate 10, stretch 15, journal 10 at 6:30am'],
  nearMisses: ['my morning', 'export my calendar', 'call this my morning', 'morning routine ideas'],
  match(lower, text) { return !!ritualAsk(text || lower); },
  run
};
