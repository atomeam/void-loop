// brain-atlas: the Kohonen SOM draft (atomeam/a-to-mind.com drafts/F606-webgpu-som-spatial-dom-mind) is a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The draft let a lattice of neurons
// self-organize on the pointer's motion with a Gaussian neighbourhood, but it measured nothing against a learner without the
// neighbourhood. Here an 8 x 8 map learns each pointer frame [x, y, vx, vy]; the same learner with no neighbourhood and MacQueen's online
// k-means learn the same frames from the same start; one frame in 5 is held out, and all three are scored on the last 200 held-out frames.
// Measured (4 visitors, 3 seeds, 3000 ticks; each error the mean of the last 10 scores):
//   topographic error (the share of held-out frames whose two nearest units are not side by side on the lattice):
//     wander 0.20 to 0.42 for the map, against 0.79 to 0.94 with no neighbourhood (gain 2.1 to 3.9);
//     circles 0.06 to 0.10, against 0.70 to 0.94 (gain 7.8 to 10.7); line 0.43 to 0.47, against 0.98 to 1.0 (gain 2.1 to 2.3).
//     The two baselines have no lattice of their own, so their error is about what a random order gives (about 0.87): the gain says the
//     map keeps neighbouring moves on neighbouring units, which is what a SOM is for, not that it guesses anything better.
//   quantization error (the mean distance to the nearest unit): the map 0.05 to 0.12, k-means 0.06 to 0.14, the no-neighbourhood learner
//     0.05 to 0.13: alone, the map fits the moves as closely as k-means or closer on every run here, because the neighbourhood pulls
//     units that never win into the moves, where the others leave them dead. In the brain, on one slow walk (seed 7, 3000 ticks), it was
//     a little less close: 0.110 against 0.106 for k-means, with 86% of held-out moves in order against 24% (gain 5.1).
//   still (the pointer on one cell): the frames have no shape, so there is nothing to map: no gain, and the orb stays hidden.
//   3000 ticks take about 50 ms alone.
// So the organ shows its map (the orb "a map of how you move") while it keeps the order and fits the moves within 1.25 times k-means'
// error, and it says so in numbers.
// Run: node --test tools/brain-atlas.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as X from '../void-live-deploy/lib/brain-atlas.js';
import { atlas } from '../void-live-deploy/lib/brain-atlas.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';
import { par, ptest, test } from './brain-par.mjs';

const TICKS = 3000;
/** the visitors' pointers, one frame a tick; each call makes a fresh visitor with its own state */
const VISITORS = {
  wander: () => { let p = [0.5, 0.5], v = [0, 0]; return (t, r) => { v = [v[0] * 0.95 + (r() - 0.5) * 0.004, v[1] * 0.95 + (r() - 0.5) * 0.004]; p = [Math.min(0.95, Math.max(0.05, p[0] + v[0])), Math.min(0.95, Math.max(0.05, p[1] + v[1]))]; return { x: p[0], y: p[1] }; }; },
  circles: () => (t) => ({ x: 0.5 + 0.25 * Math.cos(t * 0.03), y: 0.5 + 0.25 * Math.sin(t * 0.03) }),
  line: () => (t) => ({ x: 0.1 + 0.8 * ((t % 200) / 200), y: 0.3 }),
  still: () => () => ({ x: 0.6, y: 0.4 }),
};
/** one visitor, one seed, run alone: what the organ measured */
export function run(name, seed, ticks = TICKS) {
  const A = X.makeAtlas(seed), r = rng(seed * 77), f = VISITORS[name]();
  for (let t = 0; t < ticks; t++) X.atlasTick(A, { over: true, ...f(t, r) });
  return X.atlasOf(A);
}

ptest(import.meta.url, 'the map keeps neighbouring moves on neighbouring units far better than the same learner with no neighbourhood, and fits them as closely as k-means', async () => {
  const names = Object.keys(VISITORS), rows = await par(import.meta.url, 'run', names.flatMap((n) => [1, 2, 3].map((s) => [n, s])));
  const by = (n) => rows.filter((_, i) => names[Math.floor(i / 3)] === n), say = JSON.stringify(rows.map((r) => [r.te, r.qe, r.gain]));
  for (const n of ['wander', 'circles', 'line']) for (const r of by(n)) {
    assert.ok(r.evals > 40 && r.held === X.TEST && r.trained > 2000, 'it learns and is scored many times ' + JSON.stringify([r.evals, r.held, r.trained]));
    assert.ok(r.gain > 1.8, 'it keeps the order far better than the learner with no neighbourhood ' + say);
    assert.ok(r.te.flat > 0.6 && r.te.km > 0.6, 'the baselines have no lattice: their order is about chance ' + say);
    assert.ok(r.qe.som <= 1.25 * r.qe.km, 'it still fits the moves within 1.25 times k-means\' error ' + say);
    assert.equal(r.live, true);
  }
  assert.ok(by('circles').every((r) => r.gain > 5), 'a circle is a ring the map lays out with almost no break ' + say);
  for (const r of by('still')) { assert.equal(r.gain, null, 'one cell: nothing to map'); assert.equal(r.live, false); }
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-nine organs: your pointer trains it, it shows while it keeps the order, it is kept, and the self says so', () => {
  const b = B.createBrain(7), r = rng(3), f = VISITORS.wander(); B.tell(b, 'river stone light');
  for (let t = 0; t < TICKS; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  assert.ok(B.ORGAN_IDS.includes('atlas') && B.ORGAN_IDS.length === 29);
  const s = X.atlasOf(b.atlas);
  assert.ok(s.evals > 40 && s.gain > 1.8 && s.live, 'on this slow walk the map keeps the order and fits the moves ' + JSON.stringify(s));
  assert.ok(b.runs.atlas > 0 && b.atlas.fed > 0, 'it took runs and left a little life where the map holds your move ' + b.runs.atlas + ' ' + b.atlas.fed);
  const orb = B.embodiment(b).find((o) => o.key === 'atlas');
  assert.ok(orb && orb.label === 'a map of how you move', JSON.stringify(b.board.atlas));
  const self = B.selfSays(b).find((l) => /^Atlas:/.test(l)) || '';
  assert.match(self, /^Atlas: a self-organizing map \(the Kohonen SOM drafts\) of 64 units that learned \d+ of your moves; on moves it never trained on, \d+% have their two nearest units side by side, against \d+% for the same learner with no neighbourhood, so it keeps \d+\.\d times fewer of your moves out of order; its error is [\d.]+, against [\d.]+ for k-means\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('atlas'));
  assert.deepEqual(X.mapOf(fresh.atlas).w, X.mapOf(b.atlas).w);
  assert.equal(fresh.atlas.evals, 0, 'the scores start again: they are measured, not kept');
  assert.equal(Object.keys(k.atlas).sort().join(), 't,w', 'only the weights are kept, never a move');
});

test('with nobody pointing it rests: no sample, no score', () => {
  const b = B.createBrain(5), r = rng(9), f = VISITORS.wander();
  for (let t = 0; t < 400; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  const before = JSON.stringify([b.atlas.ticks, b.atlas.t, b.atlas.evals, b.atlas.test.length]);
  for (let t = 0; t < 40; t++) B.stepBrain(b, { over: false });
  assert.equal(JSON.stringify([b.atlas.ticks, b.atlas.t, b.atlas.evals, b.atlas.test.length]), before);
  assert.equal(b.atlas.prev, null, 'a pointer that leaves gives no velocity when it comes back');
});

test('the orb shows only while the map keeps the order and fits the moves, and a map that loses takes no run', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (live) => { b.board.atlas = { x: 0.5, y: 0.5, live, gain: live ? 2 : 0.9, tick: b.ticks, unit: 0 }; return B.embodiment(b).some((o) => o.key === 'atlas'); };
  assert.equal(orb(true), true);
  assert.equal(orb(false), false);
  const A = X.makeAtlas(3); A.evals = 20; A.posted = 19; A.last = [0.5, 0.5, 0.5, 0.5];
  A.test = Array.from({ length: 100 }, (_, i) => [i / 100, 0.5, 0.5, 0.5]);
  A.te = { som: [0.9], flat: [0.8], km: [0.8] }; A.qe = { som: [0.1], flat: [0.1], km: [0.1] };
  assert.equal(atlas.rests({ atlas: A }), true, 'no neighbourhood keeps the order as well: it rests');
  A.te.som = [0.2];
  assert.equal(atlas.rests({ atlas: A }), false, 'it keeps the order and fits: it asks for a run');
  A.qe.som = [0.2];
  assert.equal(atlas.rests({ atlas: A }), true, 'it keeps the order but fits the moves far worse than k-means: it rests');
});

test('a kept map of the wrong shape or range is refused and changes nothing', () => {
  const A = X.makeAtlas(4), before = JSON.stringify(X.mapOf(A)), ok = Array(X.U * X.D).fill(0.5);
  const bad = [null, {}, { w: ok.slice(1) }, { w: [...ok.slice(1), 'x'] }, { w: [...ok.slice(1), 2] }, { w: [...ok.slice(1), NaN] }, { w: [...ok.slice(1), -0.1] }, { w: 'w' }];
  for (const v of bad) assert.equal(X.loadMap(A, v), false, JSON.stringify(v).slice(0, 40));
  assert.equal(JSON.stringify(X.mapOf(A)), before);
  assert.equal(X.loadMap(A, { w: ok, t: 900 }), true);
  assert.deepEqual(X.mapOf(A).w, ok);
});

test('a held-out frame never trains a learner, and the neighbourhood is what the map adds', () => {
  const A = X.makeAtlas(6), w = JSON.stringify([Array.from(A.som.w), Array.from(A.flat.w), Array.from(A.km.w)]);
  assert.equal(JSON.stringify(Array.from(A.som.w)), JSON.stringify(Array.from(A.flat.w)), 'every learner starts from the same weights');
  let held = 0, trained = 0;
  for (let t = 0; t < 500; t++) { const n = A.test.length, k = A.t; X.atlasTick(A, { over: true, x: 0.3 + 0.001 * t, y: 0.4 }); if (A.test.length > n) held++; if (A.t > k) trained++; }
  assert.equal(held + trained, 499, 'every frame after the first is held out or trained on, never both');
  assert.ok(held > 60 && held < 140, 'about one frame in 5 is held out ' + held);
  const B2 = X.makeAtlas(6), s = [0.9, 0.1, 0.5, 0.5], [c] = X.bmu2(B2.som.w, s), f0 = Array.from(B2.flat.w);
  X.train(B2, s, 0);
  let movedSom = 0, movedFlat = 0;
  for (let i = 0; i < X.U; i++) { if (i !== c && B2.som.w[i * X.D] !== f0[i * X.D]) movedSom++; if (i !== c && B2.flat.w[i * X.D] !== f0[i * X.D]) movedFlat++; }
  assert.ok(movedSom > 10 && movedFlat === 0, 'the map moves the winner\'s neighbours too, the flat learner only the winner ' + movedSom);
  assert.ok(X.sigmaAt(0) === X.SIG0 && X.sigmaAt(1e6) === X.SIG1 && X.etaAt(1e6) === X.ETA1, 'the radius and rate fall, then stay');
  assert.ok(w.length > 0);
});
