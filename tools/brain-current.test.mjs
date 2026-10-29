// brain-current: F447's LBM evolved swimmers mind (atomeam/a-to-mind.com drafts/F447) is a real organ of Verse Brain, not a separate demo
// (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). F447's page blurred a density grid and called it LBM.
// Here the flow is a D2Q9 lattice-Boltzmann solver, and swimmers with tiny networks are evolved for the tissue's life they reach.
// Measured on 6 real brains (200 lives each, mean food over the last 50 lives): evolved swimmers gathered more than random search with
// the same scorings on 6 of 6, mean +0.062 (about 20% more); they gathered more than in their first 50 lives on 6 of 6; and more than
// drifters riding the same flow on 6 of 6 (1.4 to 2.3 times). This test runs 3 of those brains. Run: node --test tools/brain-current.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as K from '../void-live-deploy/lib/brain-current.js';

/** the real tissue's life as food, one frame each time the organ runs, while a visitor's pointer circles and words are told */
function frames(seed, ticks) {
  const b = B.createBrain(seed); B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden', 'flip a coin'][seed % 4]); const out = [];
  for (let t = 0; t < ticks; t++) {
    const a = t * (0.01 + 0.004 * (seed % 5)); B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: t % 400 < 300 });
    if (t >= 200 && t % K.EVERY === 0) out.push(K.foodOf(b));
  }
  return out;
}
const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length;

test('the fluid keeps its mass and its momentum (the steady force sums to nothing over the height), and that force makes a shear flow', () => {
  const fl = K.makeFluid(); for (let c = 0; c < K.NX * K.NY; c++) fl.f[c * K.Q + 1] += 0.002 * (1 + Math.sin(c)); // a lumpy start
  const m0 = K.moments(fl);
  for (let n = 0; n < 300; n++) K.stepFluid(fl);
  const m1 = K.moments(fl);
  assert.ok(Math.abs(m1.mass - m0.mass) < 1e-2, 'mass ' + m0.mass + ' -> ' + m1.mass);
  assert.ok(Math.abs(m1.px - m0.px) < 1e-2 && Math.abs(m1.py - m0.py) < 1e-2, 'momentum ' + JSON.stringify([m0, m1]));
  // the steady (Kolmogorov) force is a sine of the height: the flow it makes runs one way in the lower half and the other way above
  let lo = 0, hi = 0; for (let x = 0; x < K.NX; x++) { lo += fl.ux[Math.floor(K.NY / 4) * K.NX + x]; hi += fl.ux[Math.floor((3 * K.NY) / 4) * K.NX + x]; }
  assert.ok(lo - m1.px / (K.NY) > 0.01 && hi - m1.px / K.NY < -0.01, 'shear ' + lo + ' ' + hi);
});

test('evolved swimmers gather more life than random search with the same scorings, more than their first lives, and more than drifters', () => {
  const LIVES = 150, TAIL = 40, rows = [];
  for (const seed of [1, 2, 3]) {
    const fr = frames(seed, 1400);
    const run = (blind) => { const C = K.makeCurrent(seed, blind), fo = [], ga = []; let n = 0; while (C.lives < LIVES) { const f = fr[n++ % fr.length]; for (let s = 0; s < K.SUB; s++) { const r = K.stepCurrent(C, f); if (r) { fo.push(r.food); ga.push(r.gain); } } } return { C, fo, ga }; };
    const E = run(false), L = run(true);
    assert.equal(E.C.evals, L.C.evals, 'the same scorings');
    rows.push({ first: mean(E.fo.slice(0, TAIL)), last: mean(E.fo.slice(-TAIL)), blind: mean(L.fo.slice(-TAIL)), gain: mean(E.ga.slice(-TAIL)), mass: K.moments(E.C.fluid).mass });
  }
  const say = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))));
  assert.ok(rows.every((r) => r.last > r.blind), 'evolved over random search ' + say);
  assert.ok(rows.every((r) => r.last > r.first), 'evolved over its first lives ' + say);
  assert.ok(rows.every((r) => r.gain > 1), 'over drifters ' + say);
  assert.ok(rows.every((r) => Math.abs(r.mass - K.NX * K.NY) < 1), 'the swimmers push the fluid without making or losing mass ' + say);
});

test('it runs in the brain as one of nineteen organs: your drag stirs it, it evolves, feeds the tissue, is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (let t = 0; t < 3000; t++) { const a = t * 0.013; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: true }); }
  assert.ok(B.ORGAN_IDS.includes('current') && B.ORGAN_IDS.length === 19);
  assert.ok(b.current.lives >= 8 && b.runs.current > 200, 'lives ' + b.current.lives + ' runs ' + b.runs.current);
  assert.ok(b.current.fed > 0, 'it fed the tissue where it swam');
  assert.ok(b.board.current && b.board.current.lives === b.current.lives, JSON.stringify(b.board.current));
  // its body on the card: the orb 'riding the current' is drawn from the measured gain over drifters, never set by hand. Here the
  // swimmers won that race in the brain (the board gain is the mean of their lives against drifters), so the orb is there where they swim
  const orb = B.embodiment(b).find((e) => e.key === 'current');
  assert.ok(b.board.current.gain > 1, 'the swimmers beat the drifters in the brain, gain ' + b.board.current.gain);
  assert.ok(orb && orb.organ === 'current' && orb.label === 'riding the current' && orb.x === b.board.current.x && orb.y === b.board.current.y, JSON.stringify(orb));
  // and it goes when the measure says they do not beat the drifters: the same brain, its gain put under 1, has no current orb
  const under = { ...b, board: { ...b.board, current: { ...b.board.current, gain: 0.9 } } };
  assert.ok(!B.embodiment(under).some((e) => e.key === 'current'), 'no orb when the swimmers do not beat the drifters');
  const self = B.selfSays(b).find((l) => /^Current:/.test(l)) || '';
  assert.match(self, /^Current: \d+ lives? of swimmers whose tiny networks evolve to ride a lattice-Boltzmann flow your drag stirs; (they gather \d+\.\d times the life of drifters in the same flow|they do not yet gather more life than drifters in the same flow)(\.|, and \d+% more than their first lives\.|, and not yet more than their first lives\.)$/);
  // your drag pushes the fluid: the same current, one run with a drag across it and one without
  const c1 = K.makeCurrent(3), c2 = K.makeCurrent(3), fake = (C, over) => ({ current: C, senses: { over, trail: [[0.3, 0.5, 0], [0.5, 0.5, 0]] }, ws: b.ws, board: {}, ticks: 0 });
  c1.since = c2.since = K.EVERY; K.current.run(fake(c1, true)); K.current.run(fake(c2, false));
  assert.ok(K.moments(c1.fluid).px > K.moments(c2.fluid).px + 0.01, 'the drag moved the fluid');
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('current'));
  assert.deepEqual(K.swimmersOf(fresh.current), K.swimmersOf(b.current));
});

test('kept swimmers of the wrong shape or range are refused and change nothing', () => {
  const a = K.makeCurrent(3), k = JSON.parse(JSON.stringify(K.swimmersOf(a))), c = K.makeCurrent(4), before = JSON.stringify(K.swimmersOf(c));
  const bad = [null, {}, { ...k, pop: k.pop.slice(1) }, { ...k, champ: 99 }, { ...k, champ: 1.5 }, { ...k, lives: -1 }, { ...k, pop: k.pop.map((w) => w.slice(1)) },
    { ...k, pop: k.pop.map((w) => w.map(() => 9)) }, { ...k, pop: k.pop.map((w) => w.map(() => 'x')) }, { ...k, pop: k.pop.map((w) => w.map(() => null)) }];
  for (const v of bad) assert.equal(K.loadSwimmers(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(K.swimmersOf(c)), before);
  assert.equal(K.loadSwimmers(c, k), true);
});
