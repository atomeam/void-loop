/**
 * calendar-file skill - "export my calendar", "download my calendar as ics": the events on this browser's agenda (skills/calendar.js) as one
 * standard .ics file that Google Calendar, Apple Calendar and Outlook import. Built on this device; nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { icsOf, eventsOf, zoneOf } from '../lib/ics.js';
// the browser's own time zone (asked by Verse: "time-zone-detect"): the file's times follow it; none readable, they stay in UTC
const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } };
const KEY = 'a2m.void.agenda.v1';
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WHAT = "(?:(?:my|the|your|verse's|(?:verse|void)'s) )?(?:calendar|calender|agenda)(?: events)?";
const WHEN = new RegExp('^(?:please )?(?:(?:export|download|save|get|give me|send me|make|create) ' + WHAT + '(?: (?:as|to|into|in|for) (?:an? )?(?:ics|ical|icalendar|calendar file|file|google calendar|outlook|apple calendar))?|' + '(?:download|get|make|export) (?:an? )?(?:ics|ical|calendar) file(?: of ' + WHAT + ')?|calendar file|ics file|ical file)$');

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
function saveFile(text) {
  const a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  a.href = u; a.download = 'verse-agenda.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function run(text, api) {
  const { showPage, esc } = api, rows = load(), n = eventsOf(rows).length, tz = zoneOf(browserZone()), ics = icsOf(rows, new Date(), { tz });
  showPage((el) => {
    el.innerHTML = '<h2>Calendar file</h2>' + (ics
      ? '<p>' + esc(n) + ' event' + (n === 1 ? '' : 's') + ' from your agenda in one .ics file. Open it in Google Calendar, Apple Calendar or Outlook to add them.</p><p class="sub" data-ics-tz="' + esc(tz || 'UTC') + '">' + (tz ? 'Times are set in your time zone, ' + esc(tz) + ', so they stay at the hour you chose after a clock change.' : 'Times are written in UTC; your calendar shows them in its own time zone.') + '</p><button type="button" class="tr-copy" data-ics>Download verse-agenda.ics</button> <span class="sub" data-ics-said></span>'
      : '<p>Your agenda is empty, so there is nothing to export yet. Add something first, like <b>dentist friday 3pm</b>.</p>')
      + '<div class="src">Built on this device from the agenda kept in this browser; nothing is sent anywhere.</div>';
    const b = el.querySelector('[data-ics]');
    if (b) b.addEventListener('click', () => { saveFile(ics); const s = el.querySelector('[data-ics-said]'); if (s) s.textContent = 'downloading'; });
  });
  return 'calendar-file';
}
export default {
  name: 'calendar-file',
  about: 'Your agenda as a standard .ics calendar file (Google, Apple, Outlook), built on this device.',
  examples: ['export my calendar', 'download my calendar as ics', 'download an ics file'],
  nearMisses: ['my calendar', 'export my contacts', 'download the print file', 'what is on my calendar today'],
  match(lower, text) { return WHEN.test(CLEAN(text || lower)); },
  run
};
