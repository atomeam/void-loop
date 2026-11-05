// The date-math family (skills/date-math.js, lists run 10, 2026-11-04): time-math and date-calc are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits at time-math's old rank.
// Run: node --test tools/date-math-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/date-math.js';
import timeMath from '../void-live-deploy/skills/time-math.js';
import dateCalc from '../void-live-deploy/skills/date-calc.js';

test('every example of both old skills lands on the same member as before (time-math first, as at rank 0025)', () => {
  for (const a of timeMath.examples) assert.equal(fam.part(a.toLowerCase(), a), 'time-math', a);
  for (const a of dateCalc.examples) {
    const before = timeMath.match(a.toLowerCase(), a) ? 'time-math' : 'date-calc';
    assert.equal(fam.part(a.toLowerCase(), a), before, a);
  }
  // the two asks both took (tools/skill-overlap.mjs): time-math answered them first and still does
  for (const a of ['what week number is it', 'week number of oct 25']) assert.equal(fam.part(a, a), 'time-math', a);
  assert.equal(fam.part('30 days after 2026-03-01', '30 days after 2026-03-01'), 'date-calc');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['time-math', 'date-calc']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('date-math')); assert.ok(!index.includes('time-math') && !index.includes('date-calc'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0025-date-math', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0125-date-calc', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0025-time-math', import.meta.url)));
});
