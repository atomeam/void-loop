// brain-atlas, Verse Brain's atlas: a Kohonen self-organizing map (SOM) of how the visitor moves, from the SOM drafts (atomeam/a-to-mind.com
// drafts/F606-webgpu-som-spatial-dom-mind, and F564-webgpu-som-topographic-audio-dom-mind before it). Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it". The draft's idea as
// written: a lattice of neurons takes the pointer's motion as input and self-organizes by competitive learning with a Gaussian neighbourhood
// and a decaying radius and rate; the error it shows is the quantization error. The draft measured nothing against a learner without the
// neighbourhood. Here:
//   1. the input: each tick of the pointer over the brain is one sample [x, y, vx, vy], the velocity scaled by VEL and moved to 0.5, all
//      in 0..1 (lib/brain.js stepBrain calls atlasTick each tick, run or not, as it calls growthTick).
//   2. the map: G x G units on a square lattice, each with a weight in the input space. A sample finds its best matching unit (BMU), the
//      unit nearest to it, and every unit moves toward the sample by eta * exp(-d^2 / (2 sigma^2)), d its lattice distance to the BMU.
//      sigma falls from SIG0 to SIG1 and eta from ETA0 to ETA1 over the first samples (time constant TAU), then they stay there, so the map
//      keeps up with a visitor who changes how they move.
//   3. the baselines, trained on the same samples from the same start: the same learner with no neighbourhood (only the BMU moves, at the
//      same eta), and MacQueen's online k-means (only the BMU moves, at 1 / its own count).
//   4. the test: one sample in HOLD never trains any learner; it goes to a held-out buffer of the last TEST samples. Every EVAL ticks each
//      learner is scored on that buffer: the topographic error (the share of samples whose first and second nearest units are not lattice
//      neighbours, 8 neighbours) and the quantization error (the mean distance to the BMU).
//   5. the gain is the no-neighbourhood learner's topographic error over the map's, each the mean of its last WINDOW scores (with one
//      sample of TEST added to each, so a map with no error has a finite gain). Moves with no shape (held-out samples within SPREAD of their
//      mean: a pointer held still) have nothing to map, and have no gain. Only while
//      the gain is over 1, and the map's quantization error is at most SLACK times k-means', does the map show on the brain and leave a
//      little life in the input layer: a map that keeps its order but no longer fits the moves stays quiet.
//   Measured (tools/brain-atlas.test.mjs, 4 visitors, 3 seeds, 3000 ticks): see that file's header.
// The pointer stays on the visitor's device: only the map's weights are kept, in the brain's own knowledge (lib/brain-mind.js).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const G = 8, U = G * G, D = 4, VEL = 20, SIG0 = 3, SIG1 = 0.7, ETA0 = 0.5, ETA1 = 0.02, TAU = 400;
export const HOLD = 5, TEST = 200, EVAL = 50, WINDOW = 10, MIN_EVALS = 6, MIN_TEST = 50, SLACK = 1.25, SPREAD = 0.02;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
const mean = (v) => (v && v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v, n) => { arr.push(v); if (arr.length > n) arr.shift(); };
const ux = (i) => i % G, uy = (i) => (i / G) | 0;

/** a learner: U weights of D numbers, the same start for every learner of one atlas. */
const learner = (w0) => ({ w: Float32Array.from(w0), n: new Uint32Array(U) });
/** an atlas: the map, its two baselines, the held-out buffer. */
export function makeAtlas(seed = 1) {
  const r = rng((seed * 3266489917) ^ 0x50f3), w0 = Array.from({ length: U * D }, () => r());
  return { r, som: learner(w0), flat: learner(w0), km: learner(w0), t: 0, ticks: 0, prev: null, test: [], evals: 0, posted: 0, fed: 0,
    te: { som: [], flat: [], km: [] }, qe: { som: [], flat: [], km: [] }, last: null };
}

/** the sample of one pointer frame: [x, y, vx, vy], all in 0..1; null with no previous frame. Pure. */
export function sampleOf(prev, x, y) {
  if (!prev) return null;
  return [x, y, clamp(0.5 + (x - prev[0]) * VEL, 0, 1), clamp(0.5 + (y - prev[1]) * VEL, 0, 1)];
}
const dist2 = (w, i, s) => { let d = 0; for (let k = 0; k < D; k++) { const e = w[i * D + k] - s[k]; d += e * e; } return d; };
/** the first and second nearest units of sample s, and the first's squared distance. Pure. */
export function bmu2(w, s) {
  let a = -1, b = -1, da = Infinity, db = Infinity;
  for (let i = 0; i < U; i++) { const d = dist2(w, i, s); if (d < da) { b = a; db = da; a = i; da = d; } else if (d < db) { b = i; db = d; } }
  return [a, b, da];
}
export const sigmaAt = (t) => Math.max(SIG1, SIG0 * Math.exp(-t / TAU));
export const etaAt = (t) => Math.max(ETA1, ETA0 * Math.exp(-t / TAU));
/** one training step of each learner on sample s at step t. Pure on A's learners. */
export function train(A, s, t) {
  const sg = sigmaAt(t), et = etaAt(t), two = 2 * sg * sg;
  { const L = A.som, [c] = bmu2(L.w, s); L.n[c]++;
    for (let i = 0; i < U; i++) { const dx = ux(i) - ux(c), dy = uy(i) - uy(c), h = et * Math.exp(-(dx * dx + dy * dy) / two); if (h < 1e-4) continue; for (let k = 0; k < D; k++) L.w[i * D + k] += h * (s[k] - L.w[i * D + k]); } }
  { const L = A.flat, [c] = bmu2(L.w, s); L.n[c]++; for (let k = 0; k < D; k++) L.w[c * D + k] += et * (s[k] - L.w[c * D + k]); }
  { const L = A.km, [c] = bmu2(L.w, s); L.n[c]++; const e = 1 / L.n[c]; for (let k = 0; k < D; k++) L.w[c * D + k] += e * (s[k] - L.w[c * D + k]); }
}
/** the topographic and quantization errors of weights w on samples S. Pure. */
export function errorsOf(w, S) {
  let bad = 0, q = 0;
  for (const s of S) { const [a, b, d] = bmu2(w, s); if (Math.max(Math.abs(ux(a) - ux(b)), Math.abs(uy(a) - uy(b))) > 1) bad++; q += Math.sqrt(d); }
  return S.length ? { te: bad / S.length, qe: q / S.length } : { te: 0, qe: 0 };
}
/** each tick the pointer is over: one sample that trains every learner or goes to the held-out buffer, and every EVAL ticks a score. Pure on A. */
export function atlasTick(A, input = {}) {
  if (!input.over) { A.prev = null; return; }
  const x = clamp(+input.x || 0, 0, 1), y = clamp(+input.y || 0, 0, 1), s = sampleOf(A.prev, x, y); A.prev = [x, y]; A.ticks++;
  if (!s) return;
  A.last = s;
  if (A.r.int(HOLD) === 0) keep(A.test, s, TEST); else { train(A, s, A.t); A.t++; }
  if (A.ticks % EVAL === 0 && A.test.length >= MIN_TEST) {
    for (const k of ['som', 'flat', 'km']) { const e = errorsOf(A[k].w, A.test); keep(A.te[k], e.te, WINDOW); keep(A.qe[k], e.qe, WINDOW); }
    A.evals++;
  }
}

/** the no-neighbourhood learner's topographic error over the map's, each on its last scores; null before MIN_EVALS. Pure. */
export function gainOf(A) {
  if (A.evals < MIN_EVALS || spreadOf(A.test) < SPREAD) return null;
  const s = mean(A.te.som), f = mean(A.te.flat);
  return r3((f + 1 / TEST) / (s + 1 / TEST)); // one sample of TEST added to each, so a map with no error has a finite gain
}
/** the mean distance of samples S to their mean: moves with no shape (a pointer held still) have nothing to map. Pure. */
export function spreadOf(S) {
  if (!S.length) return 0;
  const c = Array.from({ length: D }, (_, k) => mean(S.map((s) => s[k])));
  return mean(S.map((s) => Math.sqrt(s.reduce((a, v, k) => a + (v - c[k]) ** 2, 0))));
}
/** whether the map is shown: it keeps the order (gain > 1) and still fits the moves (quantization error within SLACK of k-means'). Pure. */
export function liveOf(A) {
  const g = gainOf(A);
  return g != null && g > 1 && mean(A.qe.som) <= SLACK * mean(A.qe.km);
}
/** the numbers the self, the map and the tests read. Pure. */
export function atlasOf(A) {
  const m = (v) => (v.length ? r3(mean(v)) : null), g = gainOf(A);
  return { ticks: A.ticks, trained: A.t, held: A.test.length, evals: A.evals, sigma: r3(sigmaAt(A.t)), eta: r3(etaAt(A.t)),
    te: { som: m(A.te.som), flat: m(A.te.flat), km: m(A.te.km) }, qe: { som: m(A.qe.som), flat: m(A.qe.flat), km: m(A.qe.km) },
    gain: g, spread: r3(spreadOf(A.test)), live: liveOf(A), used: Array.from(A.som.n).filter((v) => v > 0).length, fed: A.fed };
}

// ---- kept knowledge -------------------------------------------------------------------------------------------------------------------
/** the map to keep: only its weights and how many samples it learned, never a sample. Pure. */
export const mapOf = (A) => ({ w: Array.from(A.som.w, r3), t: A.t });
/** restore a kept map; a wrong record changes nothing. Returns whether it loaded. Pure on A. */
export function loadMap(A, k) {
  if (!k || !Array.isArray(k.w) || k.w.length !== U * D || !k.w.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return false;
  A.som.w = Float32Array.from(k.w); A.was = Math.max(0, Math.floor(+k.t || 0)); return true;
}

export const atlas = {
  id: 'atlas', name: 'Atlas', job: 'a self-organizing map of how you move, whose neighbours are neighbours in your moves',
  // it learns and is scored every tick in atlasTick whether it runs or not; it asks for a run only to act, while the map keeps its order
  // better than the learner with no neighbourhood, still fits the moves, and there is a new score
  rests: (b) => b.atlas.evals === b.atlas.posted || !liveOf(b.atlas) || !b.atlas.last,
  want: () => 0.25,
  run(b) {
    const A = b.atlas, live = liveOf(A); A.posted = A.evals;
    const [c] = bmu2(A.som.w, A.last), at = (i) => [A.som.w[i * D], A.som.w[i * D + 1]];
    if (live) { for (let i = 0; i < U; i++) if (Math.max(Math.abs(ux(i) - ux(c)), Math.abs(uy(i) - uy(c))) <= 1) { const [x, y] = at(i); deposit(b.ws, 'input', x, y, 0.015, 1, 'atlas'); } A.fed++; }
    const [x, y] = at(c);
    b.board.atlas = { x, y, live, gain: gainOf(A), tick: b.ticks, unit: c };
    return 1;
  }
};
