import test from 'node:test';
import assert from 'node:assert/strict';
import { seedFromBench, digest, validate, append, regressionRows } from './evolve-bank.mjs';

const bench = [
  { ask: 'weather in paris', want: 'skill:weather' },
  { ask: 'toss it off the screen', want: 'skill:throw-off' },
];

test('the seed pins the benchmark without copying it into the bank', () => {
  const bank = seedFromBench(bench);
  assert.equal(bank.seedCount, 2);
  assert.deepEqual(bank.rows, []);
  assert.equal(validate(bank, bench), '');
  assert.equal(bank.seedDigest, digest(bench));
});

test('the bank refuses an edited, shortened or duplicated seed', () => {
  const bank = seedFromBench(bench);
  assert.match(validate(bank, [{ ask: 'weather in paris', want: 'skill:weather' }]), /fewer rows/);
  assert.match(validate(bank, [{ ask: 'weather in rome', want: bench[0].want }, bench[1]]), /pinned benchmark rows changed/);
});

test('only new proven asks append, once', () => {
  const bank = seedFromBench(bench);
  const next = append(bank, [{ ask: 'chuck it off the screen', want: 'skill:throw-off' }, { ask: 'chuck it off the screen', want: 'skill:throw-off' }, { ask: 'weather in paris', want: 'skill:weather' }], bench);
  assert.equal(next.rows.length, 1);
  assert.equal(validate(next, bench), '');
  assert.deepEqual(append(next, [{ ask: 'chuck it off the screen', want: 'skill:throw-off' }], bench).rows, next.rows);
});

test('the full regression set is the pinned seed plus additions', () => {
  const bank = append(seedFromBench(bench), [{ ask: 'chuck it off the screen', want: 'skill:throw-off' }], bench);
  assert.deepEqual(regressionRows(bank, bench).map((r) => r.ask), [bench[0].ask, bench[1].ask, 'chuck it off the screen']);
});
