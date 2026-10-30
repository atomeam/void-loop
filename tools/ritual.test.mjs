// node tools/ritual.test.mjs — the ritual-template parser and its .ics (lib/ritual.js).
import assert from 'node:assert/strict';
import { ritualAsk, blocksOf, ritualIcs, timeOf } from '../void-live-deploy/lib/ritual.js';
assert.deepEqual(timeOf('6:30am'), [6, 30]); assert.deepEqual(timeOf('7 pm'), [19, 0]); assert.equal(timeOf('13pm'), null);
const r = ritualAsk('ritual template: meditate 10, stretch 15, journal 10 at 6:30am');
assert.deepEqual(r.steps, [['Meditate', 10], ['Stretch', 15], ['Journal', 10]]); assert.deepEqual(r.start, [6, 30]);
const b = blocksOf(r, new Date(2026, 9, 22));
assert.equal(b[2].to.getHours() * 60 + b[2].to.getMinutes(), 6 * 60 + 65);
assert.equal(ritualAsk('morning routine as calendar events').name, 'morning');
assert.equal(ritualAsk('export my evening routine to my calendar').name, 'evening');
for (const n of ['my morning', 'export my calendar', 'call this my morning', 'morning routine ideas']) assert.equal(ritualAsk(n), null, n);
const ics = ritualIcs(r, new Date(2026, 9, 22), { now: new Date(0) });
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3); assert.match(ics, /RRULE:FREQ=DAILY/); assert.match(ics, /SUMMARY:Stretch \(ritual routine\)/);
console.log('ritual: ok');
