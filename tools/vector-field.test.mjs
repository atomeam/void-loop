import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../void-live-deploy/lib/field-vector.js';
import { morphOf, sha256Sync } from '../void-live-deploy/lib/field-kit.js';

// fields made on purpose: a pure source, a pure swirl, a flat stream
const mk = (fn) => { const f = new Float32Array(V.CELLS * 2); for (let j = 0; j < V.ROWS; j++) for (let i = 0; i < V.COLS; i++) { const [u, v] = fn(i / (V.COLS - 1) - 0.5, j / (V.ROWS - 1) - 0.5); f[(j * V.COLS + i) * 2] = u; f[(j * V.COLS + i) * 2 + 1] = v; } return f; };

test('divergence and curl are the real local ones: a source has div and no curl, a swirl the reverse, a uniform stream neither', () => {
  const src = V.divCurl(mk((x, y) => [x * 2, y * 2])), swirl = V.divCurl(mk((x, y) => [-y * 2, x * 2])), flat = V.divCurl(mk(() => [1, 0.5]));
  assert.ok(Math.abs(src.meanAbsDiv - 4) < 1e-4 && src.meanAbsCurl < 1e-4, JSON.stringify(src.meanAbsDiv));
  assert.ok(Math.abs(swirl.meanAbsCurl - 4) < 1e-4 && swirl.meanAbsDiv < 1e-4);
  assert.ok(flat.ink === 0 && flat.meanAbsDiv < 1e-6 && flat.meanAbsCurl < 1e-6);
  assert.ok(src.ink > 0 && swirl.ink > 0 && src.ink <= 1);
  assert.equal(src.div.length, (V.COLS - 2) * (V.ROWS - 2));
});

test('the genome blends vectors, not angles: two cells at 10 and 350 degrees blend to about 0, not 180', () => {
  const g = V.moderateGenome(); g.scale = 1; for (let i = 0; i < V.CELLS; i++) { g['m' + i] = 1; g['a' + i] = (i % 2 ? 350 : 10) * Math.PI / 180; }
  const [u, v] = V.sample(V.fieldOf(g), 0.5, 0.5); assert.ok(u > 0.9 && Math.abs(v) < 0.2, u + ',' + v);
});

test('the step is deterministic by seed, keeps particles in the square, and a stream carries them while a pointer pulls the ones in reach', () => {
  const run = (seed, input) => { const s = V.create(seed, { n: 64 }); for (let k = 0; k < 60; k++) V.step(s, 1 / 30, input); return s; };
  const a = run(3, {}), b = run(3, {}); assert.deepEqual(Array.from(a.p.x), Array.from(b.p.x));
  assert.ok(Array.from(a.p.x).every((v) => v >= 0 && v < 1));
  const free = run(5, {}), pulled = run(5, { over: true, x: 0.5, y: 0.5 });
  assert.ok(pulled.near > free.near && pulled.interact > 0);
  const dist = (s) => { let t = 0; for (let i = 0; i < s.p.n; i++) t += Math.hypot(s.p.x[i] - 0.5, s.p.y[i] - 0.5); return t / s.p.n; };
  assert.ok(dist(pulled) < dist(free), 'the pointer pulls the field toward it');
  const far = V.create(2, { n: 8 }); far.p.x.fill(0.9); far.p.y.fill(0.9); const before = Array.from(far.p.x); V.step(far, 1 / 30, { over: true, x: 0.1, y: 0.1 }); assert.equal(far.near, 0, 'outside the radius the pointer does nothing'); assert.ok(before.length === 8);
});

test('fitness prefers a spread-out, moderate flow over a collapsed one, and is repeatable', () => {
  const calm = V.moderateGenome(), sink = V.moderateGenome(); for (let i = 0; i < V.CELLS; i++) { const cx = (i % V.COLS) / (V.COLS - 1) - 0.5, cy = Math.floor(i / V.COLS) / (V.ROWS - 1) - 0.5; sink['a' + i] = (Math.atan2(-cy, -cx) + 2 * Math.PI) % (2 * Math.PI); sink['m' + i] = 2.5; }
  sink.scale = 1.2; sink.decay = 3;
  const fc = V.fitness(calm, { seed: 4 }), fs = V.fitness(sink, { seed: 4 });
  assert.ok(fc.fit > fs.fit, fc.fit + ' vs ' + fs.fit); assert.deepEqual(V.fitness(calm, { seed: 4 }), fc);
  const withPointer = V.fitness(calm, { seed: 4, pointer: { x: 0.5, y: 0.5 } }); assert.ok(withPointer.inter >= 0 && withPointer.inter <= 1);
});

test('the mind: every thought is deterministic by seed, keeps the best, never gets worse, and stays inside the genome spec', () => {
  const t = (seed) => { const m = V.createMind(seed); const best = []; for (let i = 0; i < 6; i++) { V.think(m); best.push(m.bestFit); } return { m, best }; };
  const x = t(9), y = t(9); assert.deepEqual(x.best, y.best); assert.equal(x.m.gen, 6);
  for (let i = 1; i < x.best.length; i++) assert.ok(x.best[i] >= x.best[i - 1] - 1e-9, 'elitism: ' + x.best.join(','));
  for (const g of x.m.pop) for (const [k, [lo, hi]] of Object.entries(V.SPEC)) assert.ok(g[k] >= lo - 1e-9 && g[k] <= hi + 1e-9, k);
  assert.equal(x.m.pop.length, 6);
});

test('the causal chain: more divergence and curl -> more ink density -> stronger glow, scale and sharper card; none -> soft', () => {
  const calm = { dispersion: 0.5, energy: 0.3, align: 0.5, ink: V.divCurl(mk(() => [1, 0])).ink, cx: 0.5, cy: 0.5 }, busy = { ...calm, ink: V.divCurl(mk((x, y) => [-y * 6 + x * 5, x * 6 + y * 5])).ink };
  assert.equal(calm.ink, 0); assert.ok(busy.ink > 0.3);
  const mc = V.morphField(calm), mb = V.morphField(busy);
  assert.ok(mb.glow > mc.glow && mb.scale > mc.scale && mb.ink > mc.ink); assert.equal(V.inkVars(busy)['--ink-density'], String(mb.ink));
  assert.deepEqual(V.kitMetrics(busy).entropy, busy.dispersion);
  const hot = V.morphField({ ...busy, dispersion: 0.95 }); assert.ok(hot.radius > mb.radius, 'dispersion rounds the corners');
  assert.deepEqual(morphOf(V.kitMetrics(calm)).hue, mc.hue);
});

test('measure reads the live field: div and curl of the moderate swirl are mostly curl, and dispersion rises as particles spread', () => {
  const s = V.create(1, { n: 200 }); const m = V.measure(s); assert.ok(m.absCurl > m.absDiv, 'a swirl is curl-heavy'); assert.ok(m.ink > 0 && m.ink <= 1);
  s.p.x.fill(0.3); s.p.y.fill(0.3); const tight = V.measure(s).dispersion; const r = V.create(1, { n: 200 }); assert.ok(V.measure(r).dispersion > tight && tight === 0);
});

test('the seal is facts only and stable: the genome and the numbers, with no time, no particles and no pointer path; the meta names its version and genome hash', () => {
  const g = V.moderateGenome(), m = V.measure(V.create(1)), s = V.sealField(g, m), s2 = V.sealField({ ...g }, { ...m });
  assert.equal(s.hash, s2.hash); assert.equal(s.hash, sha256Sync(s.text)); assert.ok(!/pointer|history|path|particles/.test(s.text));
  assert.notEqual(V.sealField({ ...g, scale: 0.9 }, m).hash, s.hash);
  const mt = V.meta(g); assert.equal(mt.version, '0.1.0-f033'); assert.equal(mt.evidence, 'experiment'); assert.equal(mt.id, 'vector-field-mind'); assert.match(mt.genomeHash, /^[0-9a-f]{12}$/); assert.match(mt.landedFrom, /F033/);
});
