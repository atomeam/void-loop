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
  assert.match(towerLine(t), new RegExp('^Tower: floor 1 of ' + FLOORS.length + ' \\('));
});
test('verdicts come from numbers only', () => {
  assert.equal(verdict(100, 200), 'better'); assert.equal(verdict(3, 3, true), 'equal'); assert.equal(verdict(NaN, 1), 'unverified');
});
test('the tower skill answers its asks and not near misses', async () => {
  const { default: sk } = await import('../void-live-deploy/skills/tower.js');
  for (const a of sk.examples) assert.equal(sk.match(a.toLowerCase(), a), true, a);
  for (const a of sk.nearMisses) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  const t = tower([], {}), h = sk.towerHtml(t, (s) => String(s));
  assert.equal((h.match(/class="tower-floor"/g) || []).length, FLOORS.length); assert.doesNotMatch(h, /<img|logo/i);
  assert.match(sk.detailText(t.floors[0]), /^0 of 11 aspects beaten on /);
});
test('the live card tells what moved between two polls', async () => {
  const sk = (await import('../void-live-deploy/skills/tower.js')).default;
  const a = tower([], {}), ev = { [FLOORS[0].id]: Object.fromEntries(aspectsOf(FLOORS[0]).map((x) => [x, { verdict: 'better', evidence: 'e' }])) }, b = tower([], ev);
  assert.deepEqual(sk.changes(a, a), []);
  const said = sk.changes(a, b).join(' ');
  assert.match(said, /isitchristmas\.com is beaten\./); assert.match(said, /marker moved to floor 2/);
  assert.match(sk.changes(b, a).join(' '), /isitchristmas\.com slipped\./);
  assert.deepEqual(sk.changes(null, b), []);
});

test('a tie at the ideal score passes as equal-and-better; any other tie, or speed, stays equal', async () => {
  const { verdict, rescore } = await import('./tower-gate.mjs');
  assert.equal(verdict(0, 0, false, 0), 'equal-and-better'); assert.equal(verdict(3, 3, true, 3), 'equal-and-better');
  assert.equal(verdict(2, 2, true, 3), 'equal'); assert.equal(verdict(900, 900, false), 'equal'); assert.equal(verdict(1, 0, false, 0), 'worse');
  const r = rescore({ mobile: { verdict: 'equal', verse: 0, best: 0, evidence: 'e' }, reliability: { verdict: 'equal', verse: 3, best: 3, evidence: 'e' }, speed: { verdict: 'worse', verse: 3341, best: 908, evidence: 'e' }, history: { verdict: 'better', evidence: 'argon' } });
  assert.equal(r.mobile.verdict, 'equal-and-better'); assert.equal(r.reliability.verdict, 'equal-and-better'); assert.equal(r.speed.verdict, 'worse'); assert.equal(r.history.verdict, 'better');
});
