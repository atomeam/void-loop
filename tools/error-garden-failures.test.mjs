// The error garden grown from the incident autopsy: failurePlants, plantMany, the ask. node --test tools/error-garden-failures.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { failurePlants } from '../void-live-deploy/lib/autopsy.js';
import garden, { gardenIntent, plantMany, stageOf } from '../void-live-deploy/skills/error-garden.js';
const INC = { incidents: [
  { at: '2026-10-17T10:00:00Z', sha: 'aaaaaaa1', suite: 's', checks: ['clock: "what time" fails', 'quiz card: reload', 'clock: again'] },
  { at: '2026-10-17T09:00:00Z', sha: 'bbbbbbb2', suite: 's', checks: ['clock: other', 'go board: stone'] },
  { at: 'bad', sha: 'nothex', checks: ['ignored: x'] },
] };
test('one plant per failing check title, counted by incident, most repeated first', () => {
  const p = failurePlants(INC);
  assert.deepEqual(p.map((x) => [x.text, x.count]), [['clock', 2], ['quiz card', 1], ['go board', 1]]);
  assert.deepEqual(failurePlants(null), []); assert.equal(failurePlants(INC, 1).length, 1);
});
test('planting the failures: repeats are weeds, a second run keeps the larger count and adds nothing twice', () => {
  const a = plantMany([], failurePlants(INC), 1);
  assert.deepEqual(a.map(stageOf), ['weed', 'sprout', 'sprout']);
  const b = plantMany(a, failurePlants(INC), 2);
  assert.equal(b.length, 3); assert.equal(b[0].count, 2);
  const c = plantMany([{ text: 'go board', count: 1, rule: 'x'.repeat(3) }], [{ text: 'go board', count: 3 }]);
  assert.equal(c.length, 1); assert.equal(c[0].count, 3); assert.equal(c[0].rule, 'xxx');
});
test('the asks, and the near misses that stay elsewhere', () => {
  for (const a of ['plant my test failures', 'plant my test failures in my error garden', 'plant the failures from the incident autopsy in my error garden', 'visualize your test failures', 'grow my recent errors in the error garden'.replace(' in the error garden', '')]) assert.equal(gardenIntent(a)?.act, 'failures', a);
  for (const a of ['plant tomato failures', 'what are test failures', 'visualize your data', 'plant my mistake:']) assert.equal(gardenIntent(a), null, a);
  assert.ok(garden.match('plant my test failures', 'plant my test failures'));
});
