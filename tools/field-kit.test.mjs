import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as K from '../void-live-deploy/lib/field-kit.js';

test('rng: same seed, same sequence; different seed, different; stays in [0,1)', () => {
  const a = K.rng(7), b = K.rng(7), c = K.rng(8);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  const r = K.rng(3); for (let i = 0; i < 100; i++) { const v = r.range(5, 9); assert.ok(v >= 5 && v < 9); assert.ok(r.int(4) < 4); }
  assert.ok(Number.isFinite(K.rng(1).gauss()));
});

test('grid and particles: the Laplacian of a flat grid is 0, of a spike is -4 at the spike, wrapping edges', () => {
  const g = K.makeGrid(5, 5, 1); assert.equal(K.laplacian4(g, 2, 2, 5, 5), 0);
  g[K.idx(0, 0, 5, 5)] = 5; assert.equal(K.laplacian4(g, 0, 0, 5, 5), -16); assert.equal(K.laplacian4(g, 4, 0, 5, 5), 4);
  const p = K.makeParticles(10, K.rng(1), 0.5); K.integrate(p, 10, 0, true);
  for (let i = 0; i < p.n; i++) assert.ok(p.x[i] >= 0 && p.x[i] < 1 && p.y[i] >= 0 && p.y[i] < 1);
  const q = K.makeParticles(10, K.rng(1), 0.5); K.integrate(q, 10, 0, false);
  for (let i = 0; i < q.n; i++) assert.ok(q.x[i] >= 0 && q.x[i] <= 1);
});

test('entropy: one bin is 0, an even spread is 1; occupancy entropy tells bunched from spread', () => {
  assert.equal(K.entropy([0.5, 0.5, 0.5, 0.5]), 0);
  const even = Array.from({ length: 160 }, (_, i) => (i % 16) / 16 + 0.01); assert.ok(K.entropy(even) > 0.99);
  const r = K.rng(2), xs = Array.from({ length: 400 }, r), ys = Array.from({ length: 400 }, r);
  assert.ok(K.occupancyEntropy(xs, ys, 400) > 0.9);
  assert.equal(K.occupancyEntropy(new Float32Array(50).fill(0.5), new Float32Array(50).fill(0.5), 50), 0);
  assert.deepEqual(K.stats([1, 2, 3, 4]), { mean: 2.5, variance: 1.25, min: 1, max: 4 });
});

test('morph: more entropy and activity turn the hue, round the corners and glow; consensus tilts; always within bounds', () => {
  const calm = K.morphOf({ entropy: 0.1, activity: 0.1, consensus: 0.9, cx: 0.5, cy: 0.5 }), wild = K.morphOf({ entropy: 0.9, activity: 0.9, consensus: 0.1, cx: 1, cy: 0 });
  assert.ok(wild.radius > calm.radius && wild.glow > calm.glow && wild.blur > calm.blur && wild.scale > calm.scale);
  assert.notEqual(wild.hue, calm.hue); assert.ok(wild.hudX > 0 && wild.hudY < 0);
  for (const m of [{}, { entropy: 5, activity: -3, consensus: NaN }, { entropy: 1, activity: 1, consensus: 0 }]) { const o = K.morphOf(m); assert.ok(o.blur >= 0 && o.blur <= 1.5 && o.scale >= 0.94 && o.scale <= 1.06 && o.radius >= 8 && o.radius <= 28 && o.hue >= 0 && o.hue < 360); }
  const css = K.morphCss(wild);
  assert.match(css.filter, /^hue-rotate\([\d.]+deg\)$/); assert.match(css.canvasFilter, /^blur\(/); assert.match(css.transform, /^scale\(/); assert.match(css.hud, /^translate\(.*\) rotate\(/);
  assert.equal(K.morphCss(K.morphOf({ entropy: 0, activity: 0, consensus: 1 })).canvasFilter, 'none');
  assert.equal(css.vars['--ff-hue'], String(wild.hue));
});

test('evolution: deterministic by seed, keeps the elite, stays inside the spec, and climbs a simple fitness', () => {
  const spec = { a: [0, 1], b: [-2, 2] }, fit = (g) => -((g.a - 0.8) ** 2) - (g.b - 1) ** 2;
  const run = (seed) => { const r = K.rng(seed); let pop = Array.from({ length: 8 }, () => K.randomGenome(spec, r)); const first = Math.max(...pop.map(fit)); for (let i = 0; i < 40; i++) pop = K.evolveStep(pop, pop.map(fit), spec, r); return { pop, first, last: Math.max(...pop.map(fit)) }; };
  const x = run(5), y = run(5); assert.deepEqual(x.pop, y.pop); assert.ok(x.last >= x.first);
  for (const g of x.pop) { assert.ok(g.a >= 0 && g.a <= 1 && g.b >= -2 && g.b <= 2); }
  const r = K.rng(1), pop = [{ a: 0.1, b: 0 }, { a: 0.9, b: 1 }, { a: 0.5, b: 0 }], next = K.evolveStep(pop, [0, 9, 1], spec, r); assert.deepEqual(next[0], pop[1]);
});

test('inputs and sound: pointer and tilt are clamped numbers, the drone follows the metrics and pans with attention', () => {
  assert.deepEqual(K.pointerIn(150, 50, { left: 100, top: 0, width: 100, height: 100 }), { x: 0.5, y: 0.5 }); assert.equal(K.pointerIn(-5, 500, { left: 0, top: 0, width: 10, height: 10 }).y, 1);
  assert.deepEqual(K.tiltOf(90, -90), { x: -1, y: 1 }); assert.deepEqual(K.tiltOf(undefined, undefined), { x: 0, y: 0 });
  const lo = K.audioMap({ entropy: 0, activity: 0, consensus: 0, cx: 0 }), hi = K.audioMap({ entropy: 1, activity: 1, consensus: 1, cx: 1 });
  assert.ok(hi.freqs[0] > lo.freqs[0] && hi.master > lo.master && lo.pan === -1 && hi.pan === 1); assert.equal(lo.freqs.length, 3);
});

test('seal: SHA-256 matches node:crypto, is stable under key order and tiny float noise, and changes with a param or a metric', async () => {
  for (const s of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(200), 'café ☃']) assert.equal(K.sha256Sync(s), createHash('sha256').update(s).digest('hex'), s.length + '');
  assert.equal(K.sha256Sync('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await K.sha256Hex('abc'), K.sha256Sync('abc'));
  const a = await K.seal('rd', { f: 0.037, k: 0.06 }, { entropy: 0.5, activity: 0.2 }), b = await K.seal('rd', { k: 0.06, f: 0.037000001 }, { activity: 0.2, entropy: 0.5 });
  assert.equal(a.hash, b.hash); assert.equal(a.short.length, 12); assert.equal(K.sealSync('rd', { f: 0.037, k: 0.06 }, { entropy: 0.5, activity: 0.2 }).hash, a.hash);
  assert.notEqual((await K.seal('rd', { f: 0.038, k: 0.06 }, { entropy: 0.5, activity: 0.2 })).hash, a.hash);
  assert.notEqual((await K.seal('fluid', { f: 0.037, k: 0.06 }, { entropy: 0.5, activity: 0.2 })).hash, a.hash);
  assert.equal(K.canonical({ b: [1, 2.00004], a: undefined, c: 'x' }), '{"b":[1,2],"c":"x"}');
  assert.ok(!/\d{13}/.test(a.text), 'no timestamp or raw history in the sealed text');
});
