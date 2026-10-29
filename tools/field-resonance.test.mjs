// The spectral / resonance / sound field minds (lib/field-resonance.js; Grok's drafts F-027, F-034, F-037, F-042, F-044, F-048 on Verse's
// engine, asked by Owner, 2026-10-18): each law with numbers. Run: node --test tools/field-resonance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/field-resonance.js';

const run = (s, n, input = {}) => { for (let i = 0; i < n; i++) R.step(s, 1 / 60, typeof input === 'function' ? input(i) : input); return s; };
const wiggle = (i) => ({ over: true, x: 0.5 + 0.25 * Math.sin((i / 60) * R.TAU * 1.2), y: 0.5, down: i % 45 === 0 }); // a pointer swinging at 1.2 Hz, pressing now and then

test('every variant cites its draft, is deterministic by seed, and keeps its metrics in 0..1 while the pointer plucks it', () => {
  assert.deepEqual(R.ORDER.map((v) => R.VARIANTS[v].fid), ['F-034', 'F-027', 'F-044', 'F-037', 'F-048', 'F-042']);
  for (const v of R.ORDER) {
    assert.match(R.VARIANTS[v].draft, /^atomeam\/a-to-mind\.com drafts\/F0\d\d-/);
    const a = run(R.create(7, v), 240, wiggle), b = run(R.create(7, v), 240, wiggle), c = run(R.create(8, v), 240, wiggle);
    assert.equal(a.fid, R.VARIANTS[v].fid);
    assert.deepEqual(R.metrics(a), R.metrics(b), v + ': same seed, same field');
    assert.notDeepEqual(R.spectrumOf(a).concat(R.metrics(a).cx), R.spectrumOf(c).concat(R.metrics(c).cx), v + ': another seed, another field');
    const m = R.metrics(a); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy', 'resonance']) assert.ok(m[k] >= 0 && m[k] <= 1, v + ' ' + k + ' ' + m[k]);
    assert.ok(R.spectrumOf(a).every((x) => x >= 0 && x <= 1) && Math.max(...R.spectrumOf(a)) > 0, v + ': a spectrum to draw');
    if (a.p) for (let i = 0; i < a.p.n; i++) assert.ok(a.p.x[i] >= 0 && a.p.x[i] <= 1 && a.p.y[i] >= 0 && a.p.y[i] <= 1, v + ': particles stay inside');
    assert.ok(!a.p || a.p.n <= 240, 'particle counts are capped');
  }
  assert.equal(R.create(1, 'nonsense').variant, R.DEFAULT);
});

test('helpers: order parameter, flatness, peakedness, resample, the pointer rhythm in Hz', () => {
  assert.ok(Math.abs(R.orderParam(new Float32Array(10).fill(1.3)).r - 1) < 1e-6, 'all in step: r = 1');
  assert.ok(R.orderParam(Float32Array.from({ length: 12 }, (_, i) => (i / 12) * R.TAU)).r < 1e-6, 'evenly spread: r = 0');
  assert.ok(R.flatness([1, 1, 1, 1]) > 0.99 && R.flatness([1, 0, 0, 0]) < 0.05);
  assert.equal(R.peakedness([1, 0, 0, 0]), 1); assert.equal(R.peakedness([1, 1, 1, 1]), 0);
  assert.deepEqual(Array.from(R.resample([0, 2, 4, 4], 2)), [0.25, 1]);
  const xs = [], ys = [], dts = []; for (let i = 0; i < 48; i++) { xs.push(0.5 + 0.2 * Math.sin((i / 60) * R.TAU * 1.5 + 0.3)); ys.push(0.5); dts.push(1 / 60); }
  assert.ok(Math.abs(R.rhythmOf(xs, ys, dts) - 1.5) < 0.35, 'a 1.5 Hz swing reads about 1.5 Hz: ' + R.rhythmOf(xs, ys, dts));
  assert.equal(R.rhythmOf(xs.slice(0, 5), ys.slice(0, 5), dts.slice(0, 5)), null, 'too short');
  assert.equal(R.rhythmOf(new Array(20).fill(0.4), new Array(20).fill(0.4), new Array(20).fill(1 / 60)), null, 'a still pointer has no rhythm');
});

test('F-034 / F-027: strong coupling pulls the lattice into step, weak coupling leaves it scattered; a press plucks energy into it', () => {
  for (const v of ['resonance', 'phase']) {
    const strong = run(R.create(3, v, { K: 3.3, spread: 0.1, kernel: 2.2, freqLo: 1, freqHi: 1.3, noise: 0.01 }), 600), weak = run(R.create(3, v, { K: 0.2, spread: 1, kernel: 0.4, freqLo: 0.2, freqHi: 3.5, noise: 0.2 }), 600);
    assert.ok(R.orderParam(strong.theta).r > R.orderParam(weak.theta).r + 0.2, v + ': ' + R.orderParam(strong.theta).r + ' vs ' + R.orderParam(weak.theta).r);
    const s = run(R.create(4, v), 30), before = s.amp.reduce((t, a) => t + a, 0); R.step(s, 1 / 60, { over: true, down: true, x: 0.5, y: 0.5 });
    assert.ok(s.amp.reduce((t, a) => t + a, 0) > before + 1, v + ': plucked');
  }
});

test('F-027: the mind is judged on matching the pointer rhythm, so a band centred on it beats one far from it', () => {
  const near = R.fitness('phase', { K: 1.4, freqLo: 1, freqHi: 1.6, noise: 0.05 }, { seed: 2, rhythm: 1.3 }), far = R.fitness('phase', { K: 1.4, freqLo: 0.2, freqHi: 0.6, noise: 0.05 }, { seed: 2, rhythm: 3.2 });
  assert.ok(near > far, near + ' > ' + far);
  const s = run(R.create(2, 'phase'), 120, wiggle); assert.ok(Math.abs(R.metrics(s).rhythm - 1.2) < 0.4, 'the card hears the swing: ' + R.metrics(s).rhythm);
});

test('F-044: the resonance gene concentrates speeds into one band; pressing an open portal reinforces the genes', () => {
  const hi = run(R.create(5, 'bands', { resonance: 1, diffusion: 0.005, decay: 0.999 }), 400), lo = run(R.create(5, 'bands', { resonance: 0, diffusion: 0.06, decay: 0.95 }), 400);
  assert.ok(R.metrics(hi).coherence > R.metrics(lo).coherence, R.metrics(hi).coherence + ' > ' + R.metrics(lo).coherence);
  const s = run(R.create(6, 'bands'), 10); s.portals.push({ x: 0.4, y: 0.4, band: 2, ttl: 8 }); const g0 = { ...s.genome };
  R.step(s, 1 / 60, { over: true, down: true, x: 0.41, y: 0.4 });
  assert.equal(s.reinforced, 1); assert.ok(s.genome.resonance > g0.resonance && s.genome.attract > g0.attract); assert.ok(!s.portals.some((o) => o.x === 0.4));
  const t = run(R.create(6, 'bands'), 10); t.portals.push({ x: 0.4, y: 0.4, band: 1, ttl: 0.05 }); run(t, 5); assert.ok(!t.portals.some((o) => o.x === 0.4 && o.y === 0.4), 'a portal expires');
});

test('F-037: the lattice grows toward the spectrum it hears (a microphone\'s, as numbers) and toward the pointer without one', () => {
  const low = Array.from({ length: 32 }, (_, i) => (i < 8 ? 1 : 0)), high = Array.from({ length: 32 }, (_, i) => (i >= 24 ? 1 : 0));
  const a = run(R.create(9, 'voice'), 400, { spectrum: low }), b = run(R.create(9, 'voice'), 400, { spectrum: high });
  const left = (s) => R.spectrumOf(s).slice(0, 4).reduce((t, x) => t + x, 0), right = (s) => R.spectrumOf(s).slice(12).reduce((t, x) => t + x, 0);
  assert.ok(left(a) > right(a) && right(b) > left(b), 'it takes the shape of the voice'); assert.ok(R.metrics(a).listening && R.metrics(a).resonance > 0.6, 'resonates: ' + R.metrics(a).resonance);
  const p = run(R.create(9, 'voice'), 300, { over: true, x: 0.85, y: 0.5 }); assert.ok(right(p) > left(p) && !R.metrics(p).listening, 'no microphone: the pointer is the target');
  assert.ok(R.fitness('voice', { diff: 0.15, react: 0.3, attract: 0.1, decay: 0.05 }, { seed: 1, target: low }) > R.fitness('voice', { diff: 0.5, react: 0.05, attract: 0, decay: 0.3 }, { seed: 1, target: low }), 'a living lattice beats one that dies');
});

test('F-048: the policy picks a harmonic synth, its modelled spectrum is peaked, and loud bins hold their particles', () => {
  const sp = R.synthSpectrum([200, 400, 600, 1000], [1, 0.5, 0.33, 0.2], 8); assert.equal(Math.max(...sp), 1); assert.ok(sp[0] + sp[1] > sp[6] + sp[7]);
  const a = R.policyAudio(R.policy(new Array(12).fill(0.5), [1, 0, 0, 0, 0, 1])); assert.equal(a.freqs.length, 4);
  assert.ok(a.base >= 80 && a.base <= 300 && Math.abs(a.freqs[1] / a.freqs[0] - 2) < 0.15 && a.pans.every((x) => x >= -1 && x <= 1));
  const s = run(R.create(3, 'spatial'), 300), m = R.metrics(s); assert.ok(m.resonance > 0.2 && m.base >= 80 && m.base <= 300, JSON.stringify(m));
});

test('F-042: the network is scored on its real prediction error, so a better predictor scores higher; the residual moves the particles', () => {
  const hist = Array.from({ length: 20 }, () => [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  const zero = Object.fromEntries(Array.from({ length: R.MLP_N }, (_, i) => ['w' + i, 0])); // sigmoid(0) = 0.5 everywhere: a perfect guess for a flat 0.5
  const off = { ...zero }; for (let i = R.MLP_N - 8; i < R.MLP_N; i++) off['w' + i] = 1; // output biases pushed up: wrong by 0.23 a bin
  assert.equal(R.fitness('predict', zero, { hist }), 1); assert.ok(R.fitness('predict', off, { hist }) < 0.6);
  const s = R.create(4, 'predict'), x0 = Array.from(s.p.x); run(s, 60); assert.ok(s.p.x.some((x, i) => Math.abs(x - x0[i]) > 1e-4), 'the residual pushes');
  assert.equal(s.hist.length, 32, 'it keeps the last 32 spectra for the mind');
  const m = run(R.create(4, 'predict'), 30, { spectrum: new Array(32).fill(0.4) }); assert.ok(R.metrics(m).listening);
});

test('the mind: a generation is deterministic, keeps genomes in range, never loses its best on the same context, and improves on the start', () => {
  for (const v of R.ORDER) {
    const s = run(R.create(5, v), 120, wiggle), ctx = R.contextOf(s, { over: true, x: 0.6, y: 0.4 }), arg = { variant: v, ctx, seed: 5, gen: 0 };
    assert.doesNotThrow(() => JSON.stringify(ctx)); assert.deepEqual(structuredClone(arg), arg, 'a Worker can take it');
    const a = R.evolveResonance(arg), b = R.evolveResonance(arg); assert.deepEqual(a.best, b.best); assert.equal(a.gen, 1); assert.equal(a.pop.length, R.POP);
    for (const g of a.pop) for (const [k, [lo, hi]] of Object.entries(R.SPECS[v])) assert.ok(g[k] >= lo && g[k] <= hi, v + ' ' + k);
    let o = a; for (let i = 0; i < 3; i++) { const n = R.evolveResonance({ ...arg, pop: o.pop, gen: o.gen }); assert.ok(n.fitness >= o.fitness - 1e-9, v + ': the best is kept'); o = n; }
    assert.ok(o.fitness >= R.fitness(v, R.defaultGenome(v, 5), { ...ctx, seed: 5 }) - 1e-9, v + ': never worse than the draft\'s own genome');
  }
  const s = R.create(1, 'phase'); R.setGenome(s, { K: 99, freqLo: 1.4, freqHi: 0.1 }); assert.equal(s.genome.K, R.SPECS.phase.K[1]); assert.ok(s.genome.freqHi >= s.genome.freqLo + 0.3 - 1e-9, 'a bad genome is put back in range');
});

test('the seal keeps facts only: the variant, its F-id and genome numbers, never the pointer path or a sound', () => {
  const s = run(R.create(2, 'voice'), 30, { over: true, x: 0.2, y: 0.3, spectrum: new Array(32).fill(0.9) }), p = R.params(s);
  assert.deepEqual(Object.keys(p).sort(), ['fid', 'genome', 'variant']); assert.equal(p.fid, 'F-037');
  assert.ok(Object.values(p.genome).every((x) => typeof x === 'number'));
  assert.deepEqual(Object.keys(R.params(R.create(2, 'predict')).genome).sort(), ['sum', 'weights'], '212 weights become a fingerprint');
});

test('the skill (skills/resonance-mind.js) takes its asks, picks the law an ask names, and leaves the look-alikes', async () => {
  const skill = (await import('../void-live-deploy/skills/resonance-mind.js')).default;
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.ok(skill.stageKinds['resonance-mind']);
  assert.equal(R.variantOf('resonant voice lattice mind'), 'voice'); assert.equal(R.variantOf('spectral phase mind'), 'phase'); assert.equal(R.variantOf('predictive audio mind'), 'predict');
  assert.equal(R.variantOf('spatial audio mind'), 'spatial'); assert.equal(R.variantOf('spectral resonance lattice'), 'bands'); assert.equal(R.variantOf('resonance mind'), null);
});
