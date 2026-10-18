// Attention field mind (lib/field-attention.js): the four attention laws with numbers (asked by Owner, 2026-10-18: Grok's drafts
// frontier-webgpu-attention-field, F-032, F-029, F-047). Run: node --test tools/field-attention.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../void-live-deploy/lib/field-attention.js';

const run = (s, n, input = {}) => { for (let i = 0; i < n; i++) A.step(s, 1 / 60, input); return s; };
const inUnit = (m) => ['entropy', 'activity', 'consensus', 'cx', 'cy'].every((k) => Number.isFinite(m[k]) && m[k] >= 0 && m[k] <= 1);

test('hashed features: unit vectors, the same word the same vector, shared spelling looks alike, unrelated words do not', () => {
  const a = A.hashFeat('attention'), b = A.hashFeat('attention'), c = A.hashFeat('attentions'), d = A.hashFeat('ocean');
  assert.equal(a.length, A.D); assert.ok(Math.abs(A.sim(a, a) - 1) < 1e-9); assert.deepEqual(a, b);
  assert.ok(A.sim(a, c) > 0.7, 'attention ~ attentions: ' + A.sim(a, c)); assert.ok(A.sim(a, c) > A.sim(a, d) + 0.3, 'closer than ocean');
  assert.equal(A.cleanWord('  Hello <b>World</b>!! '), 'hello-bworldb'); assert.equal(A.cleanWord('x'.repeat(99)).length, A.MAX_WORD);
  const sp = A.wordSpot('void'); assert.ok(sp.x >= 0.2 && sp.x <= 0.8 && sp.y >= 0.2 && sp.y <= 0.8); assert.deepEqual(sp, A.wordSpot('VOID'));
});

test('every law: deterministic by seed, metrics in 0..1, nothing escapes its bounds, counts capped', () => {
  for (const v of A.VARIANTS) {
    const a = run(A.create(7, { variant: v }), 90, { over: true, x: 0.4, y: 0.5 }), b = run(A.create(7, { variant: v }), 90, { over: true, x: 0.4, y: 0.5 }), c = run(A.create(8, { variant: v }), 90, { over: true, x: 0.4, y: 0.5 });
    assert.deepEqual(A.metrics(a), A.metrics(b), v + ' same seed, same field'); assert.notDeepEqual(A.metrics(a), A.metrics(c), v + ' another seed, another field');
    assert.ok(inUnit(A.metrics(a)), v + ' ' + JSON.stringify(A.metrics(a)));
    if (a.p) { for (let i = 0; i < a.p.n; i++) assert.ok(a.p.x[i] >= 0 && a.p.x[i] <= 1 && a.p.y[i] >= 0 && a.p.y[i] <= 1, v + ' particle inside'); }
    else assert.ok(a.f.every((x) => x >= 0 && x <= 1), v + ' cells in 0..1');
  }
  const s = A.create(1); for (let i = 0; i < 60; i++) A.addQuery(s, 'word' + i);
  assert.equal(s.queries.length, A.MAX_QUERIES); assert.ok(s.p.n <= A.MAX_PARTICLES, 'particles capped: ' + s.p.n);
  const c = A.create(1, { variant: 'causal' }); for (let i = 0; i < 20; i++) A.addQuery(c, 'n' + i); assert.equal(c.nodes.length, A.MAX_NODES);
  for (let i = 0; i < 40; i++) A.step(c, 1 / 60, { over: true, x: (i % 10) / 10, y: 0.5 }); assert.ok(c.hist.length <= A.MAX_HIST);
  assert.equal(A.addQuery(s, '!!!'), '', 'nothing left of a word: no attractor');
});

test('affinity (frontier-webgpu-attention-field): like clusters with like, and a typed word pulls its look-alikes to it', () => {
  const s = A.create(7), m0 = A.metrics(s); run(s, 600); const m1 = A.metrics(s);
  assert.ok(m1.consensus > m0.consensus + 0.3, 'particles of one concept gathered: ' + m0.consensus + ' -> ' + m1.consensus);
  assert.ok(A.clusterize(A.mindArg(s)).clusters >= 8, 'many small clusters, one per concept');
  A.addQuery(s, 'cluster'); const before = A.answer(s); run(s, 240);
  assert.ok(A.answer(s) > 0.6 && A.answer(s) > before, 'the look-alikes fell toward "cluster": ' + before + ' -> ' + A.answer(s));
  assert.ok(Math.hypot(A.metrics(s).cx - s.queries[0].x, A.metrics(s).cy - s.queries[0].y) < 0.1, 'attention sits at the word');
});

test('affinity: the pointer sculpts, pulling when over and pushing when pressed', () => {
  const near = (s, x, y) => { let k = 0; for (let i = 0; i < s.p.n; i++) if (Math.hypot(s.p.x[i] - x, s.p.y[i] - y) < 0.12) k++; return k; };
  const free = run(A.create(4), 120), pull = run(A.create(4), 120, { over: true, x: 0.5, y: 0.5 }), push = run(A.create(4), 120, { over: true, down: true, x: 0.5, y: 0.5 });
  assert.ok(near(pull, 0.5, 0.5) > near(free, 0.5, 0.5) && near(free, 0.5, 0.5) > near(push, 0.5, 0.5), [near(pull, 0.5, 0.5), near(free, 0.5, 0.5), near(push, 0.5, 0.5)].join(' > '));
  assert.ok(pull.near > 0, 'the law counts who felt the pointer');
});

test('heads (F-032): two-head attention clusters the tokens, draws its edges, and keeps its temperature in range near a middling entropy', () => {
  const s = A.create(7, { variant: 'heads' }), m0 = A.metrics(s); run(s, 600); const m1 = A.metrics(s);
  assert.ok(m1.consensus > m0.consensus + 0.3, 'tokens gathered: ' + m1.consensus);
  assert.ok(s.temp > A.HEADS.TMIN && s.temp < A.HEADS.TMAX, 'temperature settled inside its range: ' + s.temp);
  assert.ok(Math.abs(s.ent - A.HEADS.TARGET) < 0.15, 'attention entropy near its target: ' + s.ent);
  assert.ok(s.edges.length > 0 && s.edges.length <= A.HEADS.MAX_EDGES * 3 && s.edges.length % 3 === 0);
  A.addQuery(s, 'void'); run(s, 300); assert.ok(A.answer(s) > 0.3, 'tokens attend to a typed key: ' + A.answer(s));
});

test('lattice (F-029): alive and varied, a word is a lasting source, and the mind never loses its best (elitism)', () => {
  const s = run(A.create(7, { variant: 'lattice' }), 600), m = A.measureLattice(s.f, s.act, []);
  assert.ok(m.variance > 0.02 && m.mean > 0.05 && m.mean < 0.7 && A.metrics(s).activity > 0.1, 'not an empty or full sheet, still moving: ' + JSON.stringify(m));
  A.addQuery(s, 'lattice'); run(s, 120); assert.ok(A.metrics(s).consensus > 0.5, 'more energy at the word than elsewhere: ' + A.metrics(s).consensus);
  const arg = A.mindArg(s), a = A.evolveLattice(arg), b = A.evolveLattice(arg);
  assert.deepEqual(a, b, 'a generation is deterministic for its inputs'); assert.equal(a.pop.length, A.LPOP);
  for (const g of a.pop) for (const [k, [lo, hi]] of Object.entries(A.LSPEC)) assert.ok(g[k] >= lo && g[k] <= hi, k);
  let o = a; for (let i = 0; i < 3; i++) { const n = A.evolveLattice({ ...arg, pop: o.pop, gen: o.gen }); assert.ok(n.fitness >= o.fitness - 1e-9, 'the best is kept'); o = n; }
  assert.equal(A.applyThought(s, A.think(arg)).length, A.LPOP); assert.equal(s.gen, 1);
});

test('causal (F-047): attends to the pointer\'s path (looking back only), nodes ride the attention, a press holds one, and the mind keeps its best', () => {
  const quiet = run(A.create(3, { variant: 'causal' }), 120), traced = A.create(3, { variant: 'causal' });
  for (let i = 0; i < 120; i++) A.step(traced, 1 / 60, { over: true, x: 0.2 + (i % 60) / 100, y: 0.5 });
  const at = (s) => { let t = 0; for (let x = 10; x < 50; x++) t += s.attn[Math.round(0.5 * (A.CH - 1)) * A.CW + x]; return t; };
  assert.ok(at(traced) > at(quiet), 'more attention along the traced path'); assert.equal(traced.hist[0].x, 0.2 + 59 / 100, 'newest place first');
  const b = A.pathBias([{ x: 0.5, y: 0.5 }]), c = A.pathBias([{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.1 }]); assert.ok(c[Math.round(0.5 * (A.CH - 1)) * A.CW + Math.round(0.5 * (A.CW - 1))] >= b[Math.round(0.5 * (A.CH - 1)) * A.CW + Math.round(0.5 * (A.CW - 1))]);
  assert.ok(traced.nodes.some((n) => n.vx || n.vy), 'nodes ride the gradient');
  const s = A.create(5, { variant: 'causal' }), n = s.nodes[2];
  A.step(s, 1 / 60, { over: true, down: true, x: n.x, y: n.y }); assert.equal(s.held, 2);
  for (let i = 0; i < 10; i++) A.step(s, 1 / 60, { over: true, down: true, x: 0.7, y: 0.3 });
  assert.deepEqual([s.nodes[2].x, s.nodes[2].y], [0.7, 0.3], 'the held node follows the pointer'); A.step(s, 1 / 60, { over: true, x: 0.7, y: 0.3 }); assert.equal(s.held, -1, 'let go');
  const arg = A.mindArg(traced), g1 = A.evolveCausal(arg); assert.deepEqual(g1, A.evolveCausal(arg)); assert.equal(g1.pop.length, A.CPOP);
  let o = g1; for (let i = 0; i < 3; i++) { const nx = A.evolveCausal({ ...arg, pop: o.pop, gen: o.gen }); assert.ok(nx.fitness >= o.fitness - 1e-9); o = nx; }
  assert.ok(A.causalFitness(0, 1, 0.5, 0) < A.causalFitness(0, 1, 0.5, 0.2), 'an empty field is not the best field (the draft\'s fitness rewarded it)');
});

test('the shared face: a thought for one law is ignored by another, the Law button cycles all four, and the seal keeps facts only', () => {
  const s = A.create(2); A.addQuery(s, 'private-word'); A.step(s, 1 / 60, { over: true, x: 0.3, y: 0.3 });
  const out = A.think(A.mindArg(s)); assert.equal(out.variant, 'affinity'); A.applyThought(s, out); assert.equal(s.gen, 1); assert.ok(s.clusters >= 0);
  assert.equal(A.applyThought(A.create(2, { variant: 'lattice' }), out), null, 'a stale answer is dropped');
  let v = 'affinity'; const seen = []; for (let i = 0; i < 4; i++) { seen.push(v); v = A.nextVariant(v); } assert.deepEqual(seen, A.VARIANTS); assert.equal(v, 'affinity');
  for (const law of A.VARIANTS) { const t = A.create(2, { variant: law }); A.addQuery(t, 'private-word'); const p = JSON.stringify(A.params(t)); assert.ok(!/private-word/.test(p) && !/hist|"x"|"y"/.test(p), law + ' ' + p); assert.equal(A.params(t).words, 1); assert.match(A.params(t).source, /attention/); }
  assert.deepEqual(A.create(2, { variant: 'nope' }).variant, 'affinity');
  const c = A.clusterize({ x: [0.1, 0.11, 0.12, 0.13, 0.9], y: [0.1, 0.1, 0.1, 0.1, 0.9], feat: Array(5).fill(A.hashFeat('a')), min: 4 });
  assert.deepEqual([c.clusters, c.biggest, c.share], [1, 4, 0.8]);
});

test('the skill (skills/attention-field-mind.js) takes its asks and leaves the look-alikes', async () => {
  const skill = (await import('../void-live-deploy/skills/attention-field-mind.js')).default;
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.ok(skill.stageKinds['attention-field-mind']);
});
