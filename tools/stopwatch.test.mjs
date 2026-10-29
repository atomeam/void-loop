// lib/stopwatch.js: a stopwatch kept as timestamps never drifts, laps with splits, deltas, fastest and slowest; durations; a countdown
import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, fresh, act, elapsed, lapRows, parseDuration, timer, tact, remaining, intervalSteps, intervalAt, chess, chessLeft, chessTap, chessPause, chessFlag } from '../void-live-deploy/lib/stopwatch.js';

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

test('an interval timer: work and rest rounds in sets, no rest after the last round, a set rest between sets', () => {
  const steps = intervalSteps({ prep: 5000, work: 20000, rest: 10000, rounds: 3, sets: 2, setRest: 60000 });
  assert.deepEqual(steps.map((s) => s.kind + s.round + '/' + s.set), ['prep0/1', 'work1/1', 'rest1/1', 'work2/1', 'rest2/1', 'work3/1', 'setrest3/1', 'work1/2', 'rest1/2', 'work2/2', 'rest2/2', 'work3/2']);
  const at = intervalAt(steps, 5000 + 20000 + 4000); assert.equal(at.step.kind, 'rest'); assert.equal(at.left, 6000); assert.equal(at.total, 5000 + 6 * 20000 + 4 * 10000 + 60000);
  assert.equal(intervalAt(steps, 0).step.kind, 'prep'); assert.ok(intervalAt(steps, 10 ** 7).done);
  assert.equal(intervalSteps({ work: 20000, rest: 10000, rounds: 8 }).length, 15, 'Tabata: 8 work, 7 rest');
});
test('a chess clock: the first tap starts the other side, a tap ends your turn and adds the increment, running out flags, pause banks', () => {
  let c = chess(60000, 2000); c = chessTap(c, 1, 0); assert.equal(c.turn, 0, 'black taps to start white');
  assert.deepEqual(chessLeft(c, 10000), [50000, 60000]); assert.equal(chessTap(c, 1, 10000), c, 'not your turn: nothing');
  c = chessTap(c, 0, 10000); assert.deepEqual(c.left, [52000, 60000]); assert.equal(c.turn, 1); assert.deepEqual(c.moves, [1, 0]);
  c = chessPause(c, 15000); assert.deepEqual(c.left, [52000, 55000]); assert.equal(chessTap(c, 1, 99999), c, 'paused: taps do nothing');
  c = chessPause(c, 20000); assert.equal(c.turn, 1); assert.deepEqual(chessLeft(c, 25000), [52000, 50000]);
  c = chessFlag(c, 20000 + 55000); assert.equal(c.flag, 1); assert.deepEqual(c.left, [52000, 0]);
  assert.equal(chessTap(chessTap(chess(1000), 0, 0), 1, 5000).flag, 1, 'tapping after running out still flags');
});
