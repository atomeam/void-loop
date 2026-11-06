// The ritual .ics in the browser's own zone (asked by Verse, time-zone-detect: "Add a 'time-zone-detect' skill to the export so .ics files are
// automatically adjusted to the user's local browser time"). Until 2026-11-06 each step was a UTC instant with RRULE:FREQ=DAILY, so a 6:30
// routine exported in New York in November showed at 7:30 after the March clock change. Run: node --test tools/ritual-zone.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ritualAsk, ritualIcs } from '../void-live-deploy/lib/ritual.js';
import { vtimezone, zoneChanges } from '../void-live-deploy/lib/ritual.js';
import { wallToDate } from '../void-live-deploy/lib/calendar.js';

const r = ritualAsk('ritual template: meditate 10, stretch 15 at 6:30am'), day = new Date(2026, 10, 7), now = new Date(0);
const ev = (t) => t.split('BEGIN:VEVENT').slice(1);

test('New York: each step is the clock time typed, in the zone, with a VTIMEZONE whose rules are the US ones', () => {
  const t = ritualIcs(r, day, { now, tz: 'America/New_York' });
  assert.ok(!/[^\r]\n/.test(t), 'only CRLF line ends');
  assert.match(ev(t)[0], /\r\nDTSTART;TZID=America\/New_York:20261107T063000\r\nDTEND;TZID=America\/New_York:20261107T064000\r\n/);
  assert.match(ev(t)[1], /DTSTART;TZID=America\/New_York:20261107T064000\r\nDTEND;TZID=America\/New_York:20261107T065500/);
  assert.match(t, /RRULE:FREQ=DAILY/); assert.ok(!/DTSTART[^\r]*Z\r/.test(t), 'no UTC instants for the steps');
  assert.ok(t.indexOf('BEGIN:VTIMEZONE') < t.indexOf('BEGIN:VEVENT'));
  assert.match(t, /BEGIN:DAYLIGHT\r\nDTSTART:\d{4}03\d\dT020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0400\r\nEND:DAYLIGHT/);
  assert.match(t, /BEGIN:STANDARD\r\nDTSTART:\d{4}11\d\dT020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nEND:STANDARD/);
  assert.match(t, /X-WR-TIMEZONE:America\/New_York/);
  // the same wall time is 6:30 in New York on either side of the March 2027 change: 11:30 UTC before, 10:30 UTC after
  assert.equal(wallToDate('2027-03-01T06:30', 'America/New_York').toISOString(), '2027-03-01T11:30:00.000Z');
  assert.equal(wallToDate('2027-03-20T06:30', 'America/New_York').toISOString(), '2027-03-20T10:30:00.000Z');
});

test('Tokyo: the same steps in Tokyo, one STANDARD at +0900 and no clock change', () => {
  const t = ritualIcs(r, day, { now, tz: 'Asia/Tokyo' });
  assert.match(ev(t)[0], /DTSTART;TZID=Asia\/Tokyo:20261107T063000\r\nDTEND;TZID=Asia\/Tokyo:20261107T064000/);
  assert.equal(zoneChanges('Asia/Tokyo', 2026).length, 0);
  assert.deepEqual(vtimezone('Asia/Tokyo', 2026), ['BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'END:STANDARD', 'END:VTIMEZONE']);
  assert.ok(!/DAYLIGHT/.test(t));
});

test('the change is found to the minute, and a last-Sunday rule reads -1SU (London)', () => {
  const ny = zoneChanges('America/New_York', 2026);
  assert.deepEqual(ny.map((c) => new Date(c.at).toISOString()), ['2026-03-08T07:00:00.000Z', '2026-11-01T06:00:00.000Z']);
  const lon = vtimezone('Europe/London', 2026).join('\n');
  assert.match(lon, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nTZOFFSETFROM:\+0000\nTZOFFSETTO:\+0100/);
  assert.match(lon, /RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nTZOFFSETFROM:\+0100\nTZOFFSETTO:\+0000/);
});

test('no zone, or a name that is not one, gives floating times and no VTIMEZONE', () => {
  for (const tz of ['', 'evil\r\nBEGIN:VEVENT', 'Not/AZone']) {
    const t = ritualIcs(r, day, { now, tz });
    assert.match(ev(t)[0], /\r\nDTSTART:20261107T063000\r\nDTEND:20261107T064000\r\n/, JSON.stringify(tz));
    assert.ok(!/VTIMEZONE|TZID|X-WR-TIMEZONE/.test(t), JSON.stringify(tz));
  }
});
