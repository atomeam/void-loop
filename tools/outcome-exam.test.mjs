import test from 'node:test';
import assert from 'node:assert/strict';
import { casesNow, regressions } from './outcome-exam.mjs';

test('the saved passes still pass, and a pass that flips is a regression', () => {
  const now = casesNow();
  assert.ok(now.find((c) => c.id === 'time-tokyo').ok);
  assert.equal(now.find((c) => c.id === 'not-a-clock').ok, true, 'weather is not a clock, and that is the expected outcome');
  assert.deepEqual(regressions({ cases: now }, now), []);
  const flipped = now.map((c) => c.id === 'time-tokyo' ? { ...c, ok: false } : c);
  assert.deepEqual(regressions({ cases: now }, flipped).map((c) => c.id), ['time-tokyo']);
});
