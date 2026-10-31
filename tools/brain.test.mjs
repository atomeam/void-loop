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
  run(b, 600); const rests = new Set(B.ORGANS.filter((o) => o.rests && o.rests(b)).map((o) => o.id)); // an organ with nothing to do rests; it is not starved
  assert.deepEqual([...rests], ['dialogue'], 'only the dialogue organ rests, with no recalled ask'); assert.equal(b.runs.dialogue, 0, 'a resting organ takes no run');
  for (const id of B.ORGAN_IDS) if (id !== 'senses' && id !== 'gestures' && id !== 'predictor' && !rests.has(id)) assert.ok(b.runs[id] > 0, id + ' ran');
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
  // the conversation orb was asked for by the owner (2026-10-30), not built from a draft: it is the one organ no draft maps to
  const FROM_OWNER = ['dialogue'];
  for (const id of B.ORGAN_IDS) assert.ok(FROM_OWNER.includes(id) || drafts.drafts.some((d) => d.organ === id), id + ' is made from at least one draft');
  for (const id of FROM_OWNER) assert.ok(!drafts.drafts.some((d) => d.organ === id), id + ' is not claimed for a draft it was not made from');
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

// ---- the mind layers (lib/brain-mind.js; owner's spec, 2026-10-29) -----------------------------------------------------------------------
import * as Mi from '../void-live-deploy/lib/brain-mind.js';

test('goals: an ask becomes ideas that pull the input layer where they sit, decay unless kept, and count toward the valence', () => {
  const b = run(B.createBrain(21), 120), r = B.ask(b, 'show me the dragons');
  assert.deepEqual(r.words, ['dragons'], 'the little words carry no idea'); assert.equal(b.mind.goals.length, 1);
  const n = b.concepts.node[b.mind.goals[0].idx], x = b.ws.nodes.x[n], y = b.ws.nodes.y[n];
  const before = W.readRegion(b.ws, 'input', { x0: x - 0.05, y0: y - 0.05, x1: x + 0.05, y1: y + 0.05 }).mean; run(b, 20);
  assert.ok(W.readRegion(b.ws, 'input', { x0: x - 0.05, y0: y - 0.05, x1: x + 0.05, y1: y + 0.05 }).mean > before, 'the goal pulls where its idea is');
  assert.ok(Mi.goalMatch(b) > 0); const s0 = b.mind.goals[0].strength; run(b, 2000); assert.ok(!b.mind.goals.length || b.mind.goals[0].strength < s0, 'it fades unless asked again');
  B.ask(b, 'dragons'); assert.equal(b.mind.goals[0].strength, 1, 'asking again renews it');
});

test('episodes: each choice is remembered with what it did, and the will reads states like this one before it chooses', () => {
  const b = run(B.createBrain(22), 600, circle);
  assert.ok(b.mind.episodes.length >= 5, 'episodes: ' + b.mind.episodes.length);
  for (const e of b.mind.episodes) { assert.equal(e.key.length, 26); assert.ok(Number.isFinite(e.gain)); }
  const key = Mi.keyOf(b), fake = { t: 0, key: Array.from(key), action: 3, gesture: -1, before: 0.4, after: 0.7, gain: 0.3, goals: [] };
  b.mind.episodes = [fake, fake, fake, { ...fake, action: 1, gain: -0.2 }];
  const p = Mi.episodicPrior(b, key); assert.ok(p.gain[3] > 0.25 && p.gain[1] < -0.15, 'swirl helped here, seed hurt: ' + Array.from(p.gain));
  assert.ok(Mi.nearestEpisodes(b, 1)[0].sim > 0.99);
});

test('procedures: the arena keeps the genome that won with its context, and a later generation in that context starts from it', () => {
  const b = run(B.createBrain(23), 900, circle);
  assert.ok(b.mind.procedures.length >= 1); const p = Mi.bestProcedure(b, b.mind.procedures[0].ctx); assert.ok(p && p.genome && Number.isFinite(p.fitness));
  const ctx = Mi.contextOf(b), special = O.fixGenome({ ...b.genome, feed: 0.031 }); b.mind.procedures = [{ ctx, fitness: 9, genome: special, gen: 0 }];
  b.arena.since = 1e6; b.arena.gen = 2; run(b, 2); // the next generation is the third: it seeds from memory
  assert.ok(b.arena.fromMemory || b.arena.pop.some((g) => Math.abs(g.feed - 0.031) < 1e-9), 'the remembered genome joined the population');
});

test('monitor: two organs that write one region in turn while its value swings are found, the one that wants it less is slowed, and the card can say where', () => {
  const b = B.createBrain(24), c = W.regionCenter(5);
  const cells = []; for (let i = 0; i < W.CELLS; i++) { const x = ((i % W.GW) + 0.5) / W.GW, y = (Math.floor(i / W.GW) + 0.5) / W.GH; if (W.regionOf(x, y) === 5) cells.push(i); }
  for (let t = 0; t < Mi.MONITOR_EVERY * 2; t++) { // the swarm lifts the region, the membrane presses it down, in turn
    b.ticks++; b.ws.tick++;
    for (const i of cells) W.writeCell(b.ws, 'input', i, t % 2 ? 0.6 : 0.05, t % 2 ? 'swarm' : 'membrane');
    Mi.stepMonitor(b, B.ORGANS);
  }
  const k = b.mind.conflicts.find((x) => x.region === 5); assert.ok(k, JSON.stringify(b.mind.conflicts));
  assert.ok(k.organs.includes('swarm') && k.organs.includes('membrane')); assert.ok(b.mind.throttle[k.slowed] > 0);
  const ids = B.scheduleTick(b); assert.ok(Array.isArray(ids));
  assert.ok(Mi.explain(b, 'why is that region like that', { swarm: 'swarm', membrane: 'membrane' }).some((t) => /disagree/.test(t)));
  const quiet = run(B.createBrain(25), 400); assert.equal(quiet.mind.conflicts.filter((x) => x.organs.includes('you')).length, 0, 'nobody there, no disagreement with you');
});

test('valence: approval, goals and alignment with what Verse is working on move the preference; with nobody there it is the coherence', () => {
  const b = run(B.createBrain(26), 200), coh = B.utilityOf(b.ws, b.focus);
  assert.ok(Math.abs(B.valence(b) - coh) < 1e-9, 'nobody there: coherence alone');
  const n = B.knowVerse(b, { tower: { target: 'sycophanthex.com' }, open: [{ ask: 'Absorb and connect every repo' }], tracks: [{ name: 'Planet restoration' }] });
  assert.ok(n >= 4 && b.mind.semantic.some((s) => s.word === 'sycophanthex'));
  B.ask(b, 'planets'); run(b, 5); assert.ok(Mi.alignment(b) > 0.1, 'planets is near planet: ' + Mi.alignment(b)); assert.equal(b.mind.aligned.near, 'planet');
  const p0 = b.mind.pref[b.will.action]; B.reward(b); assert.ok(b.mind.approval > 0.4 && b.mind.pref[b.will.action] > p0);
});

test('history and explain: it says what just happened and why a region formed, from its own state', () => {
  const b = run(B.createBrain(27), 900, circle), r = Mi.recent(b);
  assert.ok(r.seconds >= 10 && r.utility.length === 2 && r.focusMoves >= 0);
  const a = B.ask(b, 'what just happened?').answer; assert.match(a[0], /^In the last \d+ seconds my utility went from [\d.]+ to [\d.]+/);
  const w = B.ask(b, 'why did that cluster form?').answer; assert.match(w[0], /^The (?:top|middle|bottom) (?:far left|left|right|far right) is (?:busy|quiet)/); assert.ok(w.some((t) => /written by/.test(t)), w.join(' '));
  assert.ok(B.ask(b, 'what are you doing').answer[0].startsWith('I am attending to'));
  assert.equal(b.concepts.words.length, 0, 'a question is answered, not stored as ideas');
});

test('knowledge: what it learned survives a reload as numbers, a wrong record is ignored, and a seal still holds no words', () => {
  const b = run(B.createBrain(28), 900, circle); B.ask(b, 'romance'); run(b, 100, circle);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), b2 = B.createBrain(29), done = B.loadKnowledge(b2, k);
  assert.deepEqual(done, ['q', 'memory', 'gestures', 'preferences', 'synapses', 'creature', 'hearing', 'painter', 'gardener', 'grower', 'formula', 'current', 'grains', 'pool', 'trace', 'asks', 'procedures', 'episodes']);
  assert.deepEqual(b2.creature.mean, b.creature.mean.map((v) => Math.round(v * 1000) / 1000), 'the creature keeps its evolved physics');
  assert.deepEqual(Array.from(b2.synapses.W), Array.from(b.synapses.W, (v) => Math.fround(Math.round(v * 1000) / 1000)), 'the eye keeps its learned wiring');
  assert.deepEqual(Array.from(b2.will.q), Array.from(b.will.q, (v) => Math.round(v * 1000) / 1000).map((v) => Math.fround(v)));
  assert.deepEqual(B.loadKnowledge(B.createBrain(30), { v: 1, q: [1, 2], episodes: [{ key: [1], action: 9 }] }), [], 'a record of the wrong shape restores nothing');
  assert.equal(B.createBrain(31).mind.episodes.length, 0); assert.ok(JSON.stringify(B.params(b)).indexOf('romance') < 0);
});

test('store: with no IndexedDB (node, a private window that refuses it) every call resolves and nothing breaks (lib/brain-store.js)', async () => {
  const St = await import('../void-live-deploy/lib/brain-store.js');
  assert.equal(await St.loadKept(), null); assert.equal(await St.keep({ v: 1 }), false); assert.equal(await St.forget(), false);
});

test('an organ newer than a kept brain shows what it does now, not its share of the life before it existed', () => {
  const old = structuredClone(B.workingOf(run(B.createBrain(31), 400, circle)));
  delete old.runs.gardener; delete old.lastRun.gardener; delete old.recent; old.ticks = 100000; // a brain kept for a long time before the gardener joined it
  const b = B.createBrain(31); assert.ok(B.loadWorking(b, old).includes('workspace'));
  const r0 = b.runs.gardener, t0 = b.ticks; run(b, 1500, circle);
  const now = (b.runs.gardener - r0) / (b.ticks - t0), use = B.selfOf(b).use;
  assert.ok(now > 0.1, 'the gardener runs on ' + now + ' of these ticks');
  assert.ok(Math.abs(use.gardener - now) < 0.08, 'shown ' + use.gardener + ', runs ' + now);
  assert.ok(use.senses === 1 && use.tissue > 0.5, JSON.stringify(use));
  const again = B.createBrain(32); B.loadWorking(again, structuredClone(B.workingOf(b)));
  assert.deepEqual(B.selfOf(again).use, use, 'the recent share is kept with the brain');
});
