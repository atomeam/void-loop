// brain-current, Verse Brain's current: a lattice-Boltzmann flow your drag stirs, and swimmers whose controllers evolve to ride it to the
// tissue's life, from F447 (WebGPU LBM evolved swimmers mind, atomeam/a-to-mind.com drafts/). Owner, 2026-10-29: "combine all the builds
// into one entity", "dont fake it". F447's idea: a lattice Boltzmann fluid (streaming and collision of particle populations on a grid,
// not particles and not a blur) with swimmers whose tiny neural controllers sense the flow and are evolved for the food they reach. F447's
// own page blurred a density grid and called it LBM. Here the flow is a real D2Q9 lattice Boltzmann solver:
//   1. the fluid: 9 populations a cell on an NX x NY periodic grid, BGK collision (relaxation time TAU) and streaming. Forces enter by
//      the velocity shift (Shan and Chen): a steady Kolmogorov force (a sine of the height) keeps a shear flow going, your drag pushes
//      the fluid where you move, and each swimmer pushes back on the fluid against its own thrust.
//   2. the food: the tissue's life, NX x NY. Each swimmer grazes its own copy: a cell it ate from gives it less for a while, so a
//      swimmer that stays put starves and a swimmer that finds fresh life eats.
//   3. the swimmers: SW swimmers, each a tiny network (5 senses: the flow here, the slope of the food, the food here; HID hidden units;
//      2 outputs: thrust). A swimmer moves with the flow plus VMAX x its thrust.
//   4. the control: SW drifters start each life where the swimmers start and only ride the flow. Each grazes its own copy of the food by
//      the same rule, so the one difference is the thrust: what the swimmers gather over what the drifters gather is what swimming
//      adds.
//   5. evolution: a life is LIFE fluid steps. At its end each swimmer's food is folded into its score, and KIDS children (mutated or
//      crossed from tournament winners) take the places of the lowest scores. With blind set every child is a fresh random network
//      (random search), the control evolution is measured against.
//   The best swimmers leave a little life where they swim (the input layer), so the current carries life through the field.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const NX = 32, NY = 24, Q = 9, SW = 8, IN = 5, HID = 6, KIDS = 3, LIFE = 96, SUB = 4, EVERY = 6;
export const GENES = HID * IN + HID + 2 * HID + 2; // 50 numbers a swimmer
const TAU = 0.62, KOLM = 6e-5, VMAX = 0.12, PUSH = 0.004, REACT = 0.0006, UMAX = 0.12, GRAZE = 0.06, REGROW = 0.985, WMAX = 4, KEEP = 0.5;
const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1], EY = [0, 0, 1, 0, -1, 1, 1, -1, -1], W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const CELLS = NX * NY, r3 = (v) => Math.round(v * 1000) / 1000;
const at = (x, y) => (((Math.floor(y) % NY) + NY) % NY) * NX + (((Math.floor(x) % NX) + NX) % NX);

// ---- the fluid ------------------------------------------------------------------------------------------------------------------------
/** a still fluid of density 1. */
export function makeFluid() {
  const f = new Float32Array(CELLS * Q); for (let c = 0; c < CELLS; c++) for (let i = 0; i < Q; i++) f[c * Q + i] = W[i];
  return { f, g: new Float32Array(CELLS * Q), rho: new Float32Array(CELLS).fill(1), ux: new Float32Array(CELLS), uy: new Float32Array(CELLS), fx: new Float32Array(CELLS), fy: new Float32Array(CELLS), steps: 0 };
}
/** one lattice-Boltzmann step with the forces in fl.fx, fl.fy: moments, BGK collision toward the equilibrium at the shifted velocity, then
 *  streaming (periodic). fl.ux, fl.uy end as the physical velocity (u + F / 2 rho). The forces are spent. */
export function stepFluid(fl) {
  const { f, g, rho, ux, uy, fx, fy } = fl, om = 1 / TAU;
  for (let y = 0; y < NY; y++) {
    const fk = KOLM * Math.sin((2 * Math.PI * (y + 0.5)) / NY);
    for (let x = 0; x < NX; x++) {
      const c = y * NX + x, o = c * Q; let p = 0, mx = 0, my = 0;
      for (let i = 0; i < Q; i++) { const v = f[o + i]; p += v; mx += v * EX[i]; my += v * EY[i]; }
      p = Math.max(p, 1e-6); const Fx = fx[c] + fk, Fy = fy[c];
      let vx = mx / p + (TAU * Fx) / p, vy = my / p + (TAU * Fy) / p; const s = Math.hypot(vx, vy); if (s > UMAX) { vx *= UMAX / s; vy *= UMAX / s; }
      const uu = 1.5 * (vx * vx + vy * vy);
      for (let i = 0; i < Q; i++) { const eu = 3 * (EX[i] * vx + EY[i] * vy); f[o + i] += om * (W[i] * p * (1 + eu + 0.5 * eu * eu - uu) - f[o + i]); }
      rho[c] = p; ux[c] = mx / p + Fx / (2 * p); uy[c] = my / p + Fy / (2 * p); fx[c] = 0; fy[c] = 0;
    }
  }
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const c = y * NX + x; for (let i = 0; i < Q; i++) g[at(x + EX[i], y + EY[i]) * Q + i] = f[c * Q + i]; }
  fl.f = g; fl.g = f; fl.steps++;
  return fl;
}
/** the fluid's mass and momentum, for the conservation test. Pure. */
export function moments(fl) { let m = 0, px = 0, py = 0; for (let c = 0; c < CELLS; c++) for (let i = 0; i < Q; i++) { const v = fl.f[c * Q + i]; m += v; px += v * EX[i]; py += v * EY[i]; } return { mass: m, px, py }; }
/** a soft push of the fluid at (x, y) in 0..1, by (dx, dy) in field units. */
export function push(fl, x, y, dx, dy) {
  const cx = x * NX, cy = y * NY;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const w = Math.exp(-(i * i + j * j) / 2), c = at(cx + i, cy + j); fl.fx[c] += dx * NX * PUSH * w; fl.fy[c] += dy * NY * PUSH * w; }
}

// ---- the swimmers ---------------------------------------------------------------------------------------------------------------------
/** what a swimmer's network says: thrust in -1..1 from its 5 senses. Pure. */
export function think(w, s) {
  let o0 = w[HID * IN + HID + 2 * HID], o1 = w[HID * IN + HID + 2 * HID + 1];
  for (let h = 0; h < HID; h++) {
    let a = w[HID * IN + h]; for (let k = 0; k < IN; k++) a += w[h * IN + k] * s[k];
    a = Math.tanh(a); o0 += w[HID * IN + HID + h] * a; o1 += w[HID * IN + HID + HID + h] * a;
  }
  return [Math.tanh(o0), Math.tanh(o1)];
}
/** a random network. */
export const fresh = (r) => Float32Array.from({ length: GENES }, () => (r() - 0.5) * 2);
/** a child: some genes nudged. */
export function mutate(w, r) { const c = Float32Array.from(w); for (let k = 0; k < GENES; k++) if (r() < 0.2) c[k] = clamp(c[k] + (r() - 0.5) * 0.8, -WMAX, WMAX); return c; }
/** a child of two: each hidden unit (its weights in and out) from one parent or the other. */
export function cross(a, b, r) {
  const c = Float32Array.from(a);
  for (let h = 0; h < HID; h++) if (r() < 0.5) {
    for (let k = 0; k < IN; k++) c[h * IN + k] = b[h * IN + k];
    c[HID * IN + h] = b[HID * IN + h]; c[HID * IN + HID + h] = b[HID * IN + HID + h]; c[HID * IN + 2 * HID + h] = b[HID * IN + 2 * HID + h];
  }
  return c;
}
/** is this a swimmer's network: GENES finite numbers within the weight range. Pure. */
export const valid = (w) => (Array.isArray(w) || w instanceof Float32Array) && w.length === GENES && Array.from(w).every((v) => Number.isFinite(v) && Math.abs(v) <= WMAX);

const sense = (C, k, food, x, y, out) => {
  const fl = C.fluid, c = at(x, y), here = food[c] * (1 - C.grazed[k * CELLS + c]);
  out[0] = fl.ux[c] * 10; out[1] = fl.uy[c] * 10;
  out[2] = (food[at(x + 1, y)] - food[at(x - 1, y)]) * 2; out[3] = (food[at(x, y + 1)] - food[at(x, y - 1)]) * 2; out[4] = here;
  return c;
};
const wrap = (v, n) => ((v % n) + n) % n;
const startAll = (C) => {
  for (let k = 0; k < SW; k++) { const x = C.r() * NX, y = C.r() * NY; C.sx[k] = x; C.sy[k] = y; C.dx[k] = x; C.dy[k] = y; C.ate[k] = 0; C.drift[k] = 0; }
  C.grazed.fill(0); C.dgrazed.fill(0); C.age = 0;
};
/** a new current: a still fluid, SW random swimmers, none scored yet. With blind set its children are all fresh networks (random search). */
export function makeCurrent(seed, blind = false) {
  const r = rng(seed * 61657 + 53), pop = [];
  while (pop.length < SW) pop.push(fresh(r));
  const C = { fluid: makeFluid(), pop, score: new Array(SW).fill(null), r, blind, grazed: new Float32Array(SW * CELLS), dgrazed: new Float32Array(SW * CELLS), sx: new Float32Array(SW), sy: new Float32Array(SW), tx: new Float32Array(SW), ty: new Float32Array(SW),
    dx: new Float32Array(SW), dy: new Float32Array(SW), ate: new Float32Array(SW), drift: new Float32Array(SW), age: 0, lives: 0, champ: 0, since: EVERY - 3, gains: [], foods: [], early: [], last: null, evals: 0, fed: 0 };
  startAll(C);
  return C;
}
/** one fluid step and one swimmer step on a food grid (NX x NY, 0..1). Ends a life after LIFE steps. Returns the life's result when one
 *  ended, else null. */
export function stepCurrent(C, food) {
  const fl = C.fluid, s = [0, 0, 0, 0, 0];
  for (let k = 0; k < SW; k++) {
    const c = sense(C, k, food, C.sx[k], C.sy[k], s), t = think(C.pop[k], s); C.tx[k] = t[0]; C.ty[k] = t[1];
    fl.fx[c] -= t[0] * REACT; fl.fy[c] -= t[1] * REACT; // the swimmer pushes the fluid back
    C.ate[k] += s[4]; C.grazed[k * CELLS + c] = Math.min(1, C.grazed[k * CELLS + c] + GRAZE);
    const d = at(C.dx[k], C.dy[k]); const dk = k * CELLS + d; C.drift[k] += food[d] * (1 - C.dgrazed[dk]); C.dgrazed[dk] = Math.min(1, C.dgrazed[dk] + GRAZE); // the drifter grazes its own copy
  }
  stepFluid(fl);
  for (let k = 0; k < SW; k++) {
    const c = at(C.sx[k], C.sy[k]); C.sx[k] = wrap(C.sx[k] + fl.ux[c] + VMAX * C.tx[k], NX); C.sy[k] = wrap(C.sy[k] + fl.uy[c] + VMAX * C.ty[k], NY);
    const d = at(C.dx[k], C.dy[k]); C.dx[k] = wrap(C.dx[k] + fl.ux[d], NX); C.dy[k] = wrap(C.dy[k] + fl.uy[d], NY);
  }
  for (let c = 0; c < SW * CELLS; c++) { C.grazed[c] *= REGROW; C.dgrazed[c] *= REGROW; }
  return ++C.age >= LIFE ? endLife(C) : null;
}
const tour = (C) => { let w = Math.floor(C.r() * SW); for (let k = 0; k < 2; k++) { const c = Math.floor(C.r() * SW); if ((C.score[c] ?? -1) > (C.score[w] ?? -1)) w = c; } return w; }; // a tournament of 3
/** the end of a life: scores folded, the gain over drifting kept, KIDS children in the places of the lowest scores, all start again. */
export function endLife(C) {
  let sw = 0, dr = 0;
  for (let k = 0; k < SW; k++) { const f = C.ate[k] / LIFE; C.score[k] = C.score[k] == null ? f : KEEP * C.score[k] + (1 - KEEP) * f; sw += C.ate[k]; dr += C.drift[k]; }
  C.evals += SW; C.lives++;
  const gain = dr > 1e-6 ? sw / dr : sw > 0 ? 2 : 1;
  C.gains.push(gain); if (C.gains.length > 50) C.gains.shift();
  let champ = 0; for (let k = 1; k < SW; k++) if (C.score[k] > C.score[champ]) champ = k;
  C.champ = champ;
  const order = [...Array(SW).keys()].filter((k) => k !== champ).sort((p, q) => C.score[p] - C.score[q]);
  for (let n = 0; n < KIDS; n++) {
    const w = order[n], r = C.r;
    C.pop[w] = C.blind || n === 0 && r() < 0.3 ? fresh(r) : r() < 0.3 ? cross(C.pop[tour(C)], C.pop[tour(C)], r) : mutate(C.pop[tour(C)], r);
    C.score[w] = null;
  }
  const food = sw / (SW * LIFE);
  C.foods.push(food); if (C.foods.length > 50) C.foods.shift(); if (C.early.length < 10) C.early.push(food);
  C.last = { gain: r3(gain), food: r3(food), drift: r3(dr / (SW * LIFE)) };
  startAll(C);
  return C.last;
}
/** the mean gain over the last (up to 50) lives: how many times the drifters' food the swimmers gathered. The drifters ride the flow the
 *  swimmers stir, so this says what thrust adds in that flow; whether evolution adds anything is measured against random search in
 *  tools/brain-current.test.mjs. Pure. */
export const gainOf = (C) => (C.gains.length ? C.gains.reduce((a, v) => a + v, 0) / C.gains.length : null);
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
/** how much more the swimmers gather now (the last 50 lives) than in their first 10 lives: a ratio, null before 20 lives. Pure. */
export const growthOf = (C) => (C.lives >= 20 && mean(C.early) > 1e-6 ? mean(C.foods) / mean(C.early) : null);
/** the tissue's life as food on the current's grid (each cell the mean of the 2 x 2 tissue cells under it), 0..1. Pure on b. */
export function foodOf(b) {
  const A = b.ws.layers.act, GW = 64, food = new Float32Array(CELLS);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = 2 * y * GW + 2 * x; food[y * NX + x] = clamp((A[i] + A[i + 1] + A[i + GW] + A[i + GW + 1]) * 0.6, 0, 1); }
  return food;
}
/** the networks as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const swimmersOf = (C) => ({ pop: C.pop.map((w) => Array.from(w, r3)), champ: C.champ, lives: C.lives });
/** load kept networks; anything that is not SW valid networks is refused and changes nothing. Returns true when loaded. */
export function loadSwimmers(C, k) {
  if (!k || !Array.isArray(k.pop) || k.pop.length !== SW || !k.pop.every(valid) || !Number.isInteger(k.champ) || k.champ < 0 || k.champ >= SW || !(Number.isInteger(k.lives) && k.lives >= 0)) return false;
  C.pop = k.pop.map((w) => Float32Array.from(w)); C.champ = k.champ; C.lives = k.lives; C.score.fill(null);
  return true;
}
/** the current's numbers for the self. Pure. */
export function currentOf(C) {
  const g = gainOf(C); let ke = 0; const fl = C.fluid; for (let c = 0; c < CELLS; c++) ke += fl.ux[c] * fl.ux[c] + fl.uy[c] * fl.uy[c];
  const gr = growthOf(C), fm = mean(C.foods);
  return { lives: C.lives, gain: g == null ? null : r3(g), growth: gr == null ? null : r3(gr), food: fm == null ? null : r3(fm), drift: C.last ? C.last.drift : null, flow: r3(Math.sqrt(ke / CELLS)), steps: fl.steps, evals: C.evals, fed: C.fed };
}

export const current = {
  id: 'current', name: 'Current', job: 'a lattice-Boltzmann flow your drag stirs, with swimmers whose tiny networks evolve to ride it to the tissue\'s life, and leave life where they swim',
  want: (b) => (b.current.since >= EVERY ? 0.45 : 0.02),
  run(b) {
    const C = b.current; // C.since counts ticks in stepBrain (lib/brain.js)
    if (C.since < EVERY) return 0;
    C.since = 0;
    const S = b.senses, tr = S.trail; // your drag: the pointer's last move pushes the fluid
    if (S.over && tr.length >= 2) { const p = tr[tr.length - 1], q = tr[tr.length - 2]; push(C.fluid, p[0], p[1], p[0] - q[0], p[1] - q[1]); }
    const food = foodOf(b); let life = null;
    for (let n = 0; n < SUB; n++) { const r = stepCurrent(C, food); if (r) life = r; }
    // the two swimmers with the most food this life leave a small drop of life where they swim, every 4th run, once swimming pays
    if (C.age % (SUB * 4) < SUB && gainOf(C) > 1) {
      const best = [...Array(SW).keys()].sort((p, q) => C.ate[q] - C.ate[p]).slice(0, 2);
      for (const k of best) { deposit(b.ws, 'input', C.sx[k] / NX, C.sy[k] / NY, 0.04, 1, 'current'); C.fed++; }
    }
    const k = C.champ;
    b.board.current = { x: C.sx[k] / NX, y: C.sy[k] / NY, gain: gainOf(C), life: !!life, lives: C.lives, tick: b.ticks };
    return 1;
  }
};
