// brain-strokes, Verse Brain's stroke memory: an associative memory of the visitor's own strokes that recalls the rest of a stroke from
// its first half, from the Hopfield drafts (atomeam/a-to-mind.com drafts/: F463, F545, F556, F559, F597). Owner, 2026-10-29: "combine all
// the builds into one entity", "dont fake it". The drafts' idea: a network stores patterns and, given part of one, settles on the whole.
// Their rule (F463 as written): W += p p^T / |p| for each stored pattern p, then s = tanh(W s) four times from the cue. Nothing in the
// drafts measured whether it recalled anything right. Here:
//   1. the strokes: every tick the pointer is over the brain, its place is a sample (lib/brain.js stepBrain calls sampleStroke each tick,
//      run or not, as it calls hearFrame). A stroke ends when the pointer leaves, presses or lets go, stands still for STILL_TICKS ticks,
//      or jumps more than JUMP. The first L samples of a stroke, each taken from the stroke's start, are one pattern (D = 2 L numbers); a
//      longer stroke gives one pattern for each L samples. Each piece, with its places, is also put in S.cut for the rules organ (lib/brain-rules.js).
//   2. recall: the dense (modern) Hopfield update (Ramsauer et al. 2020, "Hopfield Networks is All You Need"): each stored pattern is
//      weighted by softmax(-beta |its first half - cue|^2 / 2), and the weighted mean of their second halves is the recall. One step, the
//      last M = 32 patterns. beta (how sharp) is the value of a grid that missed least on the last 50 strokes.
//   3. the test, each stroke, before it is stored: from its first HALF samples, where does the rest go? The recall is scored against the
//      truth, and so are three ways that need no memory: hold the last place, carry on at the last speed, carry on at the last speed and
//      turn (constant acceleration). The drafts' rule as written is scored too (on patterns scaled to unit size).
//   4. the gain is the best no-memory way's error over the recall's error, on the last 50 strokes. A visitor whose strokes repeat gets a
//      gain far over 1; a visitor whose strokes never repeat gets a gain under 1. Only while the gain is over 1 does the recall of the
//      live stroke leave a memory in the workspace where it says the stroke will end, and show its orb there.
//   Measured (tools/brain-strokes.test.mjs, 3 visitors, 300 strokes, the last 50 scored): 3 shapes drawn in turn at random places and
//   sizes, the recall missed 27 to 62 times less than the best no-memory way; 6 shapes, 7.7 to 27 times less; wandering strokes that never
//   repeat, 0.32 to 0.45 (it loses, and stays quiet). In a scratch run, smooth waves that never repeat gave 1.2 to 1.5 (they share a shape,
//   and it learns that). The drafts' rule as written missed 25 to 57 times more than the recall on 3 shapes (about as much as the best
//   no-memory way), and 1.2 to 2.0 times more on strokes that never repeat.
// The strokes stay on the visitor's device: they are kept only in the brain's own knowledge (lib/brain-mind.js knowledgeOf).
// Pure: no DOM, no clock, no Math.random.
import { clamp } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const L = 16, HALF = 8, D = 2 * L, KN = 2 * HALF, M = 32, WINDOW = 50, MIN_SCORED = 20;
export const BETAS = [1e2, 1e3, 1e4, 1e5, 1e6];
export const STILL = 0.0015, STILL_TICKS = 2, JUMP = 0.12, QUEUE = 4, MAX = 1.5;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0, r4 = (v) => Math.round(v * 10000) / 10000 || 0; // never -0: it does not survive JSON
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v) => { arr.push(v); if (arr.length > WINDOW) arr.shift(); };
const errOf = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s / a.length; };

/** a stroke memory with nothing stored. */
export function makeStrokes() {
  return { cur: [], at: null, still: 0, down: false, live: null, queue: [], cut: [], X: [], W: new Float64Array(D * D), scale: 0.05, strokes: 0, scored: 0, fed: 0,
    err: { recall: [], hold: [], vel: [], acc: [], hebb: [] }, byBeta: BETAS.map(() => []), beta: 2, last: null };
}

// ---- the strokes ----------------------------------------------------------------------------------------------------------------------
const endStroke = (S) => { S.cur = []; S.live = null; };
/** the pattern of a stroke's first L samples: each sample from the stroke's start, as [x0, y0, x1, y1, ...]. Pure. */
export const patternOf = (st) => st.slice(0, L).flatMap(([x, y]) => [x - st[0][0], y - st[0][1]]);
/** one tick of the pointer: { x, y, over, down } in 0..1. Builds the live stroke; a stroke of L samples is queued as a pattern for the
 *  organ's next run. Pure on S. */
export function sampleStroke(S, input = {}) {
  if (!input.over) { endStroke(S); S.at = null; return; }
  const down = !!input.down; if (down !== S.down) { S.down = down; endStroke(S); }
  const p = [clamp(+input.x || 0, 0, 1), clamp(+input.y || 0, 0, 1)], d = S.at ? Math.hypot(p[0] - S.at[0], p[1] - S.at[1]) : Infinity; S.at = p;
  if (d < STILL) { if (++S.still >= STILL_TICKS) endStroke(S); return; } // a still pointer is no sample; long enough, it ends the stroke
  S.still = 0;
  if (d > JUMP) endStroke(S);
  S.cur.push(p);
  if (S.cur.length >= L) { S.queue.push(patternOf(S.cur)); if (S.queue.length > QUEUE) S.queue.shift(); S.cut.push(S.cur.slice(0, L)); if (S.cut.length > QUEUE) S.cut.shift(); S.strokes++; S.cur = []; S.live = null; }
}

// ---- recall and its rivals ------------------------------------------------------------------------------------------------------------
/** the dense Hopfield recall of the second half from the cue (the first KN numbers), over the stored patterns X, sharpness beta. Pure. */
export function dense(X, cue, beta) {
  const sc = X.map((x) => { let d = 0; for (let k = 0; k < KN; k++) d += (x[k] - cue[k]) ** 2; return (-beta * d) / 2; });
  const top = Math.max(...sc), w = sc.map((s) => Math.exp(s - top)), z = w.reduce((a, x) => a + x, 0), out = new Array(D - KN).fill(0);
  X.forEach((x, j) => { for (let k = KN; k < D; k++) out[k - KN] += (w[j] / z) * x[k]; });
  return out;
}
/** the drafts' rule as written: s = tanh(W s) four times from the cue (the unknown half at 0), on patterns scaled by `scale`. Pure. */
export function hebbRecall(W, cue, scale) {
  let s = Array.from({ length: D }, (_, i) => (i < KN ? cue[i] / scale : 0));
  for (let t = 0; t < 4; t++) { const n = new Array(D); for (let i = 0; i < D; i++) { let a = 0; for (let j = 0; j < D; j++) a += W[i * D + j] * s[j]; n[i] = Math.tanh(a); } s = n; }
  return s.slice(KN).map((v) => v * scale);
}
/** the three ways that need no memory, from the cue: hold the last place, carry on at the last speed, and at the last speed and turn. Pure. */
export function carryOn(cue) {
  const lx = cue[KN - 2], ly = cue[KN - 1], vx = lx - cue[KN - 4], vy = ly - cue[KN - 3], ax = vx - (cue[KN - 4] - cue[KN - 6]), ay = vy - (cue[KN - 3] - cue[KN - 5]);
  const ext = (V, A) => Array.from({ length: D - KN }, (_, k) => { const q = 1 + (k >> 1); return k % 2 ? ly + V * vy * q + (A * ay * q * (q + 1)) / 2 : lx + V * vx * q + (A * ax * q * (q + 1)) / 2; });
  return { hold: ext(0, 0), vel: ext(1, 0), acc: ext(1, 1) };
}
const bestBeta = (S) => { let b = S.beta, m = Infinity; S.byBeta.forEach((e, k) => { const v = mean(e); if (v != null && v < m) { m = v; b = k; } }); return b; };
/** the drafts' Hebbian store of one pattern (W += q q^T / |q|, q the pattern at unit size, no self links). Pure on S. */
function learnHebb(S, p) {
  const n = Math.hypot(...p); S.scale = 0.95 * S.scale + 0.05 * (n / Math.sqrt(D));
  const q = p.map((v) => v / S.scale), n2 = Math.hypot(...q) || 1;
  for (let a = 0; a < D; a++) for (let c = 0; c < D; c++) if (a !== c) S.W[a * D + c] += (q[a] * q[c]) / n2 / D;
}
/** a finished stroke's pattern: first scored (the recall from its first half, with the beta picked before it, against the truth and the
 *  rivals), then stored. Returns the stroke's errors, or null while too little is stored to score. Pure on S. */
export function scoreAndStore(S, p) {
  let out = null;
  if (S.X.length >= 2) {
    const cue = p.slice(0, KN), truth = p.slice(KN), pick = bestBeta(S), c = carryOn(cue);
    const byBeta = BETAS.map((b) => errOf(dense(S.X, cue, b), truth));
    out = { recall: byBeta[pick], hold: errOf(c.hold, truth), vel: errOf(c.vel, truth), acc: errOf(c.acc, truth), hebb: errOf(hebbRecall(S.W, cue, S.scale), truth) };
    for (const k of Object.keys(S.err)) keep(S.err[k], out[k]);
    byBeta.forEach((e, k) => keep(S.byBeta[k], e));
    S.beta = bestBeta(S); S.scored++;
  }
  S.X.push(p); if (S.X.length > M) S.X.shift(); learnHebb(S, p);
  S.last = out;
  return out;
}
/** the gain on the last (up to 50) strokes: the best no-memory way's error over the recall's. null before MIN_SCORED strokes. Pure. */
export function gainOf(S) {
  if (S.scored < MIN_SCORED) return null;
  const rec = mean(S.err.recall), base = Math.min(mean(S.err.hold), mean(S.err.vel), mean(S.err.acc));
  return rec > 1e-12 ? base / rec : null;
}
/** the drafts' rule's error over the recall's, on the same strokes. null before MIN_SCORED strokes. Pure. */
export const draftsGainOf = (S) => { const rec = mean(S.err.recall), h = mean(S.err.hebb); return S.scored >= MIN_SCORED && rec > 1e-12 ? h / rec : null; };
/** where the live stroke will end, by the recall, once it has HALF samples: [x, y], or null. Pure on S (it remembers the answer). */
export function predictLive(S) {
  if (S.live || S.cur.length < HALF || S.X.length < 2) return S.live;
  const st = S.cur, cue = patternOf(st.slice(0, HALF)), rest = dense(S.X, cue, BETAS[S.beta]);
  S.live = [clamp(st[0][0] + rest[rest.length - 2], 0, 1), clamp(st[0][1] + rest[rest.length - 1], 0, 1)];
  return S.live;
}

// ---- kept knowledge and the self ------------------------------------------------------------------------------------------------------
/** the stored strokes as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const strokeMemoryOf = (S) => ({ X: S.X.map((p) => p.map(r4)), beta: S.beta, strokes: S.strokes });
const validPattern = (p) => Array.isArray(p) && p.length === D && p.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX);
/** load kept strokes; anything that is not up to M patterns of D numbers in range, a beta index and a whole count of strokes is refused
 *  and changes nothing. The drafts' store is rebuilt from the patterns; the scores start again (they are measured, not kept). Returns true
 *  when loaded. */
export function loadStrokeMemory(S, k) {
  if (!k || !Array.isArray(k.X) || k.X.length > M || !k.X.every(validPattern) || !(Number.isInteger(k.beta) && k.beta >= 0 && k.beta < BETAS.length) || !(Number.isInteger(k.strokes) && k.strokes >= k.X.length)) return false;
  Object.assign(S, makeStrokes()); S.beta = k.beta; S.strokes = k.strokes;
  for (const p of k.X) { S.X.push(p.slice()); learnHebb(S, p); }
  return true;
}
/** the stroke memory's numbers for the self. Pure. */
export function strokesOf(S) {
  const g = gainOf(S), h = draftsGainOf(S);
  return { strokes: S.strokes, stored: S.X.length, scored: S.scored, gain: g == null ? null : r3(g), drafts: h == null ? null : r3(h), beta: BETAS[S.beta], fed: S.fed };
}

export const strokes = {
  id: 'strokes', name: 'Strokes', job: 'an associative memory of your strokes that recalls the rest of a stroke from its first half',
  // with no stroke to score and no half stroke to finish it takes no run from the others (scheduleTick skips an organ that rests)
  rests: (b) => !(b.strokes.queue.length || (b.strokes.cur.length >= HALF && !b.strokes.live)),
  want: () => 0.5,
  run(b) {
    const S = b.strokes; // fed every tick by sampleStroke in stepBrain (lib/brain.js)
    while (S.queue.length) scoreAndStore(S, S.queue.shift());
    const had = S.live, at = predictLive(S), g = gainOf(S);
    if (at && !had && g > 1) { deposit(b.ws, 'memory', at[0], at[1], 0.04, 1.5, 'strokes'); S.fed++; }
    b.board.strokes = { x: at ? at[0] : b.focus.x, y: at ? at[1] : b.focus.y, live: !!at, gain: g, tick: b.ticks };
    return 1;
  }
};
