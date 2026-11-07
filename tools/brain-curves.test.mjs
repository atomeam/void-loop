// brain-curves: the KAN draft (atomeam/a-to-mind.com drafts/F610-webgpu-kan-spline-dom-manifold-mind) is a real organ of Verse Brain, not
// a separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The draft made a tiny Kolmogorov-Arnold
// network (KAN) whose edges are spline curves, and let the pointer's residual nudge the knots, but it measured nothing against another
// learner. Here a KAN of shape [4, 3, 2] (linear splines on 8 pieces plus a linear term on each edge, 180 numbers) learns, from each
// pointer step and position, the change to the next step. "The same step again", a tanh network of the same shape and a tanh network with
// as many numbers (25 hidden units) are trained on the same frames with the same rate; one frame in 5 is held out, and each is scored on
// the last 300 held-out frames.
// Measured (5 visitors, 3 seeds, 3000 ticks; mean squared error of the guessed step on held-out frames; gain = the best baseline's error
// over the KAN's):
//   wander (a slow random walk): KAN 0.00157 to 0.00185, the same step again 0.00150 to 0.00178, the matched tanh network 0.00158 to 0.00181:
//     gain 0.93 to 0.96. The walk's next turn is noise, so "the same step again" is about the best guess there is, and every learner adds
//     a little error to it. The KAN is within 5% of the matched network, and as close as the same-shape network or closer.
//   bounce (straight lines off the walls): KAN 0.0030 to 0.0050, the same step 0.0028 to 0.0049, the matched network 0.0032 to 0.0053:
//     gain 0.95 to 1.00. As close as both tanh networks or closer on every seed, but not better than the same step again.
//   circles (a steady circle): the KAN 1.4e-5 to 1.7e-5, half the error of the same step again (3.2e-5), but the matched tanh network learns
//     the turn far better (1.7e-7 to 5.6e-7): gain 0.01 to 0.04.
//   line (a sweep that jumps back): gain 0.81 to 0.88, or none on the seed where the same step again is exact.
//   still (the pointer on one cell): nothing moves, so there is no gain.
//   Higher rates (0.1, 0.2), a linear output and a target scaled 10 or 30 times did not change the picture: the KAN beat the best
//   baseline on no visitor on every seed. 3000 ticks take about 26 ms alone.
// So the organ learns and is scored all the time, says these numbers, and shows its guess (the orb "where your next step goes") only on
// moves where its curves guess better than every baseline. On these visitors that is never, and the orb stays hidden.
// Run: node --test tools/brain-curves.test.mjs
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as X from '../void-live-deploy/lib/brain-curves.js';
import { curves } from '../void-live-deploy/lib/brain-curves.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';
import { par, ptest, test } from './brain-par.mjs';

const TICKS = 3000;
/** the visitors' pointers, one frame a tick; each call makes a fresh visitor with its own state */
const VISITORS = {
  wander: () => { let p = [0.5, 0.5], v = [0, 0]; return (t, r) => { v = [v[0] * 0.95 + (r() - 0.5) * 0.004, v[1] * 0.95 + (r() - 0.5) * 0.004]; p = [Math.min(0.95, Math.max(0.05, p[0] + v[0])), Math.min(0.95, Math.max(0.05, p[1] + v[1]))]; return { x: p[0], y: p[1] }; }; },
  bounce: () => { let p = [0.3, 0.6]; const v = [0.011, 0.007]; return () => { p = [p[0] + v[0], p[1] + v[1]]; if (p[0] < 0.05 || p[0] > 0.95) v[0] = -v[0]; if (p[1] < 0.05 || p[1] > 0.95) v[1] = -v[1]; return { x: p[0], y: p[1] }; }; },
  circles: () => (t) => ({ x: 0.5 + 0.25 * Math.cos(t * 0.03), y: 0.5 + 0.25 * Math.sin(t * 0.03) }),
  still: () => () => ({ x: 0.6, y: 0.4 }),
};
/** one visitor, one seed, run alone: what the organ measured */
export function run(name, seed, ticks = TICKS) {
  const C = X.makeCurves(seed), r = rng(seed * 77), f = VISITORS[name]();
  for (let t = 0; t < ticks; t++) X.curvesTick(C, { over: true, ...f(t, r) });
  return X.curvesOf(C);
}

ptest(import.meta.url, 'the curves guess the next step as closely as a tanh network as big as them, but no better than the best baseline, so they show nothing', async () => {
  const names = Object.keys(VISITORS), rows = await par(import.meta.url, 'run', names.flatMap((n) => [1, 2, 3].map((s) => [n, s])));
  const by = (n) => rows.filter((_, i) => names[Math.floor(i / 3)] === n), say = JSON.stringify(rows.map((r) => [r.err, r.gain]));
  for (const r of rows) assert.ok(r.held > 400 && r.trained > 2000 && r.numbers === 180 && r.hidden === 25, 'it learns and is scored on many frames ' + JSON.stringify(r));
  for (const n of ['wander', 'bounce']) for (const r of by(n)) {
    assert.ok(r.gain > 0.85 && r.gain < 1.05, 'about even with the same step again, which is near the best guess of noise ' + say);
    assert.ok(r.err.kan <= 1.05 * r.err.big, 'as close as the tanh network with as many numbers ' + say);
    assert.ok(r.err.kan <= 1.01 * r.err.small, 'at least as close as the tanh network of the same shape ' + say);
  }
  for (const r of by('circles')) {
    assert.ok(r.err.kan < r.err.same, 'on a circle the curves learn the turn: better than the same step again ' + say);
    assert.ok(r.err.big * 10 < r.err.kan && r.gain < 0.1, 'but the tanh network as big as them learns it far better ' + say);
  }
  for (const r of by('still')) assert.equal(r.gain, null, 'nothing moves: nothing to guess');
  assert.ok(rows.every((r) => !(r.gain > 1.05)), 'on no run do the curves beat the best baseline by more than 5% ' + say);
});

ptest(import.meta.url, 'it runs in the brain as one of twenty-nine organs: your pointer trains it, it stays quiet while a baseline wins, it is kept, and the self says so', () => {
  const b = B.createBrain(7), r = rng(3), f = VISITORS.wander(); B.tell(b, 'river stone light');
  for (let t = 0; t < TICKS; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  assert.ok(B.ORGAN_IDS.includes('curves') && B.ORGAN_IDS.length === 29);
  const s = X.curvesOf(b.curves);
  assert.ok(s.held > 400 && s.trained > 2000 && s.gain != null && s.gain < 1, 'on this slow walk it is scored, and the same step again wins ' + JSON.stringify(s));
  assert.equal(b.curves.fed, 0, 'it leaves no life in the field while it does not win');
  assert.ok(!B.embodiment(b).some((o) => o.key === 'curves'), 'no orb ' + JSON.stringify(b.board.curves));
  const self = B.selfSays(b).find((l) => /^Curves:/.test(l)) || '';
  assert.match(self, /^Curves: a Kolmogorov-Arnold network \(the KAN draft\) of 180 numbers on learned spline curves that trained on \d+ of your steps; on steps it never trained on its guess error is [\d.e-]+, against [\d.e-]+ for the same step again and [\d.e-]+ for a tanh network as big as it, so a baseline guesses as well or better and it shows nothing\.$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('curves'));
  assert.deepEqual(X.knotsOf(fresh.curves), X.knotsOf(b.curves));
  assert.equal(fresh.curves.held, 0, 'the scores start again: they are measured, not kept');
  assert.equal(Object.keys(k.curves).sort().join(), 'c,w', 'only the knots and linear terms are kept, never a step');
});

test('with nobody pointing it rests: no frame, no score', () => {
  const b = B.createBrain(5), r = rng(9), f = VISITORS.wander();
  for (let t = 0; t < 400; t++) B.stepBrain(b, { over: true, ...f(t, r) });
  const before = JSON.stringify([b.curves.ticks, b.curves.trained, b.curves.held]);
  for (let t = 0; t < 40; t++) B.stepBrain(b, { over: false });
  assert.equal(JSON.stringify([b.curves.ticks, b.curves.trained, b.curves.held]), before);
  assert.equal(b.curves.p1, null, 'a pointer that leaves gives no step when it comes back');
});

test('the orb and a run come only while the curves beat every baseline on a new score', () => {
  const b = B.createBrain(5); for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (live) => { b.board.curves = { x: 0.5, y: 0.5, live, gain: live ? 1.2 : 0.9, tick: b.ticks }; return B.embodiment(b).some((o) => o.key === 'curves'); };
  assert.equal(orb(true), true);
  assert.equal(orb(false), false);
  const C = X.makeCurves(3); C.held = X.MIN_HELD; C.posted = 0; C.last = { at: [0.5, 0.5], x: [0.2, 0, 0, 0] };
  C.err = { kan: [0.001], same: [0.002], small: [0.003], big: [0.0015] };
  assert.equal(X.gainOf(C), 1.5);
  assert.equal(curves.rests({ curves: C }), false, 'it beats every baseline on a new score: it asks for a run');
  const bb = { curves: C, ws: B.createBrain(5).ws, board: {}, ticks: 9 };
  curves.run(bb);
  assert.ok(bb.board.curves.live && C.fed === 1 && bb.board.curves.x > 0.5, 'its guess goes on along the step ' + JSON.stringify(bb.board.curves));
  assert.equal(curves.rests({ curves: C }), true, 'no new score since its run: it rests');
  C.posted = 0; C.err.big = [0.0009];
  assert.equal(curves.rests({ curves: C }), true, 'a baseline guesses better: it rests');
  C.err.big = [0.0015]; C.held = X.MIN_HELD - 1;
  assert.equal(X.gainOf(C), null, 'too few held-out frames: no score yet');
});

test('kept curves of the wrong shape or range are refused and change nothing', () => {
  const C = X.makeCurves(4), before = JSON.stringify(X.knotsOf(C)), good = X.knotsOf(C);
  const bad = [null, {}, { c: good.c }, { c: good.c.slice(1), w: good.w }, { c: [good.c[0].slice(1), good.c[1]], w: good.w },
    { c: [[...good.c[0].slice(1), 'x'], good.c[1]], w: good.w }, { c: good.c, w: [good.w[0], [...good.w[1].slice(1), 99]] }, { c: good.c, w: [good.w[0], [...good.w[1].slice(1), NaN]] }];
  for (const v of bad) assert.equal(X.loadKnots(C, v), false, JSON.stringify(v).slice(0, 40));
  assert.equal(JSON.stringify(X.knotsOf(C)), before);
  const other = X.knotsOf(X.makeCurves(8));
  assert.equal(X.loadKnots(C, other), true);
  assert.deepEqual(X.knotsOf(C), other);
});

test('a held-out frame never trains a learner, a spline edge is a real curve, and every learner guesses the change to the same step', () => {
  const C = X.makeCurves(6);
  let held = 0, trained = 0;
  for (let t = 0; t < 500; t++) { const h = C.held, k = C.trained; X.curvesTick(C, { over: true, x: 0.3 + 0.001 * t, y: 0.4 + 0.0005 * t }); if (C.held > h) held++; if (C.trained > k) trained++; }
  assert.equal(held + trained, 498, 'every frame after the first two is held out or trained on, never both');
  assert.ok(held > 60 && held < 140, 'about one frame in 5 is held out ' + held);
  const F = X.frameOf([0.5, 0.5], [0.52, 0.5], [0.55, 0.5]);
  assert.deepEqual(F.v.map((v) => +v.toFixed(6)), [0.5, 0]);
  assert.deepEqual(F.d.map((v) => +v.toFixed(6)), [0.25, 0], 'the target is the next step less this step');
  assert.equal(X.frameOf(null, [0.5, 0.5], [0.5, 0.5]), null);
  const K = X.makeKan(rng(1)), L = K[0], e = 0, o = e * X.NB; L.c.fill(0); L.w.fill(0); K[1].c.fill(0); K[1].w.fill(0);
  for (let k = 0; k < X.NB; k++) L.c[o + k] = ((k / X.GK) * 2 - 1) ** 2; // edge 0 of layer 0 draws x squared through its knots
  const at = (x) => X.kanForward(K, [x, 0, 0, 0]).acts[1][0];
  assert.ok(Math.abs(at(0.5) - Math.tanh(0.25)) < 0.01 && Math.abs(at(-1) - Math.tanh(1)) < 1e-9 && Math.abs(at(0) - 0) < 1e-9, 'the curve is the knots joined by straight pieces');
  const C2 = X.makeCurves(2), x = [0.3, -0.2, 0.1, 0.4], t = [0.05, -0.02], e0 = (y) => (y[0] - t[0]) ** 2 + (y[1] - t[1]) ** 2;
  const before = e0(X.kanForward(C2.kan, x).y); for (let i = 0; i < 50; i++) X.kanTrain(C2.kan, x, t);
  assert.ok(e0(X.kanForward(C2.kan, x).y) < before / 10, 'its gradient steps fit a target');
});
