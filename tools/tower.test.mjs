import test from 'node:test';
import assert from 'node:assert/strict';
import { tower, gate, FLOORS, aspectsOf, towerLine } from '../void-live-deploy/lib/tower.js';
import { verdict, record } from './tower-gate.mjs';
const all = (f, v = 'better') => Object.fromEntries(aspectsOf(f).map((a) => [a, { verdict: v, evidence: 'x' }]));
test('a floor is beaten only when every aspect passes with evidence', () => {
  const f = FLOORS[0]; assert.equal(gate(f, all(f)).beaten, true);
  const e = all(f); delete e.speed; assert.equal(gate(f, e).beaten, false); assert.deepEqual(gate(f, e).left, ['speed']);
  const n = all(f); n.speed.evidence = ''; assert.equal(gate(f, n).beaten, false);
});
test('the marker never passes a floor whose gate fails, and a regression un-beats', () => {
  const ev = { [FLOORS[1].id]: all(FLOORS[1]) }; let t = tower([], ev);
  assert.equal(t.floors[0].id, FLOORS[1].id); assert.equal(t.marker, 2); // measured floors sort first by gap
  const r = record({ verdict: 'better' }, 'worse', 900, 500, 'e', 'now'); assert.equal(r.was, 'better');
  ev[FLOORS[1].id].speed = r; t = tower([], ev); assert.equal(t.marker, 1); assert.equal(t.floors[0].regressed.length, 1);
  assert.match(towerLine(t), /^Tower: floor 1 of 24 \(/);
});
test('verdicts come from numbers only', () => {
  assert.equal(verdict(100, 200), 'better'); assert.equal(verdict(3, 3, true), 'equal'); assert.equal(verdict(NaN, 1), 'unverified');
});
test('the tower skill answers its asks and not near misses', async () => {
  const { default: sk } = await import('../void-live-deploy/skills/tower.js');
  for (const a of sk.examples) assert.equal(sk.match(a.toLowerCase(), a), true, a);
  for (const a of sk.nearMisses) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  const t = tower([], {}), h = sk.towerHtml(t, (s) => String(s));
  assert.equal((h.match(/class="tower-floor"/g) || []).length, 24); assert.doesNotMatch(h, /<img|logo/i);
  assert.match(sk.detailText(t.floors[0]), /^0 of 11 aspects beaten on /);
});
