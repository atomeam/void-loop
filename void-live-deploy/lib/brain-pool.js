// brain-pool, Verse Brain's pool: a smoothed-particle fluid that flows after the brain's focus, and a tiny network that sets the fluid's
// own viscosity, stiffness and kernel size from what it senses, from F459 (WebGPU SPH MLP agent mind, atomeam/a-to-mind.com drafts/;
// F184 and F432 are SPH drafts too). Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it". F459's idea: a tiny MLP
// (6 -> 12 -> 3) that reads the motion and the fluid's own density and outputs the parameters of a smoothed particle hydrodynamics (SPH)
// fluid: a causal modulator of the fluid, not a policy that moves the particles. F459's network was random and never learned. Here:
//   1. the fluid: NP particles in a box with walls, SPH as Mueller et al. (2003) wrote it for 2D: density by the poly6 kernel, pressure
//      by the stiffness times the density over the rest density, the pressure force by the spiky kernel's gradient, the viscosity force
//      by the viscosity kernel's Laplacian. The rest density is the density the same kernel gives a still square lattice, so a change of
//      kernel size does not count as a change of density. The viscosity also drags on the still air round the drop (a thick fluid moves
//      slowly), so one setting decides both how fast the drop follows and how fast it calms down.
//   2. the pull and the stir: the brain's focus pulls every particle toward it like a spring (capped), so the fluid flows after the focus
//      and gathers round it as a drop. Your pointer is a spoon: particles near it are dragged along at its speed. Your tilt leans it.
//   3. the cost: each step a fluid pays for its density error (it must not be crushed or torn), for its lag (the drop's centre from the
//      focus) and for its slosh (the kinetic energy inside the drop, not the drop's own travel). A constant setting is a compromise: a
//      thin fluid follows the focus closely but sloshes for long after a stir, a thick one is calm but lags. A network that senses can
//      thicken the fluid while it sloshes and thin it again to follow.
//   4. the network: 6 senses (where the focus is from the drop's centre, the drop's velocity, its slosh and its density error), 12 hidden
//      units, 3 outputs (viscosity, stiffness, kernel size). It starts close to one constant setting (small weights from the senses).
//   5. learning: a life is LIFE steps. Each life PC copies of the fluid run from the same start after the same focus and the same stir,
//      as PC / 2 mirrored pairs of tries (the network plus a small random change, and minus the same change). At the end, the cheaper
//      side of each pair says which way to move the network (an evolution strategy with mirrored sampling). With fixed set the same
//      tries move only the output biases: one constant setting (the best constant setting the same search finds), the control a network
//      that senses is measured against. With blind set it is random search: the best network so far against PC - 1 fresh ones.
//   6. the control in the brain: one more copy of the fluid runs at the starter setting. Its cost over the network's cost is the gain.
//   Once the network beats the starter setting, the drop's centre leaves a little life where it settles (the input layer).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const NP = 30, PC = 6, IN = 6, HID = 12, OUT = 3, LIFE = 120, SUB = 6, EVERY = 6;
export const GENES = HID * IN + HID + OUT * HID + OUT; // 123 numbers a network
// the settings the outputs map to (tanh -1..1 onto these ranges), and the starter setting (the middle of each)
export const RANGE = { visc: [0.002, 0.2], stiff: [0.2, 6], size: [0.75, 1.35] };
const H0 = 0.12, DT = 0.01, PULL = 30, AMAX = 6, DRAG = 150, VMAX = 1.5, WALL = 0.4, WMAX = 4, SPACE = H0 * 0.5, MASS = 1, WD = 1, WS = 2, WK = 20, SPOON = 40, SPOON_R = 0.15;
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const lerp = ([lo, hi], t) => lo + (hi - lo) * (t + 1) / 2;
export const STARTER = { visc: lerp(RANGE.visc, 0), stiff: lerp(RANGE.stiff, 0), size: lerp(RANGE.size, 0) };

// ---- the kernels (2D, Mueller et al. 2003) --------------------------------------------------------------------------------------------
const poly6 = (r2, h) => { const d = h * h - r2; return d > 0 ? (4 / (Math.PI * h ** 8)) * d * d * d : 0; };
// stepFluid inlines the same poly6 with the spiky kernel's gradient, -30 / (pi h^5) (h - r)^2, and the viscosity kernel's Laplacian,
// 40 / (pi h^5) (h - r)
const restCache = new Map();
/** the density a still square lattice of spacing SPACE has under the poly6 kernel of radius h: the fluid's rest density at that size. */
export function restDensity(h) {
  const key = Math.round(h * 1e4); if (restCache.has(key)) return restCache.get(key);
  let s = 0; const n = Math.ceil(h / SPACE);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) s += MASS * poly6((i * SPACE) ** 2 + (j * SPACE) ** 2, h);
  restCache.set(key, s); return s;
}

// ---- the fluid ------------------------------------------------------------------------------------------------------------------------
/** NP particles still, on a square lattice of spacing SPACE centred at (x, y) in 0..1. */
export function makeFluid(x = 0.5, y = 0.5) {
  const F = { x: new Float64Array(NP), y: new Float64Array(NP), vx: new Float64Array(NP), vy: new Float64Array(NP), rho: new Float64Array(NP), ax: new Float64Array(NP), ay: new Float64Array(NP), steps: 0 };
  const side = Math.ceil(Math.sqrt(NP)), x0 = clamp(x, 0.2, 0.8) - (side - 1) * SPACE / 2, y0 = clamp(y, 0.2, 0.8) - (side - 1) * SPACE / 2;
  for (let p = 0; p < NP; p++) { F.x[p] = x0 + (p % side) * SPACE; F.y[p] = y0 + Math.floor(p / side) * SPACE; }
  return F;
}
export const copyFluid = (F) => ({ x: Float64Array.from(F.x), y: Float64Array.from(F.y), vx: Float64Array.from(F.vx), vy: Float64Array.from(F.vy), rho: Float64Array.from(F.rho), ax: new Float64Array(NP), ay: new Float64Array(NP), steps: F.steps });
/** one SPH step at setting s ({ visc, stiff, size }) with the pull toward (tx, ty), and a tilt (gx, gy). Returns the step's cost parts:
 *  density error, lag (the drop's centre from the pull) and slosh (kinetic energy inside the drop). */
export function stepFluid(F, s, tx, ty, gx = 0, gy = 0, spoon = null) {
  const h = H0 * s.size, h2 = h * h, rho0 = restDensity(h), { x, y, vx, vy, rho, ax, ay } = F, pr = F.pr || (F.pr = new Float64Array(NP));
  const k6 = (4 / (Math.PI * h ** 8)) * MASS, kg = (-30 / (Math.PI * h ** 5)) * MASS, kv = (40 / (Math.PI * h ** 5)) * MASS * s.visc, drag = s.visc * DRAG;
  for (let p = 0; p < NP; p++) { let d = 0; for (let q = 0; q < NP; q++) { const r2 = (x[p] - x[q]) ** 2 + (y[p] - y[q]) ** 2; if (r2 < h2) { const e = h2 - r2; d += k6 * e * e * e; } } rho[p] = d; }
  for (let p = 0; p < NP; p++) pr[p] = s.stiff * (rho[p] - rho0); // pressure (it may pull a little where the fluid is thin: surface tension)
  for (let p = 0; p < NP; p++) {
    const dx = tx - x[p], dy = ty - y[p], dd = Math.hypot(dx, dy), pa = Math.min(PULL * dd, AMAX) / Math.max(dd, 1e-9), pp = pr[p], rp = rho[p];
    let fx = pa * dx + gx - drag * vx[p], fy = pa * dy + gy - drag * vy[p];
    if (spoon) { const w = Math.max(0, 1 - Math.hypot(x[p] - spoon.x, y[p] - spoon.y) / SPOON_R); fx += SPOON * w * (spoon.vx - vx[p]); fy += SPOON * w * (spoon.vy - vy[p]); } // your pointer stirs
    for (let q = 0; q < NP; q++) {
      const rx = x[p] - x[q], ry = y[p] - y[q], r2 = rx * rx + ry * ry;
      if (q === p || r2 >= h2 || r2 < 1e-18) continue;
      const r = Math.sqrt(r2), hr = h - r, g = (-((pp + pr[q]) / (2 * rho[q])) * kg * hr * hr) / rp, l = (kv * hr) / (rho[q] * rp);
      fx += (g * rx) / r + l * (vx[q] - vx[p]); fy += (g * ry) / r + l * (vy[q] - vy[p]);
    }
    ax[p] = fx; ay[p] = fy;
  }
  let err = 0, ke = 0, mx = 0, my = 0, cx = 0, cy = 0;
  for (let p = 0; p < NP; p++) {
    vx[p] += ax[p] * DT; vy[p] += ay[p] * DT; const v = Math.hypot(vx[p], vy[p]); if (v > VMAX) { vx[p] *= VMAX / v; vy[p] *= VMAX / v; }
    x[p] += vx[p] * DT; y[p] += vy[p] * DT;
    if (x[p] < 0) { x[p] = -x[p] * WALL; vx[p] = -vx[p] * WALL; } else if (x[p] > 1) { x[p] = 1 - (x[p] - 1) * WALL; vx[p] = -vx[p] * WALL; }
    if (y[p] < 0) { y[p] = -y[p] * WALL; vy[p] = -vy[p] * WALL; } else if (y[p] > 1) { y[p] = 1 - (y[p] - 1) * WALL; vy[p] = -vy[p] * WALL; }
    err += Math.abs(rho[p] / rho0 - 1); cx += x[p]; cy += y[p]; mx += vx[p]; my += vy[p];
  }
  mx /= NP; my /= NP; for (let p = 0; p < NP; p++) ke += (vx[p] - mx) ** 2 + (vy[p] - my) ** 2; // the slosh: motion inside the drop, not the drop's own travel
  F.steps++;
  return { err: err / NP, lag: Math.hypot(tx - cx / NP, ty - cy / NP), ke: ke / NP };
}
/** what a step costs: the density error, the lag and the slosh, weighted. Pure. */
export const costOf = (c) => WD * c.err + WS * c.lag + WK * c.ke;
/** the drop's centre and its numbers. Pure. */
export function dropOf(F) { let cx = 0, cy = 0, vx = 0, vy = 0; for (let p = 0; p < NP; p++) { cx += F.x[p]; cy += F.y[p]; vx += F.vx[p]; vy += F.vy[p]; } return { x: cx / NP, y: cy / NP, vx: vx / NP, vy: vy / NP }; }

// ---- the network ----------------------------------------------------------------------------------------------------------------------
const O = HID * IN + HID + OUT * HID; // where the output biases start
/** what the network says: a setting from its 6 senses. With fixed set only the output biases count (a constant setting). Pure. */
export function think(w, sv, fixed = false) {
  const o = [w[O], w[O + 1], w[O + 2]];
  if (!fixed) for (let h = 0; h < HID; h++) {
    let a = w[HID * IN + h]; for (let k = 0; k < IN; k++) a += w[h * IN + k] * sv[k];
    a = Math.tanh(a); for (let j = 0; j < OUT; j++) o[j] += w[HID * IN + HID + j * HID + h] * a;
  }
  return { visc: lerp(RANGE.visc, Math.tanh(o[0])), stiff: lerp(RANGE.stiff, Math.tanh(o[1])), size: lerp(RANGE.size, Math.tanh(o[2])) };
}
/** the 6 senses of a fluid: where the pull is from the drop's centre, the drop's velocity, its slosh and its density error, the last step's. */
export function senseOf(F, last, tx, ty) {
  const d = dropOf(F);
  return [(tx - d.x) * 4, (ty - d.y) * 4, d.vx * 2, d.vy * 2, last ? Math.sqrt(last.ke) * 10 : 0, last ? (last.err - 0.1) * 5 : 0];
}
/** a random network that starts close to one constant setting: small weights from the senses, any output biases. */
export const fresh = (r) => Float32Array.from({ length: GENES }, (_, k) => (r() - 0.5) * (k < O ? 0.4 : 2));
export const valid = (w) => (Array.isArray(w) || w instanceof Float32Array) && w.length === GENES && Array.from(w).every((v) => Number.isFinite(v) && Math.abs(v) <= WMAX);

// ---- the pool: one network learning from mirrored tries, their fluids, the starter control ------------------------------------------------
const PAIRS = PC / 2, SIGMA = 0.15, STEP = 0.6, MOVE = 0.1;
const gauss = (r) => (r() + r() + r() - 1.5) * 2; // near-normal, -3..3
const first = (mode) => (mode === 'fixed' ? O : 0); // the genes a mode may change (fixed: the output biases only)
const tries = (P) => {
  if (P.mode === 'blind') { P.pop = [P.w, ...Array.from({ length: PC - 1 }, () => fresh(P.r))]; return; }
  P.dirs = []; P.pop = [];
  for (let i = 0; i < PAIRS; i++) {
    const d = new Float32Array(GENES); for (let k = first(P.mode); k < GENES; k++) d[k] = gauss(P.r);
    P.dirs.push(d); P.pop.push(Float32Array.from(P.w, (v, k) => clamp(v + SIGMA * d[k], -WMAX, WMAX)), Float32Array.from(P.w, (v, k) => clamp(v - SIGMA * d[k], -WMAX, WMAX)));
  }
};
/** a new pool. mode: 'learn' (the organ: one network moved by mirrored tries), 'blind' (random search: the best network so far against
 *  PC - 1 fresh ones each life), 'fixed' (the same mirrored tries on the output biases only: one constant setting). */
export function makePool(seed, mode = 'learn') {
  const r = rng(seed * 40503 + 17), w = fresh(r); if (mode === 'fixed') for (let k = 0; k < O; k++) w[k] = 0;
  const P = { w, pop: [], dirs: [], r, mode, fluids: [], ctl: null, cost: new Float64Array(PC), ctlCost: 0, last: new Array(PC).fill(null), set: new Array(PC).fill(STARTER),
    age: 0, lives: 0, since: EVERY - 3, gains: [], costs: [], early: [], tx: 0.5, ty: 0.5, start: [0.5, 0.5], fed: 0, evals: 0 };
  tries(P); startAll(P);
  return P;
}
const startAll = (P) => {
  const base = makeFluid(P.start[0], P.start[1]);
  P.fluids = P.pop.map(() => copyFluid(base)); P.ctl = copyFluid(base); P.cost.fill(0); P.ctlCost = 0; P.last.fill(null); P.age = 0;
};
/** one step of every fluid after the pull at (tx, ty), with a tilt (gx, gy) and your pointer's stir (spoon: { x, y, vx, vy } or null).
 *  Ends a life after LIFE steps; returns its result then. */
export function stepPool(P, tx, ty, gx = 0, gy = 0, spoon = null) {
  P.tx = clamp(tx, 0.05, 0.95); P.ty = clamp(ty, 0.05, 0.95);
  const fixed = P.mode === 'fixed';
  for (let k = 0; k < PC; k++) {
    const s = think(P.pop[k], senseOf(P.fluids[k], P.last[k], P.tx, P.ty), fixed); P.set[k] = s;
    const c = stepFluid(P.fluids[k], s, P.tx, P.ty, gx, gy, spoon); P.last[k] = c; P.cost[k] += costOf(c);
  }
  P.ctlCost += costOf(stepFluid(P.ctl, STARTER, P.tx, P.ty, gx, gy, spoon));
  return ++P.age >= LIFE ? endLife(P) : null;
}
/** the end of a life. Learning: each mirrored pair met the same life, so the cheaper side of each pair says which way to move the network
 *  (the difference of the two costs over the starter's cost, times the direction). Random search: a fresh network that cost less than the
 *  best so far on this life takes its place. The network's cost on the life (the mean of the pairs, or the best so far's) over the
 *  starter's cost is kept as the gain. */
export function endLife(P) {
  const ctl = P.ctlCost / LIFE, c = Array.from(P.cost, (v) => v / LIFE);
  let held;
  if (P.mode === 'blind') {
    held = c[0]; let best = 0; for (let k = 1; k < PC; k++) if (c[k] < c[best]) best = k;
    if (best) P.w = P.pop[best];
  } else {
    held = c.reduce((a, v) => a + v, 0) / PC;
    const g = new Float32Array(GENES);
    for (let i = 0; i < PAIRS; i++) { const f = (c[2 * i + 1] - c[2 * i]) / Math.max(ctl, 1e-9); for (let k = first(P.mode); k < GENES; k++) g[k] += f * P.dirs[i][k]; }
    let big = 0; for (let k = first(P.mode); k < GENES; k++) big = Math.max(big, Math.abs((STEP * g[k]) / PAIRS));
    const cut = big > MOVE ? MOVE / big : 1; // no gene moves more than MOVE in one life, so one odd life cannot throw the network far
    for (let k = first(P.mode); k < GENES; k++) P.w[k] = clamp(P.w[k] + (cut * STEP * g[k]) / PAIRS, -WMAX, WMAX);
  }
  P.evals += PC; P.lives++;
  const gain = held > 1e-9 ? ctl / held : 1;
  P.gains.push(gain); if (P.gains.length > 50) P.gains.shift();
  P.costs.push(held); if (P.costs.length > 50) P.costs.shift(); if (P.early.length < 10) P.early.push(held);
  const d = dropOf(P.fluids[0]); P.start = [d.x, d.y]; // the next life starts where this one's drop ended
  P.lastLife = { gain: r3(gain), cost: r3(held), control: r3(ctl) };
  tries(P); startAll(P);
  return P.lastLife;
}
/** the mean gain over the last (up to 50) lives: the starter setting's cost over the network's. Pure. */
export const gainOf = (P) => (P.gains.length ? mean(P.gains) : null);
/** the network as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const networkOf = (P) => ({ w: Array.from(P.w, r3), lives: P.lives });
/** load a kept network; anything that is not GENES numbers in the weight range and a whole count of lives is refused and changes nothing.
 *  Returns true when loaded. */
export function loadNetwork(P, k) {
  if (!k || !valid(k.w) || !(Number.isInteger(k.lives) && k.lives >= 0)) return false;
  P.w = Float32Array.from(k.w); P.lives = k.lives; tries(P); startAll(P);
  return true;
}
/** the pool's numbers for the self. Pure. */
export function poolOf(P) {
  const g = gainOf(P), s = P.set[0] || STARTER, c = mean(P.costs);
  return { lives: P.lives, gain: g == null ? null : r3(g), cost: c == null ? null : r3(c), visc: r3(s.visc), stiff: r3(s.stiff), size: r3(s.size), evals: P.evals, fed: P.fed };
}

/** your pointer as a spoon: where it is and how fast it moved over the last EVERY ticks (one organ run, SUB fluid steps), or null when it
 *  is not over the brain. Pure on the senses. */
export function spoonOf(S) {
  const tr = S.trail; if (!S.over || tr.length < 2) return null;
  const p = tr[tr.length - 1], q = tr[Math.max(0, tr.length - 1 - EVERY)], n = Math.min(EVERY, tr.length - 1) / EVERY, t = SUB * DT * n;
  return { x: p[0], y: p[1], vx: (p[0] - q[0]) / t, vy: (p[1] - q[1]) / t };
}

export const pool = {
  id: 'pool', name: 'Pool', job: 'a smoothed-particle fluid that flows after the focus, with tiny networks that set its viscosity, stiffness and kernel size from what they sense',
  want: (b) => (b.pool.since >= EVERY ? 0.45 : 0.02),
  run(b) {
    const P = b.pool; // P.since counts ticks in stepBrain (lib/brain.js)
    if (P.since < EVERY) return 0;
    P.since = 0;
    const S = b.senses, f = S.feat, gx = (f[4] || 0) * 0.5, gy = (f[5] || 0) * 0.5, spoon = spoonOf(S); let life = null; // your tilt leans the pool
    for (let n = 0; n < SUB; n++) { const r = stepPool(P, b.focus.x, b.focus.y, gx, gy, spoon); if (r) life = r; }
    const d = dropOf(P.fluids[0]);
    if (life && gainOf(P) > 1) { deposit(b.ws, 'input', d.x, d.y, 0.04, 1, 'pool'); P.fed++; }
    b.board.pool = { x: d.x, y: d.y, gain: gainOf(P), life: !!life, lives: P.lives, tick: b.ticks };
    return 1;
  }
};
