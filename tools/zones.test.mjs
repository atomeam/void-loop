// lib/zones.js: the time in any city, a converter and a meeting planner, all from the browser's own zone data (Intl), daylight saving included
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlace, cityOf, wall, clockText, dst, gapText, instantOf, convert, planner, bestSpans, offsetMin } from '../void-live-deploy/lib/zones.js';

test('a city, a zone id, an alias, an abbreviation or an offset finds its zone; nonsense finds none', () => {
  assert.deepEqual(findPlace('tokyo'), { name: 'Tokyo', tz: 'Asia/Tokyo' }); assert.equal(findPlace('Asia/Tokyo').tz, 'Asia/Tokyo'); assert.equal(findPlace('time in Tokyo').tz, 'Asia/Tokyo');
  assert.equal(findPlace('San Francisco').tz, 'America/Los_Angeles'); assert.equal(findPlace('mumbai').tz, 'Asia/Kolkata'); assert.equal(findPlace('São Paulo').tz, 'America/Sao_Paulo');
  assert.equal(findPlace('EST').tz, 'America/New_York'); assert.equal(findPlace('UTC+9').tz, 'Etc/GMT-9'); assert.equal(offsetMin(findPlace('UTC+9').tz, new Date()), 540);
  assert.equal(findPlace('xyzzy'), null); assert.equal(findPlace(''), null); assert.equal(cityOf('America/Argentina/Buenos_Aires'), 'Buenos Aires');
});
test('the wall clock and its words', () => {
  const at = new Date('2026-10-25T12:00:00Z');
  assert.deepEqual(wall('Asia/Tokyo', at), { h: 21, m: 0, s: 0, ymd: [2026, 9, 25], day: 'Sunday' });
  assert.equal(clockText(21, 5), '9:05 PM'); assert.equal(clockText(0, 5, { s: 7 }), '12:05:07 AM'); assert.equal(clockText(9, 5, { h24: true }), '09:05');
  assert.equal(gapText(330), '5.5 hours ahead'); assert.equal(gapText(-60), '1 hour behind'); assert.equal(gapText(0), 'same time');
});
test('daylight saving: London keeps it (on in July, off in December), Tokyo never does', () => {
  assert.deepEqual(dst('Europe/London', new Date('2026-07-01T12:00:00Z')), { observes: true, now: true });
  assert.deepEqual(dst('Europe/London', new Date('2026-12-01T12:00:00Z')), { observes: true, now: false });
  assert.deepEqual(dst('Asia/Tokyo', new Date('2026-07-01T12:00:00Z')), { observes: false, now: false });
});
test('a time carried between zones, across the date line and a daylight-saving change', () => {
  const at = instantOf('3pm', 'Europe/London', [2026, 9, 26]); assert.equal(at.toISOString(), '2026-10-26T15:00:00.000Z', 'London is back on GMT after 25 October');
  const r = convert(at, ['Europe/London', 'Asia/Tokyo', 'America/Los_Angeles']);
  assert.deepEqual(r.map((x) => [x.h, x.m, x.dayShift]), [[15, 0, 0], [0, 0, 1], [8, 0, 0]]);
  assert.equal(instantOf('9:30 am', 'America/New_York', [2026, 6, 1]).toISOString(), '2026-07-01T13:30:00.000Z');
  assert.equal(instantOf('noon', 'Asia/Kolkata', [2026, 0, 1]).toISOString(), '2026-01-01T06:30:00.000Z');
  assert.equal(instantOf('25:00', 'UTC'), null); assert.equal(instantOf('soon', 'UTC'), null);
});
test('the meeting planner: 24 hours of the first city\'s day, and the hours inside everyone\'s working day', () => {
  const rows = planner(['Europe/London', 'America/New_York', 'Europe/Berlin'], [2026, 9, 27]);
  assert.equal(rows.length, 24); assert.deepEqual(rows[13].cells.map((c) => c.h), [13, 9, 14]);
  assert.deepEqual(bestSpans(rows), { kind: 'work', spans: ['12:00 PM to 5:00 PM'] });
  assert.equal(bestSpans(planner(['Europe/London', 'Asia/Tokyo', 'America/Los_Angeles'], [2026, 9, 27])).kind, 'none');
});
