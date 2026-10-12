// tools/cron-gate.mjs: the cron that fired decides, not the hour the run started (GitHub starts them hours late).
import assert from 'node:assert/strict';
import { gate, nySummer } from './cron-gate.mjs';
const S = '9 18 * * *', W = '9 19 * * *', g = (event, schedule, now) => gate({ event, schedule, summer: S, winter: W, now: new Date(now) }).run;
assert.equal(nySummer(new Date('2026-07-01T18:00:00Z')), true);
assert.equal(nySummer(new Date('2026-12-01T18:00:00Z')), false);
// summer: the 18:09 cron is today's, even started at 22:47 UTC (a real late start, 2026-10-11)
assert.equal(g('schedule', S, '2026-10-11T22:47:56Z'), true);
assert.equal(g('schedule', W, '2026-10-11T23:43:17Z'), false);
// winter: the other way round
assert.equal(g('schedule', W, '2026-12-01T22:10:00Z'), true);
assert.equal(g('schedule', S, '2026-12-01T21:10:00Z'), false);
// the days the clocks change (2026-11-01 back to winter, 2027-03-14 forward to summer): the evening's offset decides
assert.equal(g('schedule', W, '2026-11-01T21:00:00Z'), true);
assert.equal(g('schedule', S, '2027-03-14T21:00:00Z'), true);
// a manual run always runs; extra spaces in the cron do not matter
assert.equal(g('workflow_dispatch', '', '2026-10-11T03:00:00Z'), true);
assert.equal(g('schedule', ' 9  18 * * * ', '2026-10-11T22:00:00Z'), true);
console.log('cron-gate: all passed');
