// field-swarm: seven of Grok's drafts (F-044, F-030, F-026, F-028, F-040, F-041, F-022) as named laws on the field kit (lib/field-swarm.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/field-swarm.js';
import { sealSync } from '../void-live-deploy/lib/field-kit.js';

const run = (variant, seed, k = 60, input = (i) => S.orbit(i, null)) => { const s = S.create(seed, { variant }); for (let i = 0; i < k; i++) S.step(s, 1 / 60, input(i)); return s; };
const unit = (m) => ['entropy', 'activity', 'consensus', 'cx', 'cy'].every((k) => Number.isFinite(m[k]) && m[k] >= 0 && m[k] <= 1);

test('every law cites its draft, is deterministic by seed, keeps its agents in the square, caps them at 240, and gives the kit five numbers in 0..1', () => {
  assert.deepEqual(S.LAWS, ['swarm', 'neural', 'memory', 'lattice', 'compete', 'probes', 'resonance', 'gravity']);
  const cites = S.LAWS.map((v) => S.VARIANTS[v].fid).join(' ');
  for (const f of ['F-044', 'F-030', 'F-026', 'F-028', 'F-040', 'F-041', 'F-022']) assert.ok(cites.includes(f), f);
  for (const v of S.LAWS) {
    const a = run(v, 7), b = run(v, 7), c = run(v, 8);
    assert.deepEqual(Array.from(a.x), Array.from(b.x), v + ' deterministic'); assert.notDeepEqual(Array.from(a.x), Array.from(c.x), v + ' seeded');
    assert.ok([...a.x, ...a.y].every((q) => Number.isFinite(q) && q >= 0 && q <= 1), v + ' in the square');
    assert.ok(unit(S.metrics(a)), v + ' ' + JSON.stringify(S.metrics(a)));
    assert.ok(a.act > 0.01, v + ' moves: ' + a.act);
  }
  assert.equal(S.create(1, { variant: 'neural', n: 5000 }).n, S.MAX_AGENTS); assert.equal(S.create(1, { variant: 'nope' }).variant, 'swarm');
});

test('F-044: the implicit field is a real MLP of (x, y, pointer proximity): bounded, smooth, and the pointer changes it', () => {
  const w = S.weightsOf(S.seedGenome('neural', 3), S.mlpSize(3, 8, 2)), at = (x, y, p) => Array.from(S.mlp(w, [x, y, p], 3, 8, 2));
  for (const o of [at(-1, -1, 0), at(1, 1, 1), at(0.2, -0.4, 0.5)]) assert.ok(o.every((v) => v >= -1 && v <= 1));
  const a = at(0.1, 0.1, 0), b = at(0.1001, 0.1, 0); assert.ok(Math.abs(a[0] - b[0]) < 0.01, 'continuous');
  assert.notDeepEqual(at(0.1, 0.1, 0), at(0.1, 0.1, 1), 'the pointer is an input');
  assert.equal(S.mlpSize(3, 8, 2), 50); assert.equal(Object.keys(S.SPECS.neural).length, 50);
});

test('F-030: the pointer writes a memory that fades by the kernel, and agents climb toward it', () => {
  const s = S.create(2, { variant: 'memory' }); for (let i = 0; i < 30; i++) S.step(s, 1 / 60, { over: true, x: 0.5, y: 0.5 });
  const peak = S.measure(s); assert.ok(peak.structure > 0.1 && peak.response > 0, JSON.stringify(peak));
  const onBefore = peak.onMemory; for (let i = 0; i < 60; i++) S.step(s, 1 / 60, { over: true, x: 0.5, y: 0.5 }); assert.ok(S.measure(s).onMemory >= onBefore, 'agents gather on the memory');
  const fast = new Float32Array(S.MG * S.MG).fill(0.5), slow = Float32Array.from(fast), r = () => 0.5;
  for (let i = 0; i < 30; i++) { S.memoryStep(fast, { decay: 0.85, diffuse: 0.1, gain: 0, noise: 0 }, {}, r); S.memoryStep(slow, { decay: 0.995, diffuse: 0.1, gain: 0, noise: 0 }, {}, r); }
  assert.ok(fast[0] < slow[0] && slow[0] < 0.5, 'decay sets how long a trail is remembered');
});

test('F-026: the intent lattice learns the pointer\'s velocity and predicts ahead of it; with no pointer it forgets', () => {
  const s = S.create(1, { variant: 'lattice' }); for (let i = 0; i < 20; i++) S.step(s, 1 / 60, { over: true, x: 0.3 + i * 0.004, y: 0.5 });
  const p = S.predictions(s.lat, 0.5)[0]; assert.ok(p && p.x > 0.3 + 19 * 0.004 - 0.07 && p.s > 0.2, JSON.stringify(p)); // ahead of the cell, moving right
  assert.ok(S.measure(s).confidence > 0.2); assert.equal(s.last && typeof s.last.x, 'number', 'only the last point is kept');
  for (let i = 0; i < 400; i++) S.step(s, 1 / 60, {}); assert.ok(S.measure(s).confidence < 0.05 && s.last === null);
});

test('F-028: two minds with opposite rewards; the stage goes to the one doing better at its own (with hysteresis)', () => {
  const m = { entropy: 0.9, energy: 0.8, near: 0.05 }; assert.ok(S.fitness('compete', m, 1) > S.fitness('compete', m, 0));
  const close = { ...m, entropy: 0.2, energy: 0.1, near: 0.9 }; assert.ok(S.fitness('compete', close, 0) > S.fitness('compete', close, 1));
  const s = S.create(4, { variant: 'compete' }); s.liveA = 0.5; s.liveB = 0.52; S.step(s, 1 / 60, {}); assert.equal(s.dominant, 0, 'within 10% the leader keeps the stage');
  const t = S.create(1, { variant: 'swarm' }); for (let i = 0; i < 300; i++) S.step(t, 1 / 60, {}); assert.equal(t.dominant, 1, 'nobody pointing: the explorers lead');
  for (let i = 0; i < 600; i++) S.step(t, 1 / 60, S.orbit(i * 0.3, null)); assert.equal(t.dominant, 0, 'someone pointing: the engagers take the stage ' + t.liveA + '/' + t.liveB);
  for (let i = 0; i < 600; i++) S.step(t, 1 / 60, {}); assert.equal(t.dominant, 1, 'they leave: the explorers take it back');
});

test('F-040: probes are steered by a shared MLP 6->8->3 and draw a graph where their connection is strong; F-041: agents lock phase to their own waves', () => {
  const p = run('probes', 5, 120); assert.equal(p.n, 12); assert.ok(Array.from(p.connect).every((c) => c >= 0 && c <= 1));
  for (const [i, j, st] of S.graphEdges(p)) assert.ok(i < j && st > 0.4);
  const r = run('resonance', 5, 240); assert.ok(r.resonance > 0.5 && r.resonance <= 1, 'in tune: ' + r.resonance); assert.ok(r.wave.some((v) => v > 0), 'the agents excite the field');
});

test('F-022: a thought lands where its words hash to (the same words, the same place), wells push each other apart, at most 8, and the words are not kept', () => {
  assert.deepEqual(S.wellOf('hello'), S.wellOf(' Hello ')); assert.notDeepEqual(S.wellOf('hello'), S.wellOf('world'));
  const w = S.wellOf('anything at all'); assert.ok(w.x >= 0.1 && w.x <= 0.9 && w.y >= 0.1 && w.y <= 0.9 && w.strength >= 0.6 && w.strength <= 1);
  const s = S.create(1, { variant: 'gravity' }); for (let i = 0; i < 12; i++) S.addWell(s, 'thought ' + i);
  assert.equal(s.wells.length, S.MAX_WELLS); assert.ok(!JSON.stringify(s.wells).includes('thought'));
  const g = run('gravity', 3, 200, () => ({})); assert.ok(S.measure(g).coherence > 0.2, 'agents fall into the wells');
});

test('the mind: every generation is deterministic, the best never gets worse, genomes stay in their spec, and two-mind laws keep two populations', () => {
  for (const v of ['neural', 'memory', 'swarm']) {
    let o = null; const best = []; for (let g = 0; g < 4; g++) { o = S.evolveSwarm({ variant: v, pop: o && o.pop, seed: 9, gen: g, pointer: { x: 0.4, y: 0.6 } }); best.push(S.VARIANTS[v].tribes ? [o.fitA, o.fitB] : [o.fitness]); }
    for (let i = 1; i < best.length; i++) best[i].forEach((f, k) => assert.ok(f >= best[i - 1][k] - 1e-9, v + ' elitism ' + JSON.stringify(best)));
    const again = S.evolveSwarm({ variant: v, seed: 9, gen: 0, pointer: { x: 0.4, y: 0.6 } }), first = S.evolveSwarm({ variant: v, seed: 9, gen: 0, pointer: { x: 0.4, y: 0.6 } });
    assert.deepEqual(again, first); assert.equal(o.gen, 4); assert.equal(o.variant, v);
    const pops = S.VARIANTS[v].tribes ? [...o.pop.A, ...o.pop.B] : o.pop; assert.equal(pops.length, S.VARIANTS[v].tribes ? 12 : 6);
    for (const g of pops) for (const [k, [lo, hi]] of Object.entries(S.SPECS[v])) assert.ok(g[k] >= lo && g[k] <= hi, v + ' ' + k);
  }
  const better = S.evolveSwarm({ variant: 'memory', seed: 2, gen: 0 }); assert.ok(better.fitness >= S.rollout('memory', S.seedGenome('memory', 2), { seed: 2 }), 'the starting genome is in the first population');
});

test('a seal keeps the law, its draft, the genome and counts: never the pointer, its path, the grids or a thought', () => {
  const s = run('swarm', 1, 40, (i) => ({ over: true, x: 0.2 + i * 0.01, y: 0.3 })); S.addWell(s, 'my secret thought');
  const p = S.params(s), text = JSON.stringify(p);
  assert.deepEqual(Object.keys(p).sort(), ['agents', 'fid', 'genome', 'law', 'wells']); assert.deepEqual(Object.keys(p.genome), ['A', 'B']);
  assert.ok(!/secret|thought|"last"|"mem"|"lat"|"wave"|"lastOver"|path|pointer|"x"|"y"/.test(text), text.slice(0, 200));
  const a = sealSync('swarm-mind', p, S.metrics(s)), b = sealSync('swarm-mind', S.params(s), S.metrics(s)); assert.equal(a.hash, b.hash);
});
