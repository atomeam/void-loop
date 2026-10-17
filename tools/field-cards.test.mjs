// F-038 Living Spatial Cards Mind (lib/field-cards.js): the law with numbers. Run: node --test tools/field-cards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/lib/field-cards.js';

const run = (s, n, input = {}) => { for (let i = 0; i < n; i++) F.step(s, 1 / 60, input); return s; };
test('seeded: the same seed gives the same field, a new seed another', () => {
  const a = run(F.create(7), 60), b = run(F.create(7), 60), c = run(F.create(8), 60);
  assert.deepEqual(Array.from(a.u.slice(0, 200)), Array.from(b.u.slice(0, 200))); assert.notDeepEqual(Array.from(a.u.slice(0, 400)), Array.from(c.u.slice(0, 400)));
  assert.equal(a.cards.length, 5); assert.deepEqual(a.cards.map((x) => x.label), F.LABELS);
});
test('the field stays alive and in bounds: varied, still moving, and richer around the cards than elsewhere', () => {
  const s = run(F.create(7), 900), m = F.metrics(s);
  for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy']) assert.ok(m[k] >= 0 && m[k] <= 1, k + ' ' + m[k]);
  assert.ok(m.entropy > 0.3, 'varied, not a flat sheet: ' + m.entropy); assert.ok(m.activity > 0, 'still moving');
  assert.ok(m.consensus > 0.5, 'the cards pull the field toward them: ' + m.consensus);
  assert.ok(s.u.every((x) => x >= 0 && x <= 1) && s.v.every((x) => x >= 0 && x <= 1));
  for (const c of s.cards) assert.ok(c.x >= 0.06 && c.x <= 0.94 && c.y >= 0.08 && c.y <= 0.92);
});
test('a card takes its look from the field around it: more field, bigger, brighter, a shifted hue', () => {
  const lo = F.cardStyle({ x: 0.5, y: 0.5, hue: 100, local: 0.05 }, 0.001), hi = F.cardStyle({ x: 0.5, y: 0.5, hue: 100, local: 0.6 }, 0.001);
  assert.ok(hi.scale > lo.scale && hi.opacity > lo.opacity && hi.hue !== lo.hue); assert.equal(hi.left, 50); assert.equal(hi.top, 50);
  assert.ok(F.cardStyle({ x: 0.5, y: 0.5, hue: 0, local: 0.3 }, 0).blur > F.cardStyle({ x: 0.5, y: 0.5, hue: 0, local: 0.3 }, 0.01).blur, 'a still field blurs its cards');
});
test('dragging a card seeds the field where it is and raises the ask for rules that answer it', () => {
  const s = run(F.create(3), 200), c = s.cards[4]; c.x = 0.5; c.y = 0.5; const before = F.sample(s.u, 0.5, 0.5);
  s.dragging = 4; run(s, 10); assert.ok(F.sample(s.u, 0.5, 0.5) > before, 'more energy under the dragged card'); assert.ok(s.boost > 0);
  assert.equal(c.x, 0.5, 'a held card does not drift'); s.dragging = -1;
});
test('the mind: a generation is deterministic for its inputs, keeps genomes in range, and never loses its best (elitism)', () => {
  const s = run(F.create(5), 300), arg = { u: Array.from(s.u), v: Array.from(s.v), cards: s.cards, seed: 5, gen: 0 };
  const a = F.evolveCards(arg), b = F.evolveCards(arg);
  assert.deepEqual(a.best, b.best); assert.equal(a.gen, 1); assert.equal(a.pop.length, F.POP);
  for (const g of a.pop) for (const [k, [lo, hi]] of Object.entries(F.SPEC)) assert.ok(g[k] >= lo && g[k] <= hi, k);
  let o = a; for (let i = 0; i < 4; i++) { const n = F.evolveCards({ ...arg, pop: o.pop, gen: o.gen }); assert.ok(n.fitness >= o.fitness - 1e-9, 'the best of a generation is kept'); o = n; }
  F.setGenome(s, { feed: 9, kill: -1 }); assert.ok(s.genome.feed <= F.SPEC.feed[1] && s.genome.kill >= F.SPEC.kill[0], 'a bad genome is clamped');
});
test('the skill (skills/living-cards-mind.js) takes its asks and leaves the look-alikes', async () => {
  const skill = (await import('../void-live-deploy/skills/living-cards-mind.js')).default;
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.ok(skill.stageKinds['living-cards-mind']);
});
