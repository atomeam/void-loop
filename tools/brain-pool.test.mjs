// brain-pool: F459's SPH MLP agent mind (atomeam/a-to-mind.com drafts/F459) is a real organ of Verse Brain, not a separate demo (owner,
// 2026-10-29: "combine all the builds into one entity", "dont fake it"). F459's tiny network (6 -> 12 -> 3) set the viscosity, stiffness
// and kernel size of an SPH fluid but was random and never learned. Here the network learns from mirrored tries on the same life, and is
// measured against the same search on the output biases only (the best constant setting) and against random search.
// Measured on 12 real brains' focus paths with a pointer stirring (400 lives, mean of the last 50): the learned network's cost was the
// starter's over 1.41, the best constant setting's 1.35, random search's 1.19; the network beat both on 12 of 12. Its viscosity follows the
// slosh it senses (it thickens the fluid when the drop sloshes). On the 3 brains this test runs (300 lives): learned 1.29 1.43 1.31,
// constant 1.25 1.39 1.29, random 1.13 1.22 1.15; the correlation of viscosity with slosh 0.56 0.21 0.61.
// Run: node --test tools/brain-pool.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as K from '../void-live-deploy/lib/brain-pool.js';

/** the real brain's focus, one frame each time the organ runs, while a visitor's pointer circles (and leaves) and words are told; with
 *  the pointer as the spoon the organ would get from the senses */
function frames(seed, ticks) {
  const b = B.createBrain(seed); B.tell(b, ['river stone light', 'dragons and maps', 'a quiet garden', 'flip a coin'][seed % 4]); const out = [];
  for (let t = 0; t < ticks; t++) {
    const a = t * (0.01 + 0.004 * (seed % 5)); B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: t % 400 < 300 });
    if (t >= 200 && t % K.EVERY === 0) out.push({ x: b.focus.x, y: b.focus.y, spoon: K.spoonOf(b.senses) });
  }
  return out;
}
const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length;
const r3 = (v) => Math.round(v * 1000) / 1000;
const live = (P, fr, lives) => { let n = 0; while (P.lives < lives) { const f = fr[n++ % fr.length]; for (let k = 0; k < K.SUB; k++) K.stepPool(P, f.x, f.y, 0, 0, f.spoon); } return P; };

test('the fluid is SPH: a stiffer fluid keeps nearer its rest density, a thicker one sloshes less after a stir, and it stays in its box', () => {
  const run = (s, stir) => { const F = K.makeFluid(0.5, 0.5); let err = 0, ke = 0; for (let t = 0; t < 600; t++) { const c = K.stepFluid(F, s, 0.5, 0.5, 0, 0, stir && t < 60 ? { x: 0.5, y: 0.5, vx: 3, vy: -2 } : null); if (t >= 100) { err += c.err; ke += c.ke; } } return { err: err / 500, ke: ke / 500, F }; };
  const soft = run({ visc: 0.05, stiff: 0.5, size: 1 }), stiff = run({ visc: 0.05, stiff: 5, size: 1 });
  assert.ok(stiff.err < soft.err * 0.7, 'density error ' + r3(soft.err) + ' soft, ' + r3(stiff.err) + ' stiff');
  const thin = run({ visc: 0.01, stiff: 3, size: 1 }, true), thick = run({ visc: 0.15, stiff: 3, size: 1 }, true);
  assert.ok(thick.ke < thin.ke * 0.5, 'slosh ' + thin.ke + ' thin, ' + thick.ke + ' thick');
  for (const r of [soft, stiff, thin, thick]) assert.ok(Array.from(r.F.x).every((v) => v >= 0 && v <= 1) && Array.from(r.F.y).every((v) => v >= 0 && v <= 1), 'in the box');
  assert.ok(Math.abs(K.restDensity(0.12) - K.restDensity(0.12 * 1.3)) / K.restDensity(0.12) < 0.2, 'rest density barely moves with kernel size');
});

/** the network alone on its own fluid for 600 steps: how its viscosity followed the slosh it sensed (a correlation), and how much any
 *  of its settings moved */
function senses(P, fr, from) {
  const F = K.makeFluid(fr[from].x, fr[from].y), vi = [], sl = [], fixed = P.mode === 'fixed'; let last = null;
  for (let t = 0; t < 600; t++) { const f = fr[(from + Math.floor(t / K.SUB)) % fr.length], s = K.think(P.w, K.senseOf(F, last, f.x, f.y), fixed); vi.push(s.visc); sl.push(last ? last.ke : 0); last = K.stepFluid(F, s, f.x, f.y, 0, 0, f.spoon); }
  const mv = mean(vi), ms = mean(sl); let c = 0, a = 0, d = 0; for (let i = 0; i < vi.length; i++) { c += (vi[i] - mv) * (sl[i] - ms); a += (vi[i] - mv) ** 2; d += (sl[i] - ms) ** 2; }
  return { corr: a > 1e-18 ? c / Math.sqrt(a * d) : 0, spread: Math.sqrt(a / vi.length) };
}

test('the network that senses learns a lower cost than the best constant setting the same search finds, and than random search', () => {
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const fr = frames(seed, 1400), pool = (mode) => live(K.makePool(seed, mode), fr, 300), L = pool('learn'), Fx = pool('fixed'), Bl = pool('blind');
    rows.push({ learn: K.gainOf(L), fixed: K.gainOf(Fx), blind: K.gainOf(Bl), corr: senses(L, fr, 7).corr, still: senses(Fx, fr, 7).spread });
  }
  const say = JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r3(v)]))));
  assert.ok(rows.every((r) => r.learn > r.fixed), 'learned over the best constant setting ' + say);
  assert.ok(rows.every((r) => r.learn > r.blind), 'learned over random search ' + say);
  assert.ok(rows.every((r) => r.learn > 1), 'learned over the starter setting ' + say);
  // it uses its senses: the learned network thickens the fluid when the drop sloshes; the constant setting never moves
  assert.ok(rows.every((r) => r.corr > 0.15 && r.still < 1e-9), 'viscosity follows the slosh ' + say);
});

test('it runs in the brain as one of twenty-two organs: your pointer stirs it, it is kept, and the self says so', () => {
  const b = B.createBrain(7); B.tell(b, 'river stone light');
  for (let t = 0; t < 3000; t++) { const a = t * 0.013; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.45 + 0.3 * Math.sin(a * 1.3), over: true }); }
  assert.ok(B.ORGAN_IDS.includes('pool') && B.ORGAN_IDS.length === 22);
  assert.ok(b.pool.lives >= 8 && b.runs.pool > 150, 'lives ' + b.pool.lives + ' runs ' + b.runs.pool);
  assert.ok(b.board.pool && b.board.pool.lives === b.pool.lives, JSON.stringify(b.board.pool));
  const sp = K.spoonOf(b.senses); assert.ok(sp && Number.isFinite(sp.vx) && Math.hypot(sp.vx, sp.vy) > 0, 'the pointer is a spoon ' + JSON.stringify(sp));
  assert.equal(K.spoonOf({ ...b.senses, over: false }), null, 'no spoon when the pointer is away');
  const self = B.selfSays(b).find((l) => /^Pool:/.test(l)) || '';
  assert.match(self, /^Pool: \d+ lives? of a particle fluid that flows after the focus, whose viscosity, stiffness and kernel size a tiny network sets from what it senses; (not yet enough lives to compare with the starter setting\.|it follows with \d+\.\d times less lag, slosh and crush than the starter setting\.|it does not yet follow with less lag, slosh and crush than the starter setting\.)$/);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), fresh = B.createBrain(99);
  assert.ok(B.loadKnowledge(fresh, k).includes('pool'));
  assert.deepEqual(K.networkOf(fresh.pool), K.networkOf(b.pool));
});

test('the orb shows only while the network beats the starter setting', () => {
  const b = B.createBrain(5); for (let t = 0; t < 60; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: true });
  const orb = (gain) => { b.board.pool = { x: 0.5, y: 0.5, gain, lives: 200, tick: b.ticks }; return B.embodiment(b).some((o) => o.key === 'pool'); };
  assert.equal(orb(1.3), true);
  assert.equal(orb(0.9), false);
  assert.equal(orb(null), false);
});

test('a kept network of the wrong shape or range is refused and changes nothing', () => {
  const a = K.makePool(3), k = JSON.parse(JSON.stringify(K.networkOf(a))), c = K.makePool(4), before = JSON.stringify(K.networkOf(c));
  const bad = [null, {}, { ...k, w: k.w.slice(1) }, { ...k, w: k.w.map(() => 5) }, { ...k, w: k.w.map(() => 'x') }, { ...k, w: k.w.map(() => null) }, { ...k, lives: -1 }, { ...k, lives: 1.5 }, { w: k.w }];
  for (const v of bad) assert.equal(K.loadNetwork(c, v), false, JSON.stringify(v).slice(0, 80));
  assert.equal(JSON.stringify(K.networkOf(c)), before);
  assert.equal(K.loadNetwork(c, k), true);
  assert.deepEqual(K.networkOf(c).w, k.w);
});
