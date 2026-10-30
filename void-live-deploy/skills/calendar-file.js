/**
 * calendar-file skill - "export my calendar", "download my calendar as ics": the events kept in this browser (the /calendar/ page's store,
 * lib/agenda.js, which the stage card shares) as one standard .ics file, repeats, reminders and invitees included, that Google Calendar, Apple Calendar and Outlook import. Built on this device; nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { tzName } from '../lib/ics.js';
import { icsOf } from '../lib/calendar.js';
import * as A from '../lib/agenda.js';
const localTz = () => { try { return tzName(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (_) { return ''; } };
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WHAT = "(?:(?:my|the|your|verse's|(?:verse|void)'s) )?(?:calendar|calender|agenda)(?: events)?";
const WHEN = new RegExp('^(?:please )?(?:(?:export|download|save|get|give me|send me|make|create) ' + WHAT + '(?: (?:as|to|into|in|for) (?:an? )?(?:ics|ical|icalendar|calendar file|file|google calendar|outlook|apple calendar))?|' + '(?:download|get|make|export) (?:an? )?(?:ics|ical|calendar) file(?: of ' + WHAT + ')?|calendar file|ics file|ical file)$');

// the page's own file (what its "Export all as .ics" gives), its local times filed under this browser's zone (X-WR-TIMEZONE) so an app reads them right
const fileOf = (events, tz) => (events.length ? icsOf(events).replace('CALSCALE:GREGORIAN\r\n', 'CALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n' + (tzName(tz) ? 'X-WR-TIMEZONE:' + tzName(tz) + '\r\n' : '')) : null);
function saveFile(text) {
  const a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  a.href = u; a.download = 'verse-agenda.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function run(text, api) {
  const { showPage, esc } = api, events = A.events(), n = events.length, tz = localTz(), ics = fileOf(events, tz);
  showPage((el) => {
    el.innerHTML = '<h2>Calendar file</h2>' + (ics
      ? '<p>' + esc(n) + ' event' + (n === 1 ? '' : 's') + ' from your agenda in one .ics file. Open it in Google Calendar, Apple Calendar or Outlook to add them.</p><p class="sub" data-ics-tz>' + (tz ? 'Times are set for your time zone, ' + esc(tz) + ', and each app shows them at its own local time.' : 'Times are written in UTC, so each app shows them at its own local time.') + '</p><button type="button" class="tr-copy" data-ics>Download verse-agenda.ics</button> <span class="sub" data-ics-said></span>'
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
