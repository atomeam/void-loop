import test from 'node:test';
import assert from 'node:assert/strict';
import { verdictOf, fixJobsOf, median, BUDGET_MS, KEY_PAGES } from './perf-budget.mjs';

test('the phone budget: a key page over 3 s, or one that does not load, is over and becomes one fix job', () => {
  assert.equal(BUDGET_MS, 3000); assert.ok(KEY_PAGES.includes('/'));
  assert.equal(median([3, 1, null, 2]), 2); assert.equal(median([null]), null);
  const rows = [{ path: '/', ms: 800 }, { path: '/arcade/', ms: 3569 }, { path: '/x/', ms: null }];
  const v = verdictOf(rows);
  assert.equal(v.ok, false); assert.deepEqual(v.over, ['/arcade/', '/x/']);
  assert.match(v.line, /2 of 3 key pages are over 3 s on a phone: \/arcade\/ 3.6 s, \/x\/ did not load/);
  assert.match(verdictOf([{ path: '/', ms: 800 }]).line, /^All 1 key pages load under 3 s/);
  const jobs = fixJobsOf(rows);
  assert.deepEqual(jobs.map((j) => j.target), ['auto:perf /arcade/', 'auto:perf /x/']);
  assert.ok(jobs.every((j) => j.ask.length <= 200));
});
