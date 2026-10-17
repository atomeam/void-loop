import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/lib/field-flow.js';
import { spawnMind, mindSource } from '../void-live-deploy/lib/field-worker.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';

test('sampleField: exact at a cell centre, bilinear between centres, wraps at the edges', () => {
  const f = F.makeField(); f.u[0] = 1; f.u[1] = 3; f.v[0] = -2;
  const c0 = F.sampleField(f, 0.5 / F.G, 0.5 / F.G), c1 = F.sampleField(f, 1.5 / F.G, 0.5 / F.G), mid = F.sampleField(f, 1 / F.G, 0.5 / F.G);
  assert.deepEqual([c0[0], c0[1]], [1, -2]); assert.equal(c1[0], 3); assert.ok(Math.abs(mid[0] - 2) < 1e-6);
  const w = F.sampleField(f, 1 + 0.5 / F.G, 0.5 / F.G); assert.equal(w[0], 1); // x = 1.03 is x = 0.03
  const left = F.sampleField(f, 0, 0.5 / F.G); assert.ok(Math.abs(left[0] - 0.5 * (1 + f.u[F.G - 1])) < 1e-6); // between cell 15 and cell 0
});

test('advection: Euler moves along the vector; RK2 follows a turning field better than Euler; positions stay in the unit square', () => {
  const f = F.makeField(); f.u.fill(0.2); f.v.fill(-0.1);
  const e = F.advectOne(f, 0.5, 0.5, 0.5, 'euler'); assert.ok(Math.abs(e[0] - 0.6) < 1e-6 && Math.abs(e[1] - 0.45) < 1e-6);
  const w = F.advectOne(f, 0.95, 0.02, 1, 'euler'); assert.ok(w[0] >= 0 && w[0] < 1 && w[1] >= 0 && w[1] < 1);
  // a rigid rotation about the centre: the exact radius is kept best by RK2
  const r = F.makeField(); for (let j = 0; j < F.G; j++) for (let i = 0; i < F.G; i++) { r.u[j * F.G + i] = -((j + 0.5) / F.G - 0.5) * 2; r.v[j * F.G + i] = ((i + 0.5) / F.G - 0.5) * 2; }
  const drift = (m) => { let x = 0.8, y = 0.5; const o = [0, 0, 0, 0]; for (let i = 0; i < 40; i++) { F.advectOne(r, x, y, 0.1, m, o); x = o[0]; y = o[1]; } return Math.abs(Math.hypot(x - 0.5, y - 0.5) - 0.3); };
  assert.ok(drift('rk2') < drift('euler'));
  const p = { n: 3, x: Float32Array.of(0.1, 0.5, 0.9), y: Float32Array.of(0.1, 0.5, 0.9), vx: new Float32Array(3), vy: new Float32Array(3) };
  F.advect(p, f, 0.1, 3, 'rk2'); assert.ok(Math.abs(p.x[1] - 0.52) < 1e-5 && p.vx[2] > 0.19);
});

test('swirl: tangential, zero at the centre, decays; edits are clamped; compose adds the three', () => {
  const sw = F.injectSwirl(F.makeField(), 0.5, 0.5, 1, 0.14), i = 12 * F.G + 8; // right of centre: counter-clockwise means v > 0 below... check the sign by geometry
  const cx = 8, cy = 8, a = (cy * F.G + cx), dx = (cx + 0.5) / F.G - 0.5, dy = (cy + 0.5) / F.G - 0.5;
  assert.ok(Math.abs(sw.u[a] * dx + sw.v[a] * dy) < 1e-9); // perpendicular to the radius
  assert.ok(Math.hypot(sw.u[i], sw.v[i]) > 0);
  F.decaySwirl(sw, 0.5); assert.ok(Math.abs(sw.u[i]) < 0.51 * Math.abs(F.injectSwirl(F.makeField(), 0.5, 0.5, 1, 0.14).u[i]));
  const ed = F.makeField(); for (let k = 0; k < 50; k++) F.paintEdit(ed, 0.5, 0.5, 1, 0, 0.1, 0.5); assert.ok(Math.max(...ed.u) <= 0.7 + 1e-6 && F.editedCells(ed) > 3);
  const tot = F.composeField(F.makeField(), F.baseField(F.START), ed, sw, [0.01, 0]); assert.ok(Math.abs(tot.u[a] - (F.baseField(F.START).u[a] + ed.u[a] + sw.u[a] + 0.01)) < 1e-6);
});

test('composeField: an empty or broken wind adds nothing and never makes NaN', () => {
  for (const wind of [[], [NaN], [undefined, Infinity], [0.5], null]) { const t = F.composeField(F.makeField(), F.baseField(F.START), F.makeField(), F.makeField(), wind); assert.ok(Array.from(t.u).every(Number.isFinite) && Array.from(t.v).every(Number.isFinite)); }
  assert.ok(Math.abs(F.composeField(F.makeField(), F.makeField(), F.makeField(), F.makeField(), [0.5]).u[0] - 0.5) < 1e-6);
});

test('scoreFlow: seeded, a field that goes nowhere scores low, the pointer bonus appears only with a pointer', () => {
  const a = F.scoreFlow(F.START, null, 5), b = F.scoreFlow(F.START, null, 5);
  assert.deepEqual(a, b);
  const still = F.scoreFlow({ mag: 0.0001, dir: 0, freq: 1 }, null, 5); assert.ok(still.fitness < 0.05 && a.fitness > still.fitness);
  assert.equal(a.bonus, 0); const p = F.scoreFlow(F.START, null, 5, { x: 0.5, y: 0.5 }); assert.ok(p.bonus > 0 && p.fitness > 0 && p.fitness <= 1);
});

test('evolveFlow: seeded; never gets worse; stays inside the spec; improves a poor start over a few rounds', () => {
  const msg = { params: { mag: 0.06, dir: 0, freq: 0.5 }, seed: 11, cands: 4, gen: 0 };
  assert.deepEqual(F.evolveFlow(msg), F.evolveFlow(msg));
  let params = msg.params, fit = F.scoreFlow(params, null, 11).fitness, up = 0;
  for (let g = 0; g < 8; g++) { const r = F.evolveFlow({ params, seed: 11, cands: 4, gen: g }); assert.ok(r.fitness >= r.prev - 1e-9); assert.equal(r.gen, g + 1); params = r.params; if (r.improved) up++; }
  for (const [k, [lo, hi]] of Object.entries(F.SPEC)) assert.ok(params[k] >= lo && params[k] <= hi);
  assert.ok(up >= 1 && F.scoreFlow(params, null, 11).fitness > fit);
});

test('stepFlow: a seeded card moves the same way twice, the pointer swirl bends the tracers, the mind\'s answer is adopted smoothly, ink sets the count', () => {
  const run = (over) => { const s = F.createFlow(3); for (let i = 0; i < 30; i++) F.stepFlow(s, 1 / 60, over ? { over: true, down: true, x: 0.5, y: 0.5 } : {}); return s; };
  const a = run(false), b = run(false), c = run(true);
  assert.deepEqual(Array.from(a.p.x.slice(0, 20)), Array.from(b.p.x.slice(0, 20)));
  assert.notDeepEqual(Array.from(a.p.x.slice(0, 20)), Array.from(c.p.x.slice(0, 20)));
  const m = F.metricsFlow(a); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy']) assert.ok(m[k] >= 0 && m[k] <= 1, k);
  F.adoptMind(a, { params: { mag: 0.4, dir: 3, freq: 2 }, gen: 4, fitness: 0.7, improved: true }); const before = a.shown.mag; F.stepFlow(a, 1 / 60); assert.ok(a.shown.mag > before && a.shown.mag < 0.4 && a.gen === 4);
  assert.equal(F.activeCount(0), F.MIN_N); assert.equal(F.activeCount(1), F.MAX_N); assert.ok(F.MAX_N <= 700);
});

test('flow metrics: a swarm moving one way agrees (consensus 1), one moving every way does not; inkShape stretches with speed', () => {
  const n = 8, one = { x: new Float32Array(n).fill(0.5), y: new Float32Array(n).fill(0.5), vx: new Float32Array(n).fill(0.3), vy: new Float32Array(n) };
  assert.ok(F.flowMetrics(one, n).consensus > 0.99);
  const all = { ...one, vx: Float32Array.from({ length: n }, (_, i) => Math.cos(i * Math.PI / 4) * 0.3), vy: Float32Array.from({ length: n }, (_, i) => Math.sin(i * Math.PI / 4) * 0.3) };
  assert.ok(F.flowMetrics(all, n).consensus < 0.05);
  const slow = F.inkShape(0, 0), fast = F.inkShape(0, 0.45); assert.ok(fast.w > slow.w * 2 && fast.h < slow.h && fast.rot === 90 && slow.radius === '50% 50% 50% 50%' && /^\d+% \d+% \d+% \d+%$/.test(fast.radius));
  assert.ok(F.inkShape(5, 5).speed === 1);
});

test('field-worker: with no Worker it answers on the main thread; the worker source imports the one module; a throwing local is a rejection', async () => {
  assert.match(mindSource('https://a.test/lib/field-flow.js'), /^import \* as M from "https:\/\/a\.test\/lib\/field-flow\.js";/);
  const m = spawnMind('/lib/field-flow.js', 'evolveFlow', F.evolveFlow); assert.equal(m.mode, 'main');
  const r = await m.call({ params: F.START, seed: 2, cands: 2 }); assert.ok(r.fitness > 0 && r.gen === 1);
  await assert.rejects(spawnMind('/x.js', 'f', () => { throw new Error('nope'); }).call(1), /nope/); m.close();
});
