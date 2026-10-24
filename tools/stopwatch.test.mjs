// lib/stopwatch.js: a stopwatch kept as timestamps never drifts, laps with splits, deltas, fastest and slowest; durations; a countdown
import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, fresh, act, elapsed, lapRows, parseDuration, timer, tact, remaining } from '../void-live-deploy/lib/stopwatch.js';

test('the clock reads as people write it', () => {
  assert.equal(clock(0), '0:00.00'); assert.equal(clock(3450), '0:03.45'); assert.equal(clock(123450), '2:03.45'); assert.equal(clock(3723450), '1:02:03.45');
  assert.equal(clock(61000, { hundredths: false }), '1:01'); assert.equal(clock(-5), '0:00.00');
});
test('elapsed time comes from timestamps: pauses bank it, a long gap between looks loses nothing', () => {
  let s = act(fresh(), 'start', 1000); assert.equal(elapsed(s, 61000), 60000, 'a background tab looks once a minute and still reads right');
  s = act(s, 'stop', 3000); assert.equal(elapsed(s, 999999), 2000, 'stopped, it holds');
  s = act(s, 'start', 10000); assert.equal(elapsed(s, 10500), 2500);
  assert.deepEqual(act(s, 'reset', 1), fresh()); assert.equal(act(fresh(), 'lap', 5).laps.length, 0, 'no lap while stopped');
});
test('laps: each split, the change from the one before, the fastest and the slowest, newest first', () => {
  let s = act(fresh(), 'start', 0); for (const t of [10000, 18000, 30000]) s = act(s, 'lap', t);
  const rows = lapRows(s.laps);
  assert.deepEqual(rows.map((r) => [r.n, r.split, r.total, r.delta, r.fastest, r.slowest]), [[3, 12000, 30000, 4000, false, true], [2, 8000, 18000, -2000, true, false], [1, 10000, 10000, null, false, false]]);
});
test('durations from words, clocks and bare minutes; nonsense is refused', () => {
  assert.equal(parseDuration('10m'), 600000); assert.equal(parseDuration('1h30m'), 5400000); assert.equal(parseDuration('90s'), 90000); assert.equal(parseDuration('1:30'), 90000);
  assert.equal(parseDuration('01:02:03'), 3723000); assert.equal(parseDuration('25'), 1500000); assert.equal(parseDuration('10 minutes'), 600000); assert.equal(parseDuration('1.5 h'), 5400000);
  assert.equal(parseDuration('1 hour and 5 minutes'), 3900000);
  for (const no of ['', 'soon', '1:75', '10 parsecs']) assert.equal(parseDuration(no), null, no);
});
test('a countdown: it ends at a fixed moment, a pause banks what is left, it never goes below zero', () => {
  let c = tact(timer(60000), 'start', 1000); assert.equal(remaining(c, 31000), 30000); assert.equal(remaining(c, 99999), 0);
  c = tact(c, 'pause', 41000); assert.equal(remaining(c, 500000), 20000);
  c = tact(c, 'start', 50000); assert.equal(remaining(c, 60000), 10000); assert.deepEqual(tact(c, 'reset', 0), timer(60000));
});
