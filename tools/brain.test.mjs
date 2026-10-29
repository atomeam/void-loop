// Verse Brain (lib/brain.js, lib/brain-workspace.js, lib/brain-organs.js): every part with numbers. Run: node --test tools/brain.test.mjs
// Each test checks that a part does its job, not that it exists: a predictor that predicts, a memory that remembers, attention that
// follows what is new, imagination that leaves no trace.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as W from '../void-live-deploy/lib/brain-workspace.js';
import * as O from '../void-live-deploy/lib/brain-organs.js';
import drafts from '../void-live-deploy/lib/brain-drafts.json' with { type: 'json' };

const circle = (i, over = true) => ({ x: 0.5 + 0.25 * Math.cos(i * 0.05), y: 0.5 + 0.2 * Math.sin(i * 0.05), over });
const run = (b, n, f = () => ({})) => { for (let i = 0; i < n; i++) B.stepBrain(b, f(i)); return b; };

test('seeded: the same seed gives the same brain after the same input, another seed another', () => {
  const a = run(B.createBrain(4), 400, circle), b = run(B.createBrain(4), 400, circle), c = run(B.createBrain(5), 400, circle);
  assert.deepEqual(Array.from(a.ws.layers.act.slice(0, 500)), Array.from(b.ws.layers.act.slice(0, 500)));
  assert.notDeepEqual(Array.from(a.ws.layers.act.slice(0, 500)), Array.from(c.ws.layers.act.slice(0, 500)));
});

test('one workspace: every layer stays in 0..1, and each writing organ is the recorded writer of the cells it wrote', () => {
  const b = run(B.createBrain(2), 600, circle);
  for (const k of W.LAYERS) assert.ok(b.ws.layers[k].every((v) => v >= 0 && v <= 1), k);
  const own = W.ownership(b.ws);
  for (const id of ['tissue', 'swarm', 'predictor', 'attention']) assert.ok(own[id] > 0, id + ' owns part of the workspace: ' + own[id]);
  const w = B.createBrain(9); W.deposit(w.ws, 'input', 0.3, 0.3, 0.5, 2, 'you');
  assert.deepEqual(W.provenanceAt(w.ws, 0.3, 0.3).organ, 'you');
  W.deposit(w.ws, 'input', 0.3, 0.3, 0.5, 2, 'memory');
  assert.equal(W.provenanceAt(w.ws, 0.3, 0.3).organ, 'memory', 'the last writer is the one recorded');
});

test('the predictor learns: on a circle its error falls, and a sudden jump is a surprise', () => {
  const R = O.makeReservoir(3), u = (i) => { const f = new Float32Array(8); f[0] = 0.5 + 0.3 * Math.cos(i * 0.1); f[1] = 0.5 + 0.3 * Math.sin(i * 0.1); f[2] = -0.6 * Math.sin(i * 0.1); f[3] = 0.6 * Math.cos(i * 0.1); return f; };
  let early = 0, late = 0; for (let i = 0; i < 1500; i++) { const e = O.reservoirStep(R, u(i)); if (i >= 5 && i < 55) early += e; if (i >= 1450) late += e; }
  assert.ok(late < early * 0.5, 'error halves with practice: ' + early.toFixed(3) + ' -> ' + late.toFixed(3));
  const jump = new Float32Array(8); jump[0] = 0.05; jump[1] = 0.95; const e = O.reservoirStep(R, jump);
  assert.ok(e > (late / 50) * 3, 'a jump is far more wrong than the circle: ' + e.toFixed(3));
});

test('gestures: online k-means names kinds of movement, and the compression oracle knows a repeated pattern', () => {
  const G = O.makeGestures(), still = [0, 0, 0, 0, 0], fast = [0.9, 0.05, 1, 0, 0];
  for (let i = 0; i < 40; i++) { O.kmeansStep(G, still); O.kmeansStep(G, fast); }
  const a = O.kmeansStep(G, still), z = O.kmeansStep(G, fast);
  assert.notEqual(a, z, 'still and fast are different kinds'); assert.equal(O.gestureName(G.c[a]), 'still'); assert.equal(O.gestureName(G.c[z]), 'sweep');
  assert.ok(O.ncd('abcabcabcabc', 'abcabcabcabc') < O.ncd('abcabcabcabc', 'fdeefdfeeffd'), 'the same phrase is nearer than a different one');
  assert.ok(O.lzBits('aaaaaaaaaaaa') < O.lzBits('abcdefabcfed'), 'a repetitive string compresses better');
});

test('memory: a gesture paired with one region comes to expect that region', () => {
  const M = O.makeMemory(), act = new Float32Array(O.REGIONS); act[7] = 1; act[2] = 0.1;
  for (let i = 0; i < 40; i++) O.hebbStep(M, 3, act);
  const r = O.recall(M, 3); assert.equal(r.region, 7); assert.ok(r.strength > 0.6, 'strong: ' + r.strength);
  assert.equal(O.recall(M, 1).strength, 0, 'a gesture never paired expects nothing');
  for (let i = 0; i < 2000; i++) O.hebbStep(M, -1, act); assert.ok(O.recall(M, 3).strength < r.strength * 0.1, 'unused links fade');
});

test('concepts: words become linked ideas; spelling and use make them related; an unseen word surprises the character model', () => {
  const b = B.createBrain(1);
  B.tell(b, 'romance mystery'); B.tell(b, 'romance stories');
  assert.deepEqual(b.concepts.words, ['romance', 'mystery', 'stories']);
  const rel = O.related(b.concepts, 'romance'); assert.ok(rel.find((r) => r.word === 'mystery' && r.linked === 1));
  assert.ok(O.hvSim(O.hypervector('stories'), O.hypervector('story')) > O.hvSim(O.hypervector('stories'), O.hypervector('zebra')) + 0.2);
  const P = O.makePpm(); O.ppmLearn(P, 'romance romance romance');
  assert.ok(O.ppmBits(P, 'romance') < O.ppmBits(P, 'qwxzkv'), 'a known word costs fewer bits than a strange one');
  assert.equal(b.ws.nodes.kind[b.concepts.node[0]], W.KIND.concept); assert.equal(W.provenanceAt(b.ws, 0, 0).organ === undefined, false);
});

test('tissue and rhythm: the field stays varied and alive, and the oscillators lock when coupled', () => {
  const b = run(B.createBrain(6), 900);
  assert.ok(b.metrics.entropy > 0.3, 'varied: ' + b.metrics.entropy); assert.ok(b.metrics.activity > 0.02 && b.metrics.activity < 0.95, 'alive, not full: ' + b.metrics.activity);
  const lo = B.createBrain(7), hi = B.createBrain(7); lo.genome = { ...lo.genome, couple: 0.4 }; hi.genome = { ...hi.genome, couple: 3.2 };
  for (let i = 0; i < 300; i++) { O.rhythmStep(lo); O.rhythmStep(hi); }
  assert.ok(W.measure(hi.ws).order > W.measure(lo.ws).order + 0.2, 'stronger coupling, more in step: ' + W.measure(lo.ws).order.toFixed(2) + ' vs ' + W.measure(hi.ws).order.toFixed(2));
});

test('attention: the budget is spent where it is wanted, nothing starves, and the focus moves to what is new', () => {
  const b = B.createBrain(8);
  const ids = B.scheduleTick(b); assert.ok(ids.includes('senses')); assert.ok(ids.length <= b.budget + 1);
  run(b, 600); for (const id of B.ORGAN_IDS) if (id !== 'senses' && id !== 'gestures' && id !== 'predictor') assert.ok(b.runs[id] > 0, id + ' ran');
  assert.ok(b.runs.predictor < b.runs.tissue, 'with nobody pointing the predictor gets less than the tissue');
  const before = b.focus.region; let tgt = before === 0 ? 11 : 0; const c = W.regionCenter(tgt);
  run(b, 200, () => ({ x: c.x, y: c.y, over: true, down: true }));
  assert.equal(b.focus.region, tgt, 'the focus went to where you pressed');
  assert.ok(Math.hypot(b.focus.x - c.x, b.focus.y - c.y) < 0.15, 'and the spotlight is there');
});

test('imagination leaves no trace, and the futures it scores differ', () => {
  const b = run(B.createBrain(10), 300, circle), snap = W.snapshot(b.ws), rnd = b.ws.rand(), b2 = run(B.createBrain(10), 300, circle); b2.ws.rand();
  const a = B.imagine(b, { action: 1, steps: 30 }), z = B.imagine(b, { genome: O.fixGenome({ ...b.genome, feed: 0.026, kill: 0.0655 }), steps: 30 });
  assert.ok(Number.isFinite(a) && Number.isFinite(z) && a !== z, 'two futures, two scores: ' + a + ' ' + z);
  for (const k of W.LAYERS) assert.deepEqual(Array.from(b.ws.layers[k]), Array.from(snap.layers[k]), k + ' unchanged');
  assert.deepEqual(Array.from(b.ws.nodes.x), Array.from(snap.nodes.x)); assert.equal(b.ws.tick, snap.tick);
  assert.equal(b.ws.rand(), b2.ws.rand(), 'the live random sequence did not move'); assert.ok(rnd >= 0);
});

test('will: Q-learning moves toward the action that is rewarded, and every choice is checked by imagining it', () => {
  const Wl = O.makeWill(); for (let i = 0; i < 50; i++) { O.qUpdate(Wl, 4, 2, 1, 4); O.qUpdate(Wl, 4, 1, -0.5, 4); }
  assert.ok(Wl.q[4 * O.ACTIONS.length + 2] > Wl.q[4 * O.ACTIONS.length + 1]);
  const b = run(B.createBrain(11), 400, circle);
  assert.ok(b.will.chosen >= 4, 'it chose ' + b.will.chosen + ' times'); assert.ok(b.board.action && b.board.action.imagined.length >= 1);
  assert.ok(b.imagined >= b.will.chosen, 'every choice imagined first');
  const g0 = b.will.good; B.reward(b); assert.equal(b.will.good, g0 + 1);
});

test('arena: genomes compete in imagined futures, the champion runs the brain and has a seal', () => {
  const b = run(B.createBrain(12), 700, circle), s = B.selfOf(b);
  assert.ok(b.arena.gen >= 3, 'generations: ' + b.arena.gen);
  assert.deepEqual(b.genome, O.fixGenome(b.arena.pop[b.arena.champ]), 'the champion is the live genome');
  assert.match(s.genome.seal, /^[0-9a-f]{12}$/);
  for (const [k, [lo, hi]] of Object.entries(O.GENOME_SPEC)) assert.ok(b.genome[k] >= lo && b.genome[k] <= hi, k);
});

test('embodiment and the self: words, the action and the expectation become things you can hold; the self names what it sees', () => {
  const b = run(B.createBrain(13), 500, circle); B.tell(b, 'archive'); run(b, 30, circle);
  const e = B.embodiment(b), w = e.find((x) => x.key === 'w:archive'); assert.ok(w && w.node >= 0);
  B.dragTo(b, w, 0.9, 0.1); assert.ok(Math.abs(b.ws.nodes.x[w.node] - 0.9) < 1e-6); assert.equal(W.provenanceAt(b.ws, 0.9, 0.1).organ, 'you');
  const s = B.selfOf(b); assert.ok(s.utility >= 0 && s.utility <= 1); assert.ok(s.owner.top); assert.equal(s.goals.length, 4);
  assert.ok(B.selfSays(b).some((t) => /^Genome [0-9a-f]{12}/.test(t)));
  assert.ok(JSON.stringify(B.params(b)).indexOf('archive') < 0, 'a seal keeps numbers, never your words');
});

test('the draft map: every draft in atomeam/a-to-mind.com is either a part of an organ or left out with a reason', () => {
  assert.ok(drafts.total >= 233); assert.equal(drafts.total, drafts.drafts.length);
  for (const d of drafts.drafts) assert.ok(d.organ ? B.ORGAN_IDS.concat(['attention', 'imagination', 'embodiment', 'self', 'bridge']).includes(d.organ) : d.left, d.folder);
  for (const id of B.ORGAN_IDS) assert.ok(drafts.drafts.some((d) => d.organ === id), id + ' is made from at least one draft');
});

test('speed: a brain tick, imagination included, fits well inside a frame', () => {
  const b = B.createBrain(14), t = performance.now(); run(b, 300, circle); const ms = (performance.now() - t) / 300;
  assert.ok(ms < 8, ms.toFixed(2) + ' ms a tick');
});

test('bridge: another page tells the brain a word over the channel and hears its state back; with no brain open it hears nothing', async () => {
  const { hostBrain, connectBrain, summaryOf } = await import('../void-live-deploy/lib/brain-bridge.js');
  const lonely = connectBrain(); await new Promise((r) => setTimeout(r, 50)); assert.equal(lonely.state, null); assert.equal(lonely.live, false); lonely.close();
  const b = run(B.createBrain(13), 100, circle), got = [];
  const host = hostBrain(B, () => b, { onWords: (t) => got.push(t) }), page = connectBrain();
  const heard = new Promise((res) => page.on((m) => { if (m.words.includes('dragons')) res(m); }));
  page.tell('dragons and knights'); const m = await heard;
  assert.deepEqual(got, ['dragons and knights']); assert.ok(b.concepts.words.includes('knights'));
  assert.equal(m.type, 'state'); assert.ok(page.live); assert.ok(Array.isArray(m.self) && m.self.length >= 2);
  const g0 = b.will.good; page.reward(); await new Promise((r) => setTimeout(r, 50)); assert.equal(b.will.good, g0 + 1);
  assert.equal(page.tell('   '), false, 'empty words are not sent');
  const s = summaryOf(B, b); assert.ok(JSON.stringify(s).length < 4000, 'a small summary'); assert.ok(s.related.every((r) => typeof r.word === 'string'));
  host.close(); page.close();
});

test('the card takes its asks and leaves the look-alikes (skills/verse-brain.js)', async () => {
  const { default: skill } = await import('../void-live-deploy/skills/verse-brain.js');
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
  const { natureSummon } = await import('../void-live-deploy/skills/figures.js');
  assert.equal(natureSummon('show me your brain'), null, 'not a figure'); assert.ok(natureSummon('add a brain'), 'a brain figure is still a figure');
});
