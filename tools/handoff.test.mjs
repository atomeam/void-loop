// lib/handoff.js: "Send to" between pages, on the device. Payloads are untrusted: checked, cut to size, never HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, accepts, targetsFor, toHash, fromHash, idOfHash, asEvents, asList, asText, utcOf, localOf, RECEIVERS, PRODUCERS, KINDS, LIMITS, send } from '../void-live-deploy/lib/handoff.js';
import { tripEvents, tripStops, makeIndex } from '../void-live-deploy/lib/flights-core.js';
import { TOOLS } from '../void-live-deploy/lib/toolkit.js';
import fs from 'node:fs';

test('clean: only known kinds, every field checked and cut, control characters gone, null for anything malformed', () => {
  assert.equal(clean(null), null); assert.equal(clean({ kind: 'html', data: { text: 'x' } }), null); assert.equal(clean({ kind: 'text', data: { text: '   ' } }), null);
  const t = clean({ kind: 'text', data: { text: 'a\u0000b<script>x</script>', title: 'T'.repeat(500) }, from: '/notes/', evil: 1 });
  assert.equal(t.data.text, 'ab<script>x</script>'); assert.equal(t.data.title.length, LIMITS.title); assert.equal(t.from, '/notes/'); assert.equal('evil' in t, false);
  assert.equal(clean({ kind: 'text', data: { text: 'x'.repeat(LIMITS.text + 50) } }).data.text.length, LIMITS.text);
  assert.equal(clean({ kind: 'text', data: { text: 'x' }, from: 'javascript:alert(1)' }).from, undefined); // a from that is not a page path is dropped
  const l = clean({ kind: 'list', data: { items: ['a', '', 7, { x: 1 }, 'b\nc', ...Array(600).fill('z')] } });
  assert.deepEqual(l.data.items.slice(0, 4), ['a', '7', 'b c', 'z']); assert.equal(l.data.items.length, LIMITS.items);
  const e = clean({ kind: 'event', data: [{ title: 'Flight', start: '2026-12-12T18:25', end: '2026-12-12T17:00', tz: 'Europe/London' }, { title: 'x', start: 'tomorrow' }, { title: 'Day', start: '2026-12-13' }] });
  assert.deepEqual(e.data.events, [{ title: 'Flight', start: '2026-12-12T18:25', tz: 'Europe/London' }, { title: 'Day', start: '2026-12-13', allDay: true }]); // an end before the start is dropped
  assert.equal(clean({ kind: 'event', data: { title: 'x', start: '2026-02-31T10:00', tz: 'Europe/../etc' } }).data.events[0].tz, undefined);
  assert.equal(clean({ kind: 'event', data: { events: Array(80).fill({ title: 'a', start: '2026-01-01' }) } }).data.events.length, LIMITS.events);
  assert.deepEqual(clean({ kind: 'route', data: { stops: ['lhr', 'JFK', 'nope', 'SFO'] } }).data.stops, ['LHR', 'JFK', 'SFO']); assert.equal(clean({ kind: 'route', data: { stops: ['LHR'] } }), null);
  assert.deepEqual(clean({ kind: 'place', data: { name: 'Lisbon', code: 'lis', lat: 38.7, lon: 999 } }).data, { name: 'Lisbon', code: 'LIS', lat: 38.7 });
  assert.equal(clean({ kind: 'job', data: { title: 'Engineer', url: 'javascript:alert(1)' } }).data.url, undefined);
  assert.equal(clean({ kind: 'parcel', data: { name: 'Shoes', expected: 'soon' } }), null);
  assert.equal(clean({ kind: 'file', data: { name: 'a.png', blob: 'not a blob' } }), null);
  const f = clean({ kind: 'file', data: { name: '../../a:b.png', type: 'image/png', blob: new Blob([new Uint8Array(10)], { type: 'image/png' }) } });
  assert.equal(f.data.name, '.._.._a_b.png'); assert.equal(f.data.size, 10); assert.equal(clean({ kind: 'file', data: { name: 'e', blob: new Blob([]) } }), null);
});

test('who takes what: kinds and file types; never back to the page itself or its floor leader', () => {
  for (const [p, r] of Object.entries(RECEIVERS)) { assert.ok(TOOLS[p], p + ' is a tool page'); for (const k of r.kinds) assert.ok(KINDS.includes(k), p + ' ' + k); }
  for (const [p, ks] of Object.entries(PRODUCERS)) { assert.ok(TOOLS[p], p); for (const k of ks) assert.ok(targetsFor(k, p).length, p + ' makes ' + k + ' that some page takes'); }
  const png = clean({ kind: 'file', data: { name: 'p.png', type: 'image/png', blob: new Blob([new Uint8Array(4)]) } }), ics = clean({ kind: 'file', data: { name: 'c.ics', type: 'text/calendar', blob: new Blob(['x']) } });
  assert.equal(accepts('/photos/', png), true); assert.equal(accepts('/calendar/', png), false); assert.equal(accepts('/calendar/', ics), true); assert.equal(accepts('/nope/', png), false);
  assert.deepEqual(targetsFor('file', '/pdf/', ['image/*']).map((t) => t.path), ['/photos/']);
  assert.deepEqual(targetsFor('file', '/photos/', ['image/*']).map((t) => t.path), ['/pdf/']);
  assert.ok(!targetsFor('list', '/kanban/simple/').some((t) => t.path === '/kanban/'));
  assert.deepEqual(targetsFor('event', '/flights/trip/').map((t) => t.path), ['/calendar/', '/notes/', '/kanban/', '/time/']);
});

test('the address part: round trip, re-checked on the way in, and too long or a file goes by IndexedDB instead', () => {
  const p = clean({ kind: 'text', data: { text: 'héllo wörld ✈' }, from: '/markets/' });
  const h = toHash(p); assert.match(h, /^#send=[A-Za-z0-9_-]+$/); assert.deepEqual(fromHash(h), p);
  assert.equal(toHash(clean({ kind: 'text', data: { text: 'x'.repeat(5000) } })), '');
  assert.equal(fromHash('#send=' + Buffer.from(JSON.stringify({ kind: 'text', data: { text: 'a\u0007b' } })).toString('base64url')).data.text, 'ab');
  assert.equal(fromHash('#send=!!!'), null); assert.equal(fromHash('#nothing'), null);
  assert.equal(idOfHash('#send-id=abc123def45'), 'abc123def45'); assert.equal(idOfHash('#send-id=<x>'), '');
});

test('send goes by a page\'s own link where it has one, else by the address part', async () => {
  const seen = []; const nav = (u) => seen.push(u);
  await send('/time/', { kind: 'event', data: { title: 'BA 117', start: '2026-12-12T18:25', tz: 'Europe/London', endTz: 'America/New_York' } }, nav);
  assert.equal(seen[0], '/time/?at=' + encodeURIComponent('2026-12-12T18:25:00.000Z') + '&c=London,New%20York');
  await send('/flights/map/', { kind: 'route', data: { stops: ['LHR', 'JFK'] } }, nav); assert.equal(seen[1], '/flights/map/?route=LHR-JFK');
  await send('/notes/', { kind: 'text', data: { text: 'hi' } }, nav); assert.match(seen[2], /^\/notes\/#send=/);
  assert.equal(await send('/photos/', { kind: 'text', data: { text: 'hi' } }, nav), ''); assert.equal(seen.length, 3); // a page that does not take it gets nothing
});

test('one kind as another: a job interview and a parcel on the calendar, anything as lines or a note', () => {
  const job = clean({ kind: 'job', data: { title: 'Designer', company: 'Acme', when: '2026-11-03T14:00', tz: 'Europe/Berlin', url: 'https://acme.example/jobs/1' } });
  assert.deepEqual(asEvents(job), [{ title: 'Interview: Designer at Acme', start: '2026-11-03T14:00', tz: 'Europe/Berlin', notes: 'https://acme.example/jobs/1' }]);
  const parcel = clean({ kind: 'parcel', data: { name: 'Boots', expected: '2026-11-05', tracking: '1Z999' } });
  assert.deepEqual(asEvents(parcel), [{ title: 'Parcel arrives: Boots', start: '2026-11-05', allDay: true, notes: 'Tracking 1Z999' }]);
  assert.deepEqual(asList(clean({ kind: 'text', data: { text: 'a\n\n b \nc' } })), ['a', 'b', 'c']);
  assert.deepEqual(asText(clean({ kind: 'list', data: { title: 'Shop', items: ['milk', 'eggs'] } })), { title: 'Shop', text: '- milk\n- eggs' });
  assert.equal(asText(clean({ kind: 'file', data: { name: 'a', blob: new Blob(['x']) } })), null);
});

test('time zones: a local time in a zone and back, across daylight saving', () => {
  assert.equal(new Date(utcOf('2026-07-01T12:00', 'Europe/London')).toISOString(), '2026-07-01T11:00:00.000Z');
  assert.equal(new Date(utcOf('2026-01-01T12:00', 'America/New_York')).toISOString(), '2026-01-01T17:00:00.000Z');
  assert.equal(localOf(Date.parse('2026-07-01T11:00:00Z'), 'Asia/Tokyo'), '2026-07-01T20:00');
});

test('a trip\'s flights become events on the departure clock, and its airports a route', () => {
  const idx = makeIndex(JSON.parse(fs.readFileSync(new URL('../void-live-deploy/flights/airports.json', import.meta.url), 'utf8')));
  const segs = [{ al: 'BA', no: '117', from: 'LHR', to: 'JFK', dep: '2026-12-12T18:25', arr: '2026-12-12T21:05', loc: 'ABC123' }, { al: 'AA', no: '1', from: 'JFK', to: 'LAX', dep: '2026-12-13T08:00', arr: '2026-12-13T11:30' }, { from: 'LAX' }];
  const ev = tripEvents(idx, segs);
  assert.equal(ev.length, 2); assert.equal(ev[0].title, '✈ BA 117 LHR → JFK'); assert.equal(ev[0].start, '2026-12-12T18:25'); assert.equal(ev[0].end, '2026-12-13T02:05'); assert.equal(ev[0].tz, 'Europe/London'); assert.equal(ev[0].endTz, 'America/New_York');
  assert.match(ev[0].notes, /Booking reference ABC123/); assert.ok(clean({ kind: 'event', data: { events: ev } }));
  assert.deepEqual(tripStops(idx, segs), ['LHR', 'JFK', 'LAX']);
});
