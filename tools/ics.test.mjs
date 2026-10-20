// Calendar file (the owner's list: "calendar integration (iCal, Google Calendar)"): the agenda as an RFC 5545 .ics. node --test tools/ics.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { icsOf, eventsOf, escText, fold } from '../void-live-deploy/lib/ics.js';
import skill from '../void-live-deploy/skills/calendar-file.js';
const NOW = new Date('2026-10-18T12:00:00Z');
test('a timed event is written in UTC for an hour, an all-day one as a date, every line ends CRLF', () => {
  const t = icsOf([{ id: 'ab1', title: 'Dentist', at: '2026-10-23T15:00:00Z' }, { id: 'c2', title: 'Call mom', at: new Date(2026, 9, 24).toISOString(), allDay: true }], NOW);
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && t.endsWith('END:VCALENDAR\r\n')); assert.ok(!/[^\r]\n/.test(t), 'only CRLF line ends');
  assert.match(t, /DTSTART:20261023T150000Z\r\nDTEND:20261023T160000Z\r\nSUMMARY:Dentist/); assert.match(t, /DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261025/);
  assert.match(t, /DTSTAMP:20261018T120000Z/); assert.equal((t.match(/BEGIN:VEVENT/g) || []).length, 2); assert.match(t, /UID:ab1-20261023T150000Z@a-to-mind\.com/);
});
test('text is escaped, long lines fold at 75 bytes, bad rows are dropped, empty is null', () => {
  assert.equal(escText('a,b;c\\d\ne\u0001'), 'a\\,b\;c\\\\d\\ne');
  const long = fold('SUMMARY:' + 'é'.repeat(80)); for (const l of long.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l.length); assert.equal(long.replace(/\r\n /g, ''), 'SUMMARY:' + 'é'.repeat(80));
  assert.equal(eventsOf([null, 5, { title: '', at: '2026-10-23T15:00:00Z' }, { title: 'x', at: 'nope' }, { title: 'ok', at: '2026-10-23T15:00:00Z' }]).length, 1);
  assert.equal(icsOf([], NOW), null); assert.equal(icsOf('x', NOW), null);
  assert.ok(!icsOf([{ title: 'a\r\nEND:VEVENT\r\nBEGIN:VEVENT', at: '2026-10-23T15:00:00Z' }], NOW).includes('\r\nEND:VEVENT\r\nBEGIN'), 'a title cannot inject a line');
});
test('the skill takes its asks and leaves the agenda card and other exports alone', () => {
  for (const a of ['export my calendar', 'Download my calendar as ics', 'please export my agenda to google calendar', 'download an ics file', 'make an ical file']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['my calendar', 'export my contacts', 'download the print file', 'what is on my calendar today', 'add dentist to my calendar']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
test('time-zone-detect (asked by Verse): with the browser zone, timed events are local wall time with TZID and the zone\'s VTIMEZONE, changes of offset found to the minute', async () => {
  const { zoneOf, offsetAt, localStamp, vtimezone } = await import('../void-live-deploy/lib/ics.js');
  assert.equal(zoneOf('America/New_York'), 'America/New_York'); for (const z of ['', 'UTC', 'Etc/UTC', 'GMT', 'Not/AZone', 'a;b', 'X:Y\r\nBEGIN']) assert.equal(zoneOf(z), null, z);
  assert.equal(offsetAt(Date.parse('2026-07-01T12:00:00Z'), 'America/New_York'), -240); assert.equal(offsetAt(Date.parse('2026-12-01T12:00:00Z'), 'Asia/Kolkata'), 330);
  assert.equal(localStamp(Date.parse('2026-10-23T15:00:00Z'), 'Europe/London'), '20261023T160000');
  const t = icsOf([{ title: 'Dentist', at: '2026-10-23T15:00:00Z' }, { title: 'After', at: '2026-11-03T15:00:00Z' }, { title: 'Day', at: new Date(2026, 9, 24).toISOString(), allDay: true }], NOW, { tz: 'America/New_York' });
  assert.match(t, /X-WR-TIMEZONE:America\/New_York\r\nBEGIN:VTIMEZONE\r\nTZID:America\/New_York\r\n/);
  assert.match(t, /BEGIN:STANDARD\r\nDTSTART:20261101T020000\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nEND:STANDARD/, 'the clock change on 1 November at 2:00');
  assert.match(t, /DTSTART;TZID=America\/New_York:20261023T110000\r\nDTEND;TZID=America\/New_York:20261023T120000/); assert.match(t, /DTSTART;TZID=America\/New_York:20261103T100000/);
  assert.match(t, /DTSTART;VALUE=DATE:20261024/, 'all-day stays a date'); assert.ok(!/[^\r]\n/.test(t));
  assert.equal(icsOf([{ title: 'x', at: '2026-10-23T15:00:00Z' }], NOW, { tz: 'UTC' }), icsOf([{ title: 'x', at: '2026-10-23T15:00:00Z' }], NOW), 'UTC or no zone: the file as before');
  assert.ok(!icsOf([{ title: 'Day', at: '2026-10-24T00:00:00Z', allDay: true }], NOW, { tz: 'Europe/Paris' }).includes('VTIMEZONE'), 'no timed event, no zone block');
  const k = vtimezone('Asia/Kolkata', Date.parse('2026-01-01T00:00:00Z'), Date.parse('2027-01-01T00:00:00Z')); assert.equal(k.filter((l) => l.startsWith('BEGIN:STANDARD') || l.startsWith('BEGIN:DAYLIGHT')).length, 1, 'no clock changes: one observance');
});
