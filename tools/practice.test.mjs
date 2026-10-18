// Practice sessions that say whether they worked (lib/practice.js; asked by Verse). Run: node --test tools/practice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { record, entryOf, weigh, rateWords, goalKey, readLog, writeLog, GOALS_MAX } from '../void-live-deploy/lib/practice.js';

test('a session is logged per goal with its success_rate and last_tested, in families.json shape', () => {
  const t = Date.parse('2026-10-16T10:00:00Z');
  let log = record({}, '  Learn   Spanish ', true, t);
  log = record(log, 'learn spanish', false, t);
  log = record(log, 'learn spanish', false, t);
  assert.deepEqual(entryOf(log, 'LEARN SPANISH'), { attempts: 3, met: 1, success_rate: 0.333, last_tested: '2026-10-16' });
  assert.equal(rateWords(entryOf(log, 'learn spanish')), '1 of 3 sessions met the goal (33%)');
  assert.deepEqual(record({}, '   ', true), {}); assert.equal(entryOf(log, 'something else'), null);
});
test('bad stored data is ignored and old goals are dropped past the cap', () => {
  assert.deepEqual(record({ x: { attempts: 'a' }, y: null }, 'z', true, 0).z.attempts, 1);
  let log = {}; for (let i = 0; i < GOALS_MAX + 5; i++) log = record(log, 'goal ' + i, true, 0);
  assert.equal(Object.keys(log).length, GOALS_MAX); assert.ok(!log['goal 0'] && log['goal ' + (GOALS_MAX + 4)]);
  assert.equal(goalKey('a\u0000b'), 'a b');
});
test('Clef\'s yes/no is weighed against execution quality: few sessions change nothing, poor ones shorten, good ones keep', () => {
  const e = (met, attempts) => ({ met, attempts });
  assert.deepEqual(weigh(20, true, null), { minutes: 20, why: '' });
  assert.deepEqual(weigh(20, true, e(0, 2)), { minutes: 20, why: '' });
  assert.deepEqual(weigh(20, true, e(1, 5)), { minutes: 10, why: '1 of 5 sessions met the goal (20%), so a shorter timer' });
  assert.equal(weigh(6, true, e(0, 4)).minutes, 5, 'never under 5');
  assert.match(weigh(20, true, e(4, 5)).why, /so the timer stays/); assert.equal(weigh(20, true, e(4, 5)).minutes, 20);
  assert.deepEqual(weigh(20, true, e(3, 5)), { minutes: 20, why: '3 of 5 sessions met the goal (60%)' });
  assert.deepEqual(weigh(null, true, e(0, 9)), { minutes: null, why: '' });
});
test('the log reads and writes through a store and survives one that throws', () => {
  const mem = new Map(), store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(readLog(store), {}); assert.ok(writeLog(store, record({}, 'a', true, 0))); assert.equal(readLog(store).a.attempts, 1);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(readLog(bad), {}); assert.equal(writeLog(bad, {}), false);
  mem.set('void.practice', 'not json'); assert.deepEqual(readLog(store), {});
});
