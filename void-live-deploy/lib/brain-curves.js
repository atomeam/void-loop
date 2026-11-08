// brain-curves, Verse Brain's curves: a Kolmogorov-Arnold network (KAN) whose edges are learned spline curves, guessing the visitor's next
// step, from the KAN draft (atomeam/a-to-mind.com drafts/F610-webgpu-kan-spline-dom-manifold-mind). Owner, 2026-10-29: "combine all the
// builds into one entity", "dont fake it". The draft's idea as written: a tiny KAN whose univariate spline activations are the mind, and
// whose knots the pointer's residual can nudge. The draft measured nothing against another learner. Here:
//   1. the input: each tick of the pointer over the brain gives the last step v (the velocity, scaled by VEL and clamped to -1..1) and the
//      position p (moved to -1..1). The target is the next step (lib/brain.js stepBrain calls curvesTick each tick, run or not).
//   2. the network: a KAN of shape [4, 3, 2]. Each edge is a curve: a linear spline on GK equal pieces of -1..1 (GK + 1 knots) plus a
//      linear term; a unit sums its edges, then tanh. The output is a change to "the same step again": the guess is v plus the output, so a
//      network that learned nothing guesses the same step again.
//   3. the baselines, trained on the same frames with the same rate and the same change-to-v target: "the same step again" itself, a tanh
//      network of the same shape [4, 3, 2], and a tanh network with as many numbers as the KAN ([4, H, 2]).
//   4. the test: one frame in HOLD never trains a learner; its squared error goes to a window of the last TEST held-out frames of each.
//   5. the gain is the best baseline's mean error over the KAN's. Only while the gain is over 1 does the KAN's guess show on the brain and
//      leave a little life in the input layer.
//   Measured (tools/brain-curves.test.mjs, 5 visitors, 3 seeds, 3000 ticks): see that file's header. In short, it beats no baseline on
//   any of them, so it stays quiet; it says so in numbers.
// The pointer stays on the visitor's device: only the curves' knots are kept, in the brain's own knowledge (lib/brain-mind.js).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const GK = 8, NB = GK + 1, VEL = 25, LR = 0.05, HOLD = 5, TEST = 300, MIN_HELD = 100, SHAPE = [4, 3, 2];
export const KAN_NUMBERS = SHAPE.slice(1).reduce((a, b, l) => a + SHAPE[l] * b * (NB + 1), 0); // 180
export const H = Math.round((KAN_NUMBERS - 2) / 7); // a [4, H, 2] network has 7H + 2 numbers: as many as the KAN
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
const mean = (v) => (v && v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v, n) => { arr.push(v); if (arr.length > n) arr.shift(); };
/** where x falls on the spline: the piece and the share of the way along it. Pure. */
const piece = (x) => { const u = ((clamp(x, -1, 1) + 1) / 2) * GK, i = Math.min(GK - 1, Math.floor(u)); return [i, u - i]; };

// ---- the KAN --------------------------------------------------------------------------------------------------------------------------
export function makeKan(r) {
  const L = [];
  for (let l = 0; l + 1 < SHAPE.length; l++) { const a = SHAPE[l], b = SHAPE[l + 1]; L.push({ a, b, c: Float64Array.from({ length: a * b * NB }, () => (r() - 0.5) * 0.1), w: Float64Array.from({ length: a * b }, () => (r() - 0.5) * 0.5) }); }
  return L;
}
/** the KAN's output for x, with what a training step needs. Pure. */
export function kanForward(K, x) {
  const acts = [x], at = []; let h = x;
  for (const L of K) {
    const out = new Float64Array(L.b), here = [];
    for (let i = 0; i < L.a; i++) { const [k, f] = piece(h[i]); here.push([k, f]); for (let j = 0; j < L.b; j++) { const e = i * L.b + j, o = e * NB; out[j] += L.c[o + k] * (1 - f) + L.c[o + k + 1] * f + L.w[e] * h[i]; } }
    at.push(here); h = Array.from(out, Math.tanh); acts.push(h);
  }
  return { y: h, acts, at };
}
/** one gradient step of squared error toward target t. Pure on K. */
export function kanTrain(K, x, t, lr = LR) {
  const { y, acts, at } = kanForward(K, x); let g = y.map((v, j) => (v - t[j]) * (1 - v * v));
  for (let l = K.length - 1; l >= 0; l--) {
    const L = K[l], h = acts[l], gin = new Float64Array(L.a);
    for (let i = 0; i < L.a; i++) {
      const [k, f] = at[l][i], inside = Math.abs(h[i]) < 1;
      for (let j = 0; j < L.b; j++) {
        const e = i * L.b + j, o = e * NB, slope = inside ? ((L.c[o + k + 1] - L.c[o + k]) * GK) / 2 : 0;
        gin[i] += g[j] * (slope + L.w[e]);
        L.c[o + k] -= lr * g[j] * (1 - f); L.c[o + k + 1] -= lr * g[j] * f; L.w[e] -= lr * g[j] * h[i];
      }
    }
    if (l > 0) g = Array.from(gin, (v, i) => v * (1 - h[i] * h[i]));
  }
  return y;
}

// ---- the tanh networks it is scored against -------------------------------------------------------------------------------------------
export function makeNet(r, hidden) {
  const a = SHAPE[0], b = SHAPE[2];
  return { a, h: hidden, b, W1: Float64Array.from({ length: a * hidden }, () => r() - 0.5), b1: new Float64Array(hidden), W2: Float64Array.from({ length: hidden * b }, () => (r() - 0.5) / Math.sqrt(hidden)), b2: new Float64Array(b) };
}
export function netForward(M, x) {
  const h = new Float64Array(M.h), y = new Float64Array(M.b);
  for (let k = 0; k < M.h; k++) { let s = M.b1[k]; for (let i = 0; i < M.a; i++) s += M.W1[i * M.h + k] * x[i]; h[k] = Math.tanh(s); }
  for (let j = 0; j < M.b; j++) { let s = M.b2[j]; for (let k = 0; k < M.h; k++) s += M.W2[k * M.b + j] * h[k]; y[j] = Math.tanh(s); }
  return { h, y };
}
export function netTrain(M, x, t, lr = LR) {
  const { h, y } = netForward(M, x), g = Array.from(y, (v, j) => (v - t[j]) * (1 - v * v)), gh = new Float64Array(M.h);
  for (let k = 0; k < M.h; k++) for (let j = 0; j < M.b; j++) { gh[k] += g[j] * M.W2[k * M.b + j]; M.W2[k * M.b + j] -= lr * g[j] * h[k]; }
  for (let j = 0; j < M.b; j++) M.b2[j] -= lr * g[j];
  for (let k = 0; k < M.h; k++) { const d = gh[k] * (1 - h[k] * h[k]); M.b1[k] -= lr * d; for (let i = 0; i < M.a; i++) M.W1[i * M.h + k] -= lr * d * x[i]; }
}

// ---- the organ's state ----------------------------------------------------------------------------------------------------------------
export function makeCurves(seed = 1) {
  const r = rng((seed * 2654435761) ^ 0x3a11);
  return { r, kan: makeKan(r), small: makeNet(r, SHAPE[1]), big: makeNet(r, H), p0: null, p1: null, ticks: 0, trained: 0, held: 0, posted: 0, fed: 0,
    err: { kan: [], same: [], small: [], big: [] }, last: null };
}
/** the input and target of one frame from three pointer positions: [x, target, v]; null without two earlier positions. Pure. */
export function frameOf(p0, p1, q) {
  if (!p0 || !p1) return null;
  const v = [clamp((p1[0] - p0[0]) * VEL, -1, 1), clamp((p1[1] - p0[1]) * VEL, -1, 1)], next = [clamp((q[0] - p1[0]) * VEL, -1, 1), clamp((q[1] - p1[1]) * VEL, -1, 1)];
  return { x: [v[0], v[1], 2 * p1[0] - 1, 2 * p1[1] - 1], d: [next[0] - v[0], next[1] - v[1]], v };
}
const se = (y, d) => (y[0] - d[0]) ** 2 + (y[1] - d[1]) ** 2; // the error of a change y to v, against the true change d
/** each tick the pointer is over: one frame that trains every learner or is held out to score them. Pure on C. */
export function curvesTick(C, input = {}) {
  if (!input.over) { C.p0 = C.p1 = null; return; }
  const q = [clamp(+input.x || 0, 0, 1), clamp(+input.y || 0, 0, 1)], F = frameOf(C.p0, C.p1, q); C.p0 = C.p1; C.p1 = q; C.ticks++;
  if (!F) return;
  if (C.r.int(HOLD) === 0) {
    keep(C.err.kan, se(kanForward(C.kan, F.x).y, F.d), TEST); keep(C.err.same, se([0, 0], F.d), TEST);
    keep(C.err.small, se(netForward(C.small, F.x).y, F.d), TEST); keep(C.err.big, se(netForward(C.big, F.x).y, F.d), TEST); C.held++;
  } else { kanTrain(C.kan, F.x, F.d); netTrain(C.small, F.x, F.d); netTrain(C.big, F.x, F.d); C.trained++; }
  C.last = { at: q, x: [F.v[0], F.v[1], 2 * q[0] - 1, 2 * q[1] - 1] }; // the newest step and position, for the guess the map shows
}

/** the best baseline's mean held-out error over the KAN's; null before MIN_HELD held-out frames or with no motion to guess. Pure. */
export function gainOf(C) {
  if (C.held < MIN_HELD) return null;
  const k = mean(C.err.kan), best = Math.min(mean(C.err.same), mean(C.err.small), mean(C.err.big));
  return best > 1e-9 && k > 0 ? r3(best / k) : null;
}
/** the numbers the self, the map and the tests read. Pure. */
export function curvesOf(C) {
  const m = (v) => (v.length ? +mean(v).toPrecision(3) : null);
  return { ticks: C.ticks, trained: C.trained, held: C.held, err: { kan: m(C.err.kan), same: m(C.err.same), small: m(C.err.small), big: m(C.err.big) }, gain: gainOf(C), numbers: KAN_NUMBERS, hidden: H, fed: C.fed };
}

// ---- kept knowledge -------------------------------------------------------------------------------------------------------------------
/** the curves to keep: every layer's knots and linear terms, never a frame. Pure. */
export const knotsOf = (C) => ({ c: C.kan.map((L) => Array.from(L.c, r3)), w: C.kan.map((L) => Array.from(L.w, r3)) });
/** restore kept curves; a wrong record changes nothing. Returns whether it loaded. Pure on C. */
export function loadKnots(C, k) {
  const ok = (a, n) => Array.isArray(a) && a.length === n && a.every((v) => Number.isFinite(v) && Math.abs(v) <= 20);
  if (!k || !Array.isArray(k.c) || !Array.isArray(k.w) || k.c.length !== C.kan.length || k.w.length !== C.kan.length) return false;
  if (!C.kan.every((L, l) => ok(k.c[l], L.a * L.b * NB) && ok(k.w[l], L.a * L.b))) return false;
  C.kan.forEach((L, l) => { L.c = Float64Array.from(k.c[l]); L.w = Float64Array.from(k.w[l]); }); return true;
}

export const curves = {
  id: 'curves', name: 'Curves', job: 'a Kolmogorov-Arnold network of spline curves that guesses your next step',
  // it learns and is scored every tick in curvesTick whether it runs or not; it asks for a run only to act, while its curves guess the
  // next step better than every baseline and there is a newer score
  rests: (b) => b.curves.held === b.curves.posted || !(gainOf(b.curves) > 1) || !b.curves.last,
  want: () => 0.25,
  run(b) {
    const C = b.curves, g = gainOf(C); C.posted = C.held;
    const { at, x } = C.last, y = kanForward(C.kan, x).y, gx = clamp(at[0] + (x[0] + y[0]) / VEL, 0, 1), gy = clamp(at[1] + (x[1] + y[1]) / VEL, 0, 1);
    if (g > 1) { deposit(b.ws, 'input', gx, gy, 0.02, 1, 'curves'); C.fed++; }
    b.board.curves = { x: gx, y: gy, live: g > 1, gain: g, tick: b.ticks };
    return 1;
  }
};
