// field-nca — Verse's neural cellular automata and living lattices, one pure law module for Grok's NCA/lattice drafts (asked by the
// owner, 2026-10-18: "all of groks builds should be what v01ds engine is built on"). Each draft's law is a named VARIANT here, on one
// state shape, so one card (skills/nca-mind.js on lib/field-stage.js) runs them all and one mind (evolveNca, in a Worker through
// lib/field-worker.js or on the page) evolves them all:
//   growing       F-036 + F-039: a multichannel NCA in the manner of Mordvintsev et al., "Growing Neural Cellular Automata" (Distill,
//                 2020): 4 channels (life + 3 hidden), identity + Sobel perception, one shared tiny MLP gives a residual update,
//                 a stochastic update mask and alive masking. The pointer seeds life; the mind evolves the MLP's 156 weights.
//   mlp           F-036 as drafted: one channel in [-1,1], 3x3 neighbours + pointer offset -> 8 ReLU -> 1 tanh, a 0.15 step, 0.98 decay.
//   multichannel  F-039: activator / inhibitor / catalyst lattice in cyclic competition (spirals); the mind evolves diffusion and rates.
//   gray-scott    F-043 (webgpu-compute-nca-pointer-mind): Gray-Scott with the draft's 9-point Laplacian; the mind evolves feed and kill.
//   portal        F-045: a 12-gene neighbour-average NCA with a sigmoid, seeded noise and a tilt bias; hotspots become portals
//                 (portalsOf) that a tap reinforces (a fitness bonus for the rule in use).
//   residual      F-043 (predictive-residual-lattice): an evolved 5-gene linear predictor of the pointer's next move; its surprise
//                 (residual) widens the lattice's diffusion and its confidence feeds the growth.
// Every variant: create(seed, variant) -> state, step(s, dt, input), metrics(s) -> { entropy, activity, consensus, cx, cy } in 0..1,
// paint(s, rgba) for the card, and evolveNca(arg) for the mind (synchronous, deterministic for its inputs). No DOM, no clock, no
// Math.random (the state carries its own seeded generator as one integer). Grids are capped at MAX_W x MAX_H.
import { rng, clamp, entropy, stats, randomGenome, evolveStep } from './field-kit.js';

export const MAX_W = 64, MAX_H = 48, POP = 6, MIND_EVERY = 2;
export const DEFAULT = 'growing';

// ---- the state's own random numbers (mulberry32 on an integer kept in the state, so the state stays plain data) ----------------------
function rnd(s) { s.rs = (s.rs + 0x6D2B79F5) >>> 0; let t = s.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

// ---- small helpers -------------------------------------------------------------------------------------------------------------------
const wrap = (v, n) => (v < 0 ? v + n : v >= n ? v - n : v);
const weightSpec = (n, lim = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['w' + i, [-lim, lim]]));
/** an hsl colour (h degrees, s and l 0..1) as [r, g, b] 0..255. Pure. */
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = t < 0 ? t + 1 : t > 1 ? t - 1 : t; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
/** put a soft disc of `amt` into channel c of s.x around (x, y) in 0..1, radius rad cells; lo..hi bound the channel. */
export function seedAt(s, x, y, amt, rad = 2, c = 0, lo = 0, hi = 1) {
  const cx = Math.round(clamp(x, 0, 1) * (s.W - 1)), cy = Math.round(clamp(y, 0, 1) * (s.H - 1));
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const d2 = dx * dx + dy * dy; if (d2 > rad * rad) continue;
    const gx = cx + dx, gy = cy + dy; if (gx < 0 || gy < 0 || gx >= s.W || gy >= s.H) continue;
    const i = (gy * s.W + gx) * s.C + c; s.x[i] = clamp(s.x[i] + amt * (1 - d2 / (rad * rad + 1)), lo, hi);
  }
}

// ---- the tiny MLPs (F-036, and the growing NCA built from it) ------------------------------------------------------------------------
const MLP_IN = 11, MLP_HID = 8; // F-036: 8 neighbours + self + pointer dx, dy -> 8 ReLU -> 1
const G_C = 4, G_IN = G_C * 3 + 2, G_HID = 8; // growing: 4 channels x (identity, Sobel x, Sobel y) + pointer dx, dy -> 8 ReLU -> 4
// the growing NCA's starter rule: the 156 weights the same mind found offline (20 generations of 12 rules, scored on 400-step runs
// from seeds 5 and 11), as the paper ships trained weights. A random rule mostly dies out or fills the lattice; this one lives.
export const STARTER = [-0.298,0.513,0.144,0.038,-0.225,-0.259,-0.288,0.418,-0.114,-0.109,0.104,0.529,-0.099,0.425,0.3,0.412,-0.589,-0.063,-0.325,-0.488,0.523,-0.218,0.015,-0.413,-0.528,-0.264,0.567,0.215,0.259,0.437,0.484,0.015,0.401,0.126,0.947,0.158,-0.171,0.313,-0.324,-0.23,-0.115,-0.355,0.039,-0.855,-0.273,-0.363,0.125,0.063,0.478,0.52,0.167,-0.567,1,0.065,0.569,0.328,0.084,-0.53,-0.115,0.087,0.298,-0.211,-0.5,0.243,-0.521,0.088,0.321,0.22,0.204,-0.149,0.341,-0.33,0.572,0.178,0.886,-0.26,0.653,0.465,-0.363,0.242,-0.201,0.572,-0.196,0.688,-0.77,-0.177,0.31,0.262,0.43,0.082,-0.248,0.063,0.598,-0.011,-0.154,-0.05,-0.484,0.353,-0.27,0.33,-1,-0.47,-0.11,-0.099,-0.154,-0.09,-0.08,-0.414,-0.051,-0.136,0.323,0.348,-0.544,0.077,-0.149,0.381,-0.147,-0.023,-0.277,0.235,-0.919,-0.619,-0.468,0.414,-0.349,0.133,-0.299,1,-0.127,0.198,0.294,0.359,0.363,-0.249,0.255,-0.216,-0.747,0.98,0.289,0.088,-0.438,-0.078,-0.785,-0.332,-0.239,-0.42,0.577,0.462,-0.489,-0.123,0.01,0.064,0.282,-0.448,-0.126,0.052];
const CROWD = 0.03, G_B1 = G_IN * G_HID, G_W2 = G_B1 + G_HID, G_B2 = G_W2 + G_HID * G_C, G_LEN = G_B2 + G_C;

// ---- the variants ----------------------------------------------------------------------------------------------------------------------
// each: { id, fid, title, W, H, C, lo, hi (channel bounds), spec (genome ranges), base(r) (the starting genome), init(s, r), law(s, input),
// view(s, out) (the 0..1 scalar the metrics read), colour(s, i) -> [r,g,b], actGain, trial (mind replay steps) }
export const VARIANTS = {
  growing: {
    id: 'growing', fid: 'F-036 + F-039', title: 'Growing NCA', sub: 'a multichannel neural cellular automaton', W: 48, H: 36, C: G_C, lo: -1, hi: 1,
    spec: weightSpec(G_LEN), base: () => Object.fromEntries(STARTER.map((v, i) => ['w' + i, v])),
    init(s, r) { for (let n = 0; n < 3; n++) growSeed(s, 0.2 + r() * 0.6, 0.2 + r() * 0.6); },
    law: stepGrowing, actGain: 30, trial: 12,
    view(s, out) { for (let i = 0; i < s.W * s.H; i++) out[i] = clamp(s.x[i * G_C], 0, 1); },
    colour(s, i) { const x = s.x, k = i * G_C, a = clamp(x[k], 0, 1); return [12 + a * (110 + x[k + 1] * 120), 8 + a * (90 + x[k + 2] * 110), 26 + a * (150 + x[k + 3] * 100)]; }
  },
  mlp: {
    id: 'mlp', fid: 'F-036', title: 'Evolving NCA (F-036)', sub: 'one tiny MLP is every cell\'s rule', W: 60, H: 40, C: 1, lo: -1, hi: 1,
    spec: weightSpec(MLP_IN * MLP_HID + MLP_HID), base: (r) => Object.fromEntries(Array.from({ length: MLP_IN * MLP_HID + MLP_HID }, (_, i) => ['w' + i, (r() - 0.5) * 0.8])),
    init(s, r) { for (let i = 0; i < s.x.length; i++) s.x[i] = (r() - 0.5) * 0.4; },
    law: stepMlp, actGain: 20, trial: 20,
    view(s, out) { for (let i = 0; i < s.W * s.H; i++) out[i] = (s.x[i] + 1) / 2; },
    colour(s, i) { const v = s.x[i]; return hsl(200 + v * 80, 0.7, 0.3 + Math.abs(v) * 0.4); }
  },
  multichannel: {
    id: 'multichannel', fid: 'F-039', title: 'Multichannel lattice (F-039)', sub: 'activator, inhibitor, catalyst', W: 64, H: 40, C: 3, lo: 0, hi: 1,
    spec: { da: [0.1, 0.6], db: [0.1, 0.6], dc: [0.1, 0.6], ra: [0.05, 0.3], rb: [0.05, 0.3], rc: [0.05, 0.3], fa: [0.2, 0.9], fb: [1.2, 2.4] },
    base: () => ({ da: 0.3, db: 0.3, dc: 0.3, ra: 0.2, rb: 0.2, rc: 0.2, fa: 0.5, fb: 1.8 }),
    init(s, r) { for (let i = 0; i < s.x.length; i++) s.x[i] = r() * 0.2; for (let n = 0; n < 6; n++) seedAt(s, r(), r(), 0.8, 3, n % 3); },
    law: stepMulti, actGain: 60, trial: 24,
    view(s, out) { for (let i = 0; i < s.W * s.H; i++) out[i] = s.x[i * 3]; },
    colour(s, i) { const k = i * 3; return [s.x[k] * 255, s.x[k + 1] * 255, s.x[k + 2] * 255]; }
  },
  'gray-scott': {
    id: 'gray-scott', fid: 'F-043', title: 'Gray-Scott pointer mind (F-043)', sub: 'the mind evolves feed and kill', W: 64, H: 48, C: 2, lo: 0, hi: 1,
    spec: { F: [0.01, 0.1], K: [0.03, 0.08] }, base: () => ({ F: 0.037, K: 0.06 }),
    init(s, r) { for (let i = 0; i < s.W * s.H; i++) s.x[i * 2] = 1; gsSeed(s, 0.5, 0.5); for (let n = 0; n < 5; n++) gsSeed(s, r(), r()); },
    law: stepGrayScott, actGain: 200, trial: 30,
    view(s, out) { for (let i = 0; i < s.W * s.H; i++) out[i] = clamp(s.x[i * 2 + 1] * 2, 0, 1); },
    colour(s, i) { const v = Math.min(255, s.x[i * 2 + 1] * 510); return [v, v * 0.6, 255 - v]; }
  },
  portal: {
    id: 'portal', fid: 'F-045', title: 'NCA portal mind (F-045)', sub: 'hotspots open portals; tap one to keep its rule', W: 64, H: 40, C: 1, lo: 0, hi: 1,
    spec: { ...Object.fromEntries(['diff', 'grow', 'decay', 'thresh', 'n1', 'n2', 'n3', 'n4', 'biasX', 'biasY', 'noise'].map((k) => [k, [0, 1]])), act: [0.55, 1] }, // act below 0.5 inverts the sigmoid: a field that flashes every step
    // the draft's fixed genes (0.6, 0.4, 0.3, 0.5 ... 0.7) give a flat field; this start is the best of 60 random rules on 400-step runs
    base: () => ({ diff: 0.044, grow: 0.309, decay: 0.643, thresh: 0.268, n1: 0.765, n2: 0.111, n3: 0.366, n4: 0.27, biasX: 0.854, biasY: 0.343, noise: 0.679, act: 0.941 }),
    init(s, r) { for (let i = 0; i < s.x.length; i++) if (r() < 0.05) s.x[i] = r() * 0.4; },
    law: stepPortal, actGain: 15, trial: 24,
    view(s, out) { out.set(s.x); },
    colour(s, i) { const v = s.x[i]; return v < 0.05 ? [0, 0, 0] : hsl(200 + v * 160, 0.8, 0.2 + v * 0.5); }
  },
  residual: {
    id: 'residual', fid: 'F-043', title: 'Predictive residual lattice (F-043)', sub: 'it grows when it can guess your next move', W: 64, H: 40, C: 1, lo: 0, hi: 1,
    spec: { bias: [-1, 1], vx: [-1, 1.5], vy: [-1, 1], ax: [-1, 1], ay: [-1, 1] }, base: () => ({ bias: 0, vx: 0.8, vy: 0, ax: 0.2, ay: 0 }), // the draft's starting genes
    init(s, r) { for (let n = 0; n < 6; n++) seedAt(s, r(), r(), 0.6, 3, 0); s.hist = []; s.res = 0.5; s.pred = null; },
    law: stepResidual, actGain: 60, trial: 0,
    view(s, out) { out.set(s.x); },
    colour(s, i) { const v = s.x[i], c = 1 - (s.res ?? 0.5); return [v * 40 + 6, v * 120 + c * 80 * v + 6, v * 180 + 16]; }
  }
};
export const VARIANT_IDS = Object.keys(VARIANTS);
const V = (id) => VARIANTS[id] || VARIANTS[DEFAULT];

// ---- state ---------------------------------------------------------------------------------------------------------------------------
/** a new lattice for a variant from a seed: the same seed gives the same field. */
export function create(seed = 1, variant = DEFAULT) {
  const v = V(variant), r = rng(seed), s = { variant: v.id, fid: v.fid, seed, W: v.W, H: v.H, C: v.C, x: new Float32Array(v.W * v.H * v.C), rs: (seed * 2654435761) >>> 0, t: 0, act: 0, gen: 0, fit: 0, px: 0.5, py: 0.5, touched: 0, bonus: 0 };
  setGenome(s, v.base(r)); v.init(s, r); s.view = new Float32Array(v.W * v.H); v.view(s, s.view); return s;
}
/** a lattice from a snapshot (the mind's replay): the same numbers, its own generator from the seed. */
export function restore(variant, x, genome, seed = 1, extra = {}) {
  const v = V(variant), s = { variant: v.id, fid: v.fid, seed, W: v.W, H: v.H, C: v.C, x: Float32Array.from(x), rs: (seed * 2654435761) >>> 0, t: 0, act: 0, px: 0.5, py: 0.5, touched: 0, bonus: 0, hist: [], res: 0.5, ...extra };
  setGenome(s, genome); s.view = new Float32Array(v.W * v.H); v.view(s, s.view); return s;
}
/** set a genome, clamped into its variant's ranges (a bad genome cannot leave them). */
export function setGenome(s, g) {
  const spec = V(s.variant).spec; s.genome = Object.fromEntries(Object.entries(spec).map(([k, [lo, hi]]) => [k, clamp(Number.isFinite(+(g && g[k])) ? +g[k] : (lo + hi) / 2, lo, hi)]));
  s.w = s.variant === 'growing' || s.variant === 'mlp' ? Float32Array.from(Object.values(s.genome)) : null;
}

/** one step: input { x, y (0..1), over, down, tiltX, tiltY }. The pointer seeds the field; the variant's law moves it. */
export function step(s, dt = 1 / 60, input = {}) {
  const v = V(s.variant);
  if (input.over || input.down) { s.px = clamp(+input.x || 0, 0, 1); s.py = clamp(+input.y || 0, 0, 1); s.touched = 30; } else if (s.touched > 0) s.touched--;
  v.law(s, input);
  // activity is the change over TWO steps: a field that flickers back and forth each step (a flashing card) scores none for it
  const back = s.view2 || s.view, now = new Float32Array(s.view.length); v.view(s, now); let moved = 0;
  for (let i = 0; i < now.length; i++) moved += Math.abs(now[i] - back[i]);
  s.view2 = s.view; s.view = now; s.act = s.act * 0.9 + (moved / now.length) * 0.1; s.t += dt; s.n = (s.n || 0) + 1;
  if (s.n % 30 === 0) revive(s);
}
/** a lattice that has died out (no life anywhere) gets one seeded spark, the drafts' "reseed periodically". */
export function revive(s) {
  if (s.variant === 'mlp' || s.variant === 'residual') return false;
  let m = 0; for (let i = 0; i < s.view.length; i++) m += s.view[i];
  if (m / s.view.length > 0.002) return false;
  const x = 0.15 + rnd(s) * 0.7, y = 0.15 + rnd(s) * 0.7;
  if (s.variant === 'growing') growSeed(s, x, y); else if (s.variant === 'gray-scott') gsSeed(s, x, y); else seedAt(s, x, y, 0.8, 3, 0);
  V(s.variant).view(s, s.view); return true;
}

// ---- growing: the multichannel NCA (F-036's MLP rule on F-039's channels, Mordvintsev's perception and masks) -------------------------
function growSeed(s, x, y) { const cx = Math.round(x * (s.W - 1)), cy = Math.round(y * (s.H - 1)); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const gx = wrap(cx + dx, s.W), gy = wrap(cy + dy, s.H), k = (gy * s.W + gx) * G_C; s.x[k] = 1; s.x[k + 1] = 0.5; s.x[k + 2] = -0.3; s.x[k + 3] = 0.8; } }
function stepGrowing(s, input) {
  const { W, H, x, w } = s, n = W * H, out = new Float32Array(x.length), inp = new Float32Array(G_IN), hid = new Float32Array(G_HID);
  if (input.down) growSeed(s, s.px, s.py); else if (input.over) seedAt(s, s.px, s.py, 0.12, 1, 0, -1, 1);
  const pxi = s.px * (W - 1), pyi = s.py * (H - 1);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx, k = i * G_C;
    // alive masking: a cell with no life in its 3x3 neighbourhood is empty (before and after the update)
    let alive = 0, crowd = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x[(wrap(y + dy, H) * W + wrap(xx + dx, W)) * G_C]; crowd += a; if (a > alive) alive = a; }
    if (alive < 0.1) { continue; }
    // a crowded cell loses life (CROWD x the square of its neighbourhood's mean) and hidden channels leak a little: without these a
    // random rule grows until it fills the lattice and freezes (the paper trains toward a target shape instead)
    crowd /= 9; out[k] = clamp(x[k] - CROWD * crowd * crowd, 0, 1); for (let c = 1; c < G_C; c++) out[k + c] = x[k + c] * 0.995;
    if (rnd(s) > 0.5) continue; // the stochastic update mask: half the cells change in a step, so no global clock is needed
    for (let c = 0; c < G_C; c++) { // perception: identity, Sobel x, Sobel y per channel
      const at = (dx, dy) => x[(wrap(y + dy, H) * W + wrap(xx + dx, W)) * G_C + c];
      inp[c * 3] = at(0, 0);
      inp[c * 3 + 1] = ((at(1, -1) + 2 * at(1, 0) + at(1, 1)) - (at(-1, -1) + 2 * at(-1, 0) + at(-1, 1))) / 8;
      inp[c * 3 + 2] = ((at(-1, 1) + 2 * at(0, 1) + at(1, 1)) - (at(-1, -1) + 2 * at(0, -1) + at(1, -1))) / 8;
    }
    inp[12] = (xx - pxi) / W; inp[13] = (y - pyi) / H;
    // weights: W1 (G_IN x G_HID), b1 (G_HID), W2 (G_HID x G_C), b2 (G_C)
    for (let j = 0; j < G_HID; j++) { let t = w[G_B1 + j]; for (let q = 0; q < G_IN; q++) t += inp[q] * w[j * G_IN + q]; hid[j] = t > 0 ? t : 0; }
    for (let c = 0; c < G_C; c++) { let o = w[G_B2 + c]; for (let j = 0; j < G_HID; j++) o += hid[j] * w[G_W2 + c * G_HID + j]; out[k + c] = clamp(out[k + c] + Math.tanh(o) * 0.1 - (c === 0 ? 0.004 : 0), c === 0 ? 0 : -1, 1); }
  }
  for (let i = 0; i < n; i++) { // alive masking after the update too
    let alive = 0; const y = (i / W) | 0, xx = i - y * W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = out[(wrap(y + dy, H) * W + wrap(xx + dx, W)) * G_C]; if (a > alive) alive = a; }
    if (alive < 0.1) for (let c = 0; c < G_C; c++) out[i * G_C + c] = 0;
  }
  s.x = out;
}

// ---- mlp: F-036 as drafted ------------------------------------------------------------------------------------------------------------
function stepMlp(s, input) {
  const { W, H, x, w } = s, out = new Float32Array(x.length), inp = new Float32Array(MLP_IN), pxi = Math.floor(s.px * W), pyi = Math.floor(s.py * H), poke = input.over || input.down;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx; let k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) inp[k++] = x[wrap(y + dy, H) * W + wrap(xx + dx, W)];
    inp[9] = (xx - pxi) / W; inp[10] = (y - pyi) / H;
    let p = 0, o = 0;
    for (let j = 0; j < MLP_HID; j++) { let t = 0; for (let q = 0; q < MLP_IN; q++) t += inp[q] * w[p++]; o += (t > 0 ? t : 0) * w[MLP_IN * MLP_HID + j]; }
    let v = x[i] + Math.tanh(o * 0.5) * 0.15;
    if (poke) { const d2 = (xx - pxi) ** 2 + (y - pyi) ** 2; if (d2 < 9) v += 0.08 * (1 - d2 / 9); }
    out[i] = clamp(v * 0.98, -1, 1);
  }
  s.x = out;
}

// ---- multichannel: F-039 -----------------------------------------------------------------------------------------------------------------
// The draft's law (logistic growth with no decay, and a Laplacian missing the centre's -4) fills every channel to 1 within a few
// hundred steps: a flat sheet. Its three channels, genes (three diffusions, three rates, two couplings) and cross-channel fitness are
// kept, and the reaction is the cyclic competition that best keeps three species moving in space: May-Leonard, as in Reichenbach,
// Mobilia and Frey, "Mobility promotes and jeopardizes biodiversity in rock-paper-scissors games" (Nature, 2007): spirals.
// activator beats inhibitor, inhibitor beats catalyst, catalyst beats activator; fa is the weak coupling, fb the strong one.
function stepMulti(s, input) {
  const { W, H, x } = s, g = s.genome, out = new Float32Array(x.length), D = [g.da, g.db, g.dc], R = [g.ra, g.rb, g.rc];
  if (input.down) seedAt(s, s.px, s.py, 0.5, 2, 0); else if (input.over) seedAt(s, s.px, s.py, 0.08, 1, 2);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 3;
    for (let c = 0; c < 3; c++) {
      const u = x[i + c], next = x[i + (c + 1) % 3], prev = x[i + (c + 2) % 3];
      const lap = x[(y * W + wrap(xx + 1, W)) * 3 + c] + x[(y * W + wrap(xx - 1, W)) * 3 + c] + x[(wrap(y + 1, H) * W + xx) * 3 + c] + x[(wrap(y - 1, H) * W + xx) * 3 + c] - 4 * u;
      out[i + c] = clamp(u + D[c] * 0.25 * lap + R[c] * u * (1 - u - g.fa * next - g.fb * prev) + 0.0005, 0, 1);
    }
  }
  s.x = out;
}
/** F-039's cross-channel number: |covariance of activator and inhibitor| scaled to 0..1. Pure. */
export function crossOf(s) {
  if (s.C < 2) return 0; const n = s.W * s.H; let ma = 0, mb = 0, ab = 0;
  for (let i = 0; i < n; i++) { const a = s.x[i * s.C], b = s.x[i * s.C + 1]; ma += a; mb += b; ab += a * b; }
  ma /= n; mb /= n; return clamp(Math.abs(ab / n - ma * mb) * 8, 0, 1);
}

// ---- gray-scott: F-043 compute-NCA pointer mind --------------------------------------------------------------------------------------
function gsSeed(s, x, y) { const cx = Math.round(x * (s.W - 1)), cy = Math.round(y * (s.H - 1)), r = 3; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) { const k = (wrap(cy + dy, s.H) * s.W + wrap(cx + dx, s.W)) * 2; s.x[k] = 0.5; s.x[k + 1] = 1; } }
function stepGrayScott(s, input) {
  const { W, H, x } = s, { F, K } = s.genome, out = new Float32Array(x.length), Du = 0.16, Dv = 0.08;
  if (input.down) { gsSeed(s, s.px, s.py); s.seeds = (s.seeds || 0) + 1; }
  const lap = (xx, y, c) => { const xm = wrap(xx - 1, W), xp = wrap(xx + 1, W), ym = wrap(y - 1, H), yp = wrap(y + 1, H), g = (X, Y) => x[(Y * W + X) * 2 + c];
    return g(xm, y) + g(xp, y) + g(xx, ym) + g(xx, yp) + 0.5 * (g(xm, ym) + g(xp, ym) + g(xm, yp) + g(xp, yp)) - 6 * g(xx, y); };
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const k = (y * W + xx) * 2, a = x[k], b = x[k + 1], abb = a * b * b;
    out[k] = clamp(a + Du * lap(xx, y, 0) - abb + F * (1 - a), 0, 1);
    out[k + 1] = clamp(b + Dv * lap(xx, y, 1) + abb - (K + F) * b, 0, 1);
  }
  s.x = out;
}

// ---- portal: F-045 -------------------------------------------------------------------------------------------------------------------
function stepPortal(s, input) {
  const { W, H, x } = s, g = s.genome, out = new Float32Array(x.length), m = (k) => (g[k] - 0.5) * 2;
  const diff = m('diff'), grow = m('grow'), decay = m('decay'), thresh = m('thresh'), biasX = m('biasX'), biasY = m('biasY'), noise = m('noise'), act = m('act');
  const nw = [m('n1'), m('n2'), m('n3'), m('n4')].map((v) => 1 + v * 0.5); // n1..n4 (unused in the draft) weigh the four sides of the neighbourhood
  const tx = +input.tiltX || 0, ty = +input.tiltY || 0;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx; let sum = 0, wt = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const q = dy < 0 ? nw[0] : dy > 0 ? nw[1] : dx < 0 ? nw[2] : nw[3]; sum += x[wrap(y + dy, H) * W + wrap(xx + dx, W)] * q; wt += q; }
    const avg = sum / wt;
    let v = x[i] * (1 + decay * 0.1) + avg * diff * 0.3 + grow * 0.05 * Math.max(0, avg - thresh);
    v += (biasX * tx + biasY * ty) * 0.02 + (rnd(s) - 0.5) * noise * 0.05;
    out[i] = clamp(1 / (1 + Math.exp(-act * 4 * (v - 0.4))), 0, 1);
  }
  if (input.over || input.down) { const px = Math.floor(s.px * W), py = Math.floor(s.py * H); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = px + dx, ny = py + dy, d = Math.hypot(dx, dy); if (nx >= 0 && nx < W && ny >= 0 && ny < H && d < 3.5) out[ny * W + nx] = Math.min(1, out[ny * W + nx] + 0.3 * (1 - d / 3.5)); } }
  s.x = out;
}
/** F-045's portals: up to `max` hotspots above `thresh`, the brightest first, at least `gap` cells apart: [{ x, y (0..1), energy }]. Pure. */
export function portalsOf(s, max = 5, thresh = 0.55, gap = 8) {
  const v = s.view, cand = []; for (let i = 0; i < v.length; i++) if (v[i] > thresh) cand.push(i);
  cand.sort((a, b) => v[b] - v[a] || a - b); const out = [];
  for (const i of cand) { const x = i % s.W, y = (i / s.W) | 0; if (out.some((p) => Math.hypot(p.gx - x, p.gy - y) < gap)) continue; out.push({ gx: x, gy: y }); if (out.length >= max) break; }
  return out.map((p) => ({ x: +(p.gx / (s.W - 1)).toFixed(3), y: +(p.gy / (s.H - 1)).toFixed(3), energy: +v[p.gy * s.W + p.gx].toFixed(3) }));
}
/** a tapped portal reinforces the rule in use: the mind adds this to its fitness (capped). */
export function reinforce(s, amt = 0.15) { s.bonus = Math.min(0.6, (s.bonus || 0) + amt); return s.bonus; }

// ---- residual: F-043 predictive residual lattice -----------------------------------------------------------------------------------------
/** the predictor's guess of the next move from the velocity (vx, vy) and acceleration (ax, ay): [dx, dy]. F-043's draft form. Pure. */
export function predict(g, vx, vy, ax = 0, ay = 0) { return [g.bias * 0.01 + g.vx * vx + g.vy * vy + g.ax * ax + g.ay * ay, g.bias * 0.001 + g.vx * vy + g.vy * vx + g.ax * ay + g.ay * ax]; }
/** how wrong a predictor is over a pointer history [{x,y}...]: mean error over mean move, 0 (perfect) .. 1 (no better than standing still, or worse). Pure. */
export function residualOf(g, hist) {
  if (!hist || hist.length < 4) return 0.5; let err = 0, mag = 0, n = 0;
  for (let t = 3; t < hist.length; t++) {
    const vx = hist[t - 1].x - hist[t - 2].x, vy = hist[t - 1].y - hist[t - 2].y, ax = vx - (hist[t - 2].x - hist[t - 3].x), ay = vy - (hist[t - 2].y - hist[t - 3].y);
    const [px, py] = predict(g, vx, vy, ax, ay), dx = hist[t].x - hist[t - 1].x, dy = hist[t].y - hist[t - 1].y;
    err += Math.hypot(dx - px, dy - py); mag += Math.hypot(dx, dy); n++;
  }
  return clamp(err / (mag + 1e-3 * n), 0, 1);
}
export const HIST = 12;
// The draft's lattice only grew (logistic growth, no decay) and filled the screen; here a 0.08 decay means it grows only while the
// predictor is confident (conf above about 0.4) and fades while it is surprised, so the field shows how well the mind knows you.
function stepResidual(s, input) {
  const { W, H, x } = s;
  if (input.over || input.down) {
    const h = s.hist || (s.hist = []), last = h[h.length - 1];
    if (!last || last.x !== s.px || last.y !== s.py) { h.push({ x: s.px, y: s.py }); if (h.length > HIST) h.shift(); }
    const i = Math.floor(s.py * (H - 1)) * W + Math.floor(s.px * (W - 1)); x[i] = Math.min(1, x[i] + 0.4);
    s.res = s.res * 0.8 + residualOf(s.genome, h) * 0.2;
  } else s.res = s.res * 0.995 + 0.5 * 0.005;
  const h = s.hist || [];
  if (h.length >= 3) { const a = h[h.length - 1], b = h[h.length - 2], c = h[h.length - 3], [dx, dy] = predict(s.genome, a.x - b.x, a.y - b.y, (a.x - b.x) - (b.x - c.x), (a.y - b.y) - (b.y - c.y)); s.pred = { x: clamp(a.x + dx * 6, 0, 1), y: clamp(a.y + dy * 6, 0, 1) }; }
  const conf = 1 - s.res, diff = 0.18 + s.res * 0.15, react = 0.05 + conf * 0.08, out = new Float32Array(x.length);
  for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) {
    const i = y * W + xx, n = (x[i - 1] + x[i + 1] + x[i - W] + x[i + W]) * 0.25, f = x[i];
    out[i] = clamp(f + diff * (n - f) + react * f * (1 - f) - 0.08 * f * (1 - conf), 0, 1);
  }
  s.x = out;
}

// ---- the numbers --------------------------------------------------------------------------------------------------------------------------
/** the field's numbers, each 0..1: entropy (how varied the visible channel is), activity (how much it moves), consensus (how much more
 *  the field answers around the pointer than elsewhere; 0.5 = no difference), cx/cy (where its energy sits); plus cross (F-039's
 *  cross-channel coupling) and residual (F-043's surprise) where they mean something. Pure. */
export function metrics(s) {
  const v = s.view, W = s.W, H = s.H, st = stats(v); let mx = 0, my = 0, m = 0, around = 0, an = 0;
  const pcx = s.px * (W - 1), pcy = s.py * (H - 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = v[y * W + x]; mx += w * x; my += w * y; m += w; if ((x - pcx) ** 2 + (y - pcy) ** 2 <= 25) { around += w; an++; } }
  const out = { entropy: entropy(v, 16), activity: clamp(s.act * V(s.variant).actGain, 0, 1), consensus: clamp(0.5 + ((an ? around / an : st.mean) - st.mean) * 2, 0, 1), cx: m ? mx / m / (W - 1) : 0.5, cy: m ? my / m / (H - 1) : 0.5 };
  if (s.C >= 2) out.cross = crossOf(s);
  if (s.variant === 'residual') out.residual = clamp(s.res ?? 0.5, 0, 1);
  return out;
}
/** what the mind rewards: a varied lattice that keeps moving and answers where it is touched (no flat sheet, no white noise). Pure. */
export const fitness = (m) => 0.45 * m.entropy + 0.35 * m.activity + 0.2 * m.consensus + 0.1 * (m.cross || 0);

/** the card's picture: fills rgba (W*H*4) from the lattice. Pure on its inputs. */
export function paint(s, rgba) {
  const v = V(s.variant); for (let i = 0; i < s.W * s.H; i++) { const c = v.colour(s, i); rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255; }
  return rgba;
}
/** the settings a seal keeps (facts only: the variant and its rounded genome, never the pointer's path). Pure. */
export function params(s) {
  const g = s.genome, keys = Object.keys(g);
  if (s.w) { let n2 = 0; for (const k of keys) n2 += g[k] * g[k]; return { variant: s.variant, fid: s.fid, weights: keys.length, norm: Math.round(Math.sqrt(n2) * 1000) / 1000, gen: s.gen || 0 }; }
  return { variant: s.variant, fid: s.fid, genome: Object.fromEntries(keys.map((k) => [k, Math.round(g[k] * 10000) / 10000])), gen: s.gen || 0 };
}

// ---- the mind ------------------------------------------------------------------------------------------------------------------------------
/** one generation, for a Worker or the page: replay `trial` steps of each genome from the same snapshot (the residual variant scores its
 *  predictors on the pointer's recent moves instead) and breed the next population, elites kept. The rule in use (arg.current) is always
 *  in the population and gets arg.bonus (a tapped portal). arg { variant, x, seed, gen, pop, current, bonus, px, py, pointer, hist }
 *  -> { pop, best, fitness, gen }. Synchronous and deterministic for its inputs. */
export function evolveNca(arg = {}) {
  const v = V(arg.variant), r = rng((arg.seed || 1) * 7919 + (arg.gen || 0)), spec = v.spec;
  let pop = (arg.pop && arg.pop.length ? arg.pop : Array.from({ length: POP }, (_, i) => (i === 0 ? v.base(rng(arg.seed || 1)) : randomGenome(spec, r)))).map((g) => { const t = { variant: v.id }; setGenome(t, g); return t.genome; });
  let cur = -1;
  if (arg.current) { const t = { variant: v.id }; setGenome(t, arg.current); const key = JSON.stringify(t.genome); cur = pop.findIndex((g) => JSON.stringify(g) === key); if (cur < 0) { pop[pop.length - 1] = t.genome; cur = pop.length - 1; } }
  const fits = pop.map((g, i) => {
    let f;
    if (v.id === 'residual') f = 1 - residualOf(g, arg.hist || []);
    else {
      const s = restore(v.id, arg.x, g, arg.seed || 1), input = { x: arg.px ?? 0.5, y: arg.py ?? 0.5, over: !!arg.pointer };
      s.px = input.x; s.py = input.y; for (let t = 0; t < v.trial; t++) step(s, 1 / 60, input);
      f = fitness(metrics(s));
    }
    return f + (i === cur ? Math.min(0.6, +arg.bonus || 0) : 0);
  });
  let bi = 0; fits.forEach((f, i) => { if (f > fits[bi]) bi = i; });
  return { pop: evolveStep(pop, fits, spec, r, { elite: 2, rate: v.id === 'growing' || v.id === 'mlp' ? 0.08 : 0.3, sigma: 0.12 }), best: pop[bi], fitness: fits[bi], gen: (arg.gen || 0) + 1 };
}

/** which variant an ask names (`fallback`, the card's default, when it names none). Pure. */
export function variantOf(text, fallback = DEFAULT) {
  const t = String(text || '').toLowerCase();
  if (/portal|f-?045/.test(t)) return 'portal';
  if (/predict|residual/.test(t)) return 'residual';
  if (/gray[- ]?scott|reaction[- ]diffusion|f-?043/.test(t)) return 'gray-scott';
  if (/multi-?channel|activator|inhibitor|f-?039/.test(t)) return 'multichannel';
  if (/\bmlp\b|f-?036|evolving nca|local nca/.test(t)) return 'mlp';
  if (/growing/.test(t)) return 'growing';
  return fallback;
}
