import test from 'node:test';
import assert from 'node:assert/strict';
import { onlySiteLine, overhaulWeights, compare, lapProgress, upgradeAsk, nextStep, advance, lapLine, publicLap, staleness, candidateOf, NEW_PER_LAP } from '../void-live-deploy/lib/lap.js';
test('a lap touches every skill once, then new features, then a new lap over the bigger set', () => {
  let s = null; const seen = []; const skills = ['b', 'a', 'c'];
  for (let i = 0; i < 3; i++) { const r = nextStep(s, skills, { c: 5 }); assert.equal(r.step.kind, 'upgrade'); seen.push(r.step.skill); s = advance(r.state, r.step); }
  assert.deepEqual(seen, ['c', 'a', 'b']);
  for (let i = 0; i < NEW_PER_LAP; i++) { const r = nextStep(s, skills); assert.equal(r.step.kind, 'new'); s = advance(r.state, r.step); }
  const r = nextStep(s, skills); assert.equal(r.state.lap, 2); assert.equal(r.state.order.length, 3); assert.equal(nextStep(advance(r.state, r.step), [...skills, 'd']).state.order.length, 4);
});
test('a skill added mid-lap joins this lap; the line is counts only', () => {
  let r = nextStep(null, ['a']); let s = advance(r.state, r.step); r = nextStep(s, ['a', 'z']);
  assert.equal(r.step.skill, 'z'); assert.equal(lapLine(r.state), 'Lap 1: upgraded 1 of 2 items, 0 of ' + NEW_PER_LAP + ' new this lap');
  assert.equal(publicLap(r.state).skills, 2);
});
test('staleness and the want never say done', () => {
  assert.equal(staleness(null, 0), 52); assert.equal(staleness('2026-10-01T00:00:00Z', Date.parse('2026-10-22T00:00:00Z')), 3);
  assert.doesNotMatch(candidateOf({ kind: 'upgrade', skill: 'chess' }).title, /\bdone\b/);
});
test('an item is better only when a fact rose and none fell; plans get no external actions', () => {
  assert.equal(compare({ lines: 10, tests: 1 }, { lines: 12, tests: 1 }).better, true);
  assert.equal(compare({ lines: 10, tests: 1 }, { lines: 12, tests: 0 }).better, false);
  assert.deepEqual(lapProgress({ a: { n: 1 }, b: { n: 1 } }, [{ id: 'a', facts: { n: 2 } }, { id: 'b', facts: { n: 1 } }]), { better: 1, notYet: 1 });
  assert.match(upgradeAsk('plan:void.store.md'), /no external actions/);
});
test('lap 1 is an overhaul, most used first', () => {
  const ids = ['skill:zz', 'surface:book', 'surface:home', 'skill:chess'], r = nextStep(null, ids, overhaulWeights(ids));
  assert.equal(r.step.skill, 'surface:home'); assert.match(candidateOf(r.step).title, /^Overhaul surface:home: persona playtest/); assert.match(candidateOf(r.step).title, /wider use/, 'every overhaul asks for wider use (docs/WIDER-USE.md)');
});
test('the only-site line is counts only', () => {
  assert.equal(onlySiteLine({ replaced: 1, partial: 2, missing: 3, categories: 6 }), 'Only site you need: 1 replaced, 2 partial, 3 missing of 6 categories');
});
test('a lap keeps when it began (its first step) and the public tracker names the last items taken, for the wants card', () => {
  let r = nextStep(null, ['a', 'b', 'c', 'd']); let s = advance(r.state, r.step, '2026-10-29T01:00:00Z');
  assert.equal(s.since, '2026-10-29T01:00:00Z');
  r = nextStep(s, ['a', 'b', 'c', 'd']); s = advance(r.state, r.step, '2026-10-29T02:00:00Z');
  assert.equal(s.since, '2026-10-29T01:00:00Z', 'a later step does not move the start');
  assert.deepEqual(publicLap(s).recent, ['b', 'a']); assert.equal(publicLap(s).since, '2026-10-29T01:00:00Z'); assert.equal(publicLap(s).next, 'c');
  // a lap already under way when this was added has no start: it never gets one made up from a later step
  const old = advance({ lap: 1, pos: 2, order: ['a', 'b', 'c'], newThisLap: 0, at: null }, { kind: 'upgrade', skill: 'c' }, '2026-10-29T03:00:00Z');
  assert.equal(old.since, undefined); assert.equal('since' in publicLap(old), false); assert.deepEqual(publicLap(old).recent, ['c', 'b', 'a']);
  assert.deepEqual(publicLap(null).recent, []);
  // the next lap starts its own clock
  for (let i = 0; i < NEW_PER_LAP; i++) { r = nextStep(s, ['a', 'b']); s = advance(r.state, r.step, '2026-10-30T00:00:00Z'); }
  while (s.lap === 1) { r = nextStep(s, ['a', 'b']); s = advance(r.state, r.step, '2026-11-01T00:00:00Z'); }
  assert.equal(s.lap, 2); assert.equal(s.since, '2026-11-01T00:00:00Z');
});
