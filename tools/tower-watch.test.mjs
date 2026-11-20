import test from 'node:test';
import assert from 'node:assert/strict';
import { examOf, newTarget } from './tower-watch.mjs';

test('the held-out streak report says where the streak stands and what each run did', () => {
  const r = examOf({ streak: 1, runs: [{ at: 'a', overall: 98.4, beat: true }, { at: 'b', overall: 95.9, beat: null }] });
  assert.equal(r.streak, 1); assert.equal(r.need, 3); assert.equal(r.done, false);
  assert.equal(r.last.said, 'not judged (too few answers judged)');
  assert.match(r.line, /1 of 3 wins in a row; last run 95.9, not judged/);
  assert.equal(examOf(null), null); assert.equal(examOf({}).line, 'Held-out exam: 0 of 3 wins in a row.');
});

test('a compounding pass starts only when Tower moves to a new target', () => {
  assert.equal(newTarget('a', { id: 'b' }), true);
  assert.equal(newTarget('a', { id: 'a' }), false);
  assert.equal(newTarget(null, { id: 'b' }), false, 'the first tick only learns the target');
  assert.equal(newTarget('a', {}), false);
});
