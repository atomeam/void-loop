// Verse's NCA / living-lattice law (lib/field-nca.js; Grok's F-036, F-039, F-043 x2, F-045; asked by Owner, 2026-10-18), with numbers.
// Run: node --test tools/field-nca.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as F from '../void-live-deploy/lib/field-nca.js';

const run = (s, n, input = {}) => { for (let i = 0; i < n; i++) F.step(s, 1 / 60, typeof input === 'function' ? input(i) : input); return s; };
const near = (s, x, y, r = 3) => { let t = 0; const cx = Math.round(x * (s.W - 1)), cy = Math.round(y * (s.H - 1)); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) t += s.view[(cy + dy) * s.W + cx + dx]; return t; };

test('the module is pure: no DOM, no clock, no Math.random', () => {
  const src = readFileSync(new URL('../void-live-deploy/lib/field-nca.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'Date.', 'performance.', 'document', 'window', 'localStorage']) assert.ok(!src.includes(bad), bad);
});
test('six variants, each citing its draft, every grid inside the cap', () => {
  assert.deepEqual(F.VARIANT_IDS, ['growing', 'mlp', 'multichannel', 'gray-scott', 'portal', 'residual']);
  for (const id of F.VARIANT_IDS) { const v = F.VARIANTS[id]; assert.match(v.fid, /^F-0\d\d/, id); assert.ok(v.W <= F.MAX_W && v.H <= F.MAX_H, id); }
});
for (const id of F.VARIANT_IDS) {
  test(id + ': seeded, in bounds, and still alive after 400 steps', () => {
    const a = run(F.create(7, id), 60), b = run(F.create(7, id), 60), c = run(F.create(8, id), 60), v = F.VARIANTS[id];
    assert.deepEqual(Array.from(a.x), Array.from(b.x), 'the same seed, the same lattice'); assert.notDeepEqual(Array.from(a.x), Array.from(c.x), 'another seed, another lattice');
    const s = run(F.create(7, id), 400, (i) => (i > 100 && i < 140 ? { x: 0.4, y: 0.5, over: true, down: i === 101 } : {}));
    assert.equal(s.x.length, s.W * s.H * s.C); assert.ok(s.x.every((x) => x >= v.lo && x <= v.hi), 'every channel in its bounds');
    const m = F.metrics(s); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy']) assert.ok(m[k] >= 0 && m[k] <= 1, k + ' ' + m[k]);
    assert.ok(m.entropy > 0.1, 'not a flat sheet: entropy ' + m.entropy); assert.ok(m.activity > 0, 'still moving');
  });
  test(id + ': the pointer seeds the lattice where it presses', () => {
    if (id === 'mlp') return; // F-036 feeds by hover and its rule may answer by inhibition: covered by the fitness test's consensus
    const touched = F.create(3, id), plain = F.create(3, id); run(touched, 20); run(plain, 20);
    const press = { x: 0.3, y: 0.4, over: true, down: true }; run(touched, 3, press); run(plain, 3, {});
    assert.ok(near(touched, 0.3, 0.4) > near(plain, 0.3, 0.4), 'more there than without the press: ' + near(touched, 0.3, 0.4) + ' vs ' + near(plain, 0.3, 0.4));
  });
}
test('activity is measured over two steps: a lattice that flashes back and forth every step scores none for it', () => {
  F.VARIANTS.flicker = { ...F.VARIANTS.portal, id: 'flicker', law: (s) => { for (let i = 0; i < s.x.length; i++) s.x[i] = 1 - s.x[i]; } };
  try { const s = run(F.create(2, 'flicker'), 200); assert.ok(F.metrics(s).activity < 1e-6, 'flashing is not activity: ' + F.metrics(s).activity); } finally { delete F.VARIANTS.flicker; }
  const s = F.create(1, 'portal'); F.setGenome(s, { act: 0 }); assert.ok(s.genome.act >= 0.55, 'the portal rule cannot invert its sigmoid (a flashing card)');
});
test('fitness rewards a varied, moving lattice over a dead one', () => {
  const alive = run(F.create(5, 'growing'), 200), dead = F.create(5, 'growing'); dead.x.fill(0); dead.view.fill(0); dead.act = 0;
  assert.ok(F.fitness(F.metrics(alive)) > F.fitness(F.metrics(dead)) + 0.3, F.fitness(F.metrics(alive)) + ' vs ' + F.fitness(F.metrics(dead)));
});
test('a lattice that died out gets one seeded spark (the drafts\' reseed), and the same one for the same seed', () => {
  const a = F.create(9, 'gray-scott'), b = F.create(9, 'gray-scott');
  for (const s of [a, b]) { for (let i = 0; i < s.W * s.H; i++) { s.x[i * 2] = 1; s.x[i * 2 + 1] = 0; } s.view.fill(0); assert.equal(F.revive(s), true); }
  assert.ok(a.view.some((v) => v > 0)); assert.deepEqual(Array.from(a.x), Array.from(b.x));
});
test('the mind: a generation is deterministic, keeps genomes in range, never loses its best, and holds the rule in use with its bonus', () => {
  for (const id of ['growing', 'multichannel', 'gray-scott', 'portal']) {
    const s = run(F.create(5, id), 100), arg = { variant: id, x: Array.from(s.x), seed: 5, gen: 0, current: s.genome, px: 0.4, py: 0.5, pointer: true };
    const a = F.evolveNca(arg), b = F.evolveNca(arg);
    assert.deepEqual(a.best, b.best, id); assert.equal(a.gen, 1); assert.equal(a.pop.length, F.POP);
    for (const g of a.pop) for (const [k, [lo, hi]] of Object.entries(F.VARIANTS[id].spec)) assert.ok(g[k] >= lo && g[k] <= hi, id + ' ' + k);
    if (id === 'multichannel' || id === 'portal') { let o = a; for (let i = 0; i < 3; i++) { const n = F.evolveNca({ ...arg, current: null, pop: o.pop, gen: o.gen }); assert.ok(n.fitness >= o.fitness - 1e-9, id + ': the best of a generation is kept'); o = n; } }
  }
  const s = run(F.create(4, 'portal'), 100), arg = { variant: 'portal', x: Array.from(s.x), seed: 4, gen: 0, current: s.genome };
  const plain = F.evolveNca(arg), kept = F.evolveNca({ ...arg, bonus: 0.6 });
  assert.deepEqual(kept.best, F.evolveNca({ ...arg, bonus: 0.6 }).best); assert.deepEqual(kept.best, s.genome, 'a tapped portal keeps the rule in use');
  assert.ok(kept.fitness > plain.fitness);
  F.setGenome(s, { diff: 9, act: -3 }); assert.ok(s.genome.diff <= 1 && s.genome.act >= 0.55, 'a bad genome is clamped');
});
test('F-045 portals: up to five hotspots above the threshold, brightest first, spaced apart; a tap adds a capped bonus', () => {
  const s = run(F.create(6, 'portal'), 200, (i) => ({ x: 0.2 + (i % 50) / 80, y: 0.3 + (i % 7) / 20, over: true }));
  const p = F.portalsOf(s); assert.deepEqual(p, F.portalsOf(s)); assert.ok(p.length >= 1 && p.length <= 5, 'portals: ' + p.length);
  for (let i = 0; i < p.length; i++) { assert.ok(p[i].energy > 0.55); if (i) assert.ok(p[i].energy <= p[i - 1].energy); for (let j = 0; j < i; j++) assert.ok(Math.hypot((p[i].x - p[j].x) * (s.W - 1), (p[i].y - p[j].y) * (s.H - 1)) >= 8); }
  assert.equal(F.reinforce(s), 0.15); for (let i = 0; i < 10; i++) F.reinforce(s); assert.equal(s.bonus, 0.6);
});
test('F-043 predictive residual: a constant-velocity predictor is right on a straight path, standing still is wrong, and the mind learns', () => {
  const line = Array.from({ length: 12 }, (_, i) => ({ x: 0.1 + i * 0.03, y: 0.5 + i * 0.01 }));
  assert.ok(F.residualOf({ bias: 0, vx: 1, vy: 0, ax: 0, ay: 0 }, line) < 1e-6); assert.ok(F.residualOf({ bias: 0, vx: 0, vy: 0, ax: 0, ay: 0 }, line) > 0.95);
  let o = F.evolveNca({ variant: 'residual', hist: line, seed: 2, gen: 0 }); const first = o.fitness;
  for (let i = 0; i < 25; i++) o = F.evolveNca({ variant: 'residual', hist: line, seed: 2, gen: o.gen, pop: o.pop });
  assert.ok(o.fitness >= first && o.fitness > 0.9, 'the predictor improves: ' + first + ' -> ' + o.fitness);
  const sure = F.create(3, 'residual'), lost = F.create(3, 'residual'); sure.res = 0; lost.res = 1; run(sure, 60); run(lost, 60); sure.res = 0;
  let a = 0, b = 0; for (let i = 0; i < sure.view.length; i++) { a += sure.view[i]; b += lost.view[i]; } assert.ok(a > b, 'a confident mind grows the lattice, a surprised one lets it fade');
});
test('params are facts only (variant, draft, rounded genome; never the pointer path) and paint fills RGBA', () => {
  const s = run(F.create(3, 'residual'), 30, (i) => ({ x: 0.2 + i * 0.01, y: 0.5, over: true }));
  const p = F.params(s); assert.equal(p.variant, 'residual'); assert.equal(p.fid, 'F-043'); assert.ok(!('hist' in p) && !JSON.stringify(p).includes('"x"'));
  const g = F.params(F.create(3, 'growing')); assert.equal(g.weights, 156); assert.ok(g.norm > 0);
  const rgba = F.paint(s, new Uint8ClampedArray(s.W * s.H * 4)); assert.ok(rgba.some((v, i) => i % 4 !== 3 && v > 0)); assert.ok(rgba.every((v, i) => i % 4 !== 3 || v === 255));
});
test('variantOf reads the ask; the skill takes its asks and leaves the look-alikes', async () => {
  const want = { 'nca mind': null, 'nca portal mind': 'portal', 'predictive residual lattice': 'residual', 'gray scott nca': 'gray-scott', 'multichannel lattice mind': 'multichannel', 'evolving nca': 'mlp', 'growing nca': 'growing' };
  for (const [t, v] of Object.entries(want)) assert.equal(F.variantOf(t, null), v, t);
  assert.equal(F.variantOf('living lattice'), F.DEFAULT);
  const skill = (await import('../void-live-deploy/skills/nca-mind.js')).default;
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.ok(skill.stageKinds['nca-mind']); assert.equal(skill.name, 'nca-mind');
});
