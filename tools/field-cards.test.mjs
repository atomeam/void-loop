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
test('family gravity (asked by Void): cards of one family draw together and stop REST apart, a lone family feels nothing, a held card brings its family', () => {
  const s = F.create(4); assert.deepEqual(s.cards.map((c) => c.family), F.LABELS.map((l) => F.FAMILIES[l]));
  const [idea, , , mind, you] = s.cards, gap = () => Math.hypot(idea.x - mind.x, idea.y - mind.y), d0 = gap(), y0 = { x: you.x, y: you.y };
  s.u.fill(0); s.v.fill(1); for (let i = 0; i < 2000; i++) F.driftCards(s.u, s.cards, 1); // a flat field: only gravity moves them
  assert.ok(d0 > F.REST * 2 && Math.abs(gap() - F.REST) < 0.01, 'idea and mind meet, REST apart: ' + d0 + ' -> ' + gap());
  assert.deepEqual({ x: you.x, y: you.y }, y0, 'alone in its family, "you" stays where it was');
  assert.deepEqual(F.familyPull([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }], 0), { dx: 0, dy: 0 }, 'no family, no pull');
  idea.x = 0.9; idea.y = 0.2; const held = { x: idea.x, y: idea.y };
  for (let i = 0; i < 2000; i++) F.driftCards(s.u, s.cards, 1, 0);
  assert.deepEqual({ x: idea.x, y: idea.y }, held, 'the held card is not moved'); assert.ok(Math.abs(gap() - F.REST) < 0.01, 'its family followed it: ' + gap());
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
test('the velocity trail (asked by Void): a card keeps its last TRAIL positions, and a moving card has speed where a still one has none', () => {
  const t = []; for (let i = 0; i < F.TRAIL + 10; i++) F.trailPush(t, { x: 0.1 + i * 0.01, y: 0.5 });
  assert.equal(t.length, F.TRAIL); assert.ok(Math.abs(F.trailSpeed(t) - 0.01) < 1e-9, 'one hundredth of the field a frame');
  const still = []; for (let i = 0; i < 5; i++) F.trailPush(still, { x: 0.3, y: 0.3 });
  assert.equal(F.trailSpeed(still), 0); assert.equal(F.trailSpeed([]), 0);
});

test('displacement ripple (asked by Void): a moving card drops a ripple every RIPPLE_EVERY ms, a still one none; a ripple grows, fades and is gone after RIPPLE_LIFE', async () => {
  const F = await import('../void-live-deploy/lib/field-cards.js');
  const moving = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }], still = [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
  const cards = [{ x: 0.2, y: 0.1 }, { x: 0.5, y: 0.5 }], rs = [];
  let last = F.rippleTick(rs, cards, [moving, still], 1000);
  assert.equal(last, 1000); assert.deepEqual(rs, [{ x: 0.2, y: 0.1, t: 1000 }], 'only the moving card ripples');
  assert.equal(F.rippleTick(rs, cards, [moving, still], 1000 + F.RIPPLE_EVERY - 1, last), last, 'not again too soon'); assert.equal(rs.length, 1);
  last = F.rippleTick(rs, cards, [moving, still], 1000 + F.RIPPLE_EVERY, last); assert.equal(rs.length, 2);
  const a0 = F.rippleAt(rs[0], 1000), mid = F.rippleAt(rs[0], 1000 + F.RIPPLE_LIFE / 2), end = F.rippleAt(rs[0], 1000 + F.RIPPLE_LIFE);
  assert.ok(a0.r === 0 && a0.a === 1); assert.ok(mid.r > F.RIPPLE_R / 2 && mid.a === 0.5, 'eases out: past half its size at half its life'); assert.ok(end.r === F.RIPPLE_R && end.a === 0);
  F.rippleTick(rs, cards, [still, still], 1000 + F.RIPPLE_LIFE + F.RIPPLE_EVERY + 1, last); assert.equal(rs.length, 0, 'old ripples go; a still field drops none');
  const many = []; for (let t = 0; t < 40; t++) F.rippleTick(many, cards, [moving, moving], t * F.RIPPLE_EVERY, (t - 1) * F.RIPPLE_EVERY);
  assert.ok(many.length <= F.RIPPLE_MAX);
});
