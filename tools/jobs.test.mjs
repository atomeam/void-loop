import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, merge, order } from './jobs.mjs';

test('kinds', () => {
  assert.equal(kindOf('probe the api'), 'probe');
  assert.equal(kindOf('12 usd in eur'), 'calc');
  assert.equal(kindOf('who wrote dune'), 'question');
});
test('merge queues new asks, raises counts, keeps finished jobs finished', () => {
  let jobs = merge([], [{ ask: 'a b', count: 1, last: '2026-10-04T10:00' }], 'now');
  jobs = merge(jobs, [{ ask: 'A B', count: 3, last: '2026-10-04T11:00' }, { ask: 'c d', count: 2, last: '' }], 'now');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].count, 3);
  jobs[0].state = 'done';
  assert.deepEqual(order(merge(jobs, [{ ask: 'a b', count: 4 }])).map((j) => j.ask), ['c d']);
});
