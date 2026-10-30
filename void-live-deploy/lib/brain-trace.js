// brain-trace, Verse Brain's trace: a cellular automaton that holds where the brain's focus was for a set time and then lets it go, from
// the neural cellular automaton (NCA) drafts (atomeam/a-to-mind.com drafts/: F36, F43, F45, F261, F270, F402, F443, F445, F446). Owner,
// 2026-10-29: "combine all the builds into one entity", "dont fake it". The drafts' idea: a grid whose local rule keeps spatial memory
// of seeds. Their rule (F443 as written): each cell moves toward 1.15 times its 3x3 neighbourhood mean and decays (v' = 0.77 v + 0.1725 s),
// and a seed adds a strength that decays by 0.995 a step. It was never tuned: a mark stays for hundreds of steps and spreads a little,
// so the field never lets go of where the focus was. Here:
//   1. the field: N x N cells with a mark (0..1) and a stamp. A seed is the focus: at the start of each SPAN / 2 steps it adds 0.6 to the
//      mark in a disc round the focus and sets the stamp there to 1 (the drafts' seed strength). Each step the rule runs on every cell
//      (v' = clamp(a v + b m + c + d s, 0, 1), s' = e s, with m the mean mark of the 8 neighbours), then noise (the field is noisy).
//   2. the task: a mark must stand at 1 for SPAN steps after its seed and then be gone; everywhere else must stay at 0. The cost is the
//      mean squared error of the marks against that, each step. Holding forever, fading, and noise all cost.
//   3. learning: the five numbers (a, b, c, d, e) move by an evolution strategy with mirrored tries: each life PC copies of the field run
//      from the same seeds and the same noise, as PC / 2 pairs (the rule plus a small random change, and minus it); the cheaper side of each
//      pair says which way to move the rule, with momentum. With blind set it is random search: the best rule so far against PC - 1 fresh ones.
//   4. the control: one more copy runs the drafts' rule as written, and one runs the tuned rule itself (not a try). The first's cost over
//      the second's is the gain.
//   A neural rule was measured too (8 hidden units, 4 channels, the same search, with and without the stamp; scratch measurement,
//   2026-10-30, 6 brains, 600 lives): it did not beat these five numbers tuned (best 2 of 6), so the trace keeps the drafts' own rule.
//   Measured on 8 real brains' focus paths (300 lives, the mean of the last 50): the tuned rule's error was the drafts' rule's over 7.0 to
//   9.6, random search's over 4.2 to 7.1; on 40 new lives with the rule held fixed, 4.9 to 11.2 against 2.5 to 9.2. The tuned rule beat
//   random search on 8 of 8 both ways. At a life's end it holds fresh marks at 0.59 to 0.82, old marks at 0.03 to 0.24, the rest at 0.02.
//   Once the tuned rule beats the drafts' rule, each life's newest mark leaves a little memory in the workspace where the focus was.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const N = 16, PC = 6, LIFE = 60, SPAN = 30, SUB = 4, EVERY = 6, GENES = 5;
export const AS_WRITTEN = [0.77, 0.1725, 0, 0.6, 0.995]; // F443: v' = 0.92 v + 0.15 (1.15 m - v), seed strength 0.6 decaying by 0.995
// the range each number may take: a, b, c, d, e
export const RANGE = [[0, 3], [-1, 1], [-1, 0.5], [0, 2], [0.8, 0.999]];
const PAIRS = PC / 2, SIGMA = 0.05, STEP = 0.2 * SIGMA * Math.sqrt(GENES), MOM = 0.8, NOISE = 0.08, SEED = 0.6, R = 1.6;
const SEEDS = [0, SPAN / 2, SPAN]; // the steps of a life at which the focus seeds
const r3 = (v) => Math.round(v * 1000) / 1000 || 0; // never -0: it does not survive JSON
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const fit = (w) => Float64Array.from(w, (v, k) => clamp(v, RANGE[k][0], RANGE[k][1]));
const gauss = (r) => (r() + r() + r() - 1.5) * 2; // near-normal, -3..3

// ---- the field ------------------------------------------------------------------------------------------------------------------------
/** a still, empty field. */
export const makeField = () => ({ v: new Float64Array(N * N), s: new Float64Array(N * N), t: new Float64Array(N * N), born: new Float64Array(N * N).fill(-1e9) });
const copyField = (F) => ({ v: F.v.slice(), s: F.s.slice(), t: F.t.slice(), born: F.born.slice() });
/** seed a disc round (x, y) in 0..1 at step `step`: the mark rises by SEED and the stamp is set. Pure on F. */
export function seedField(F, x, y, step) {
  const cx = clamp(x, 0, 1) * (N - 1), cy = clamp(y, 0, 1) * (N - 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (Math.hypot(i - cx, j - cy) <= R) { const p = j * N + i; F.v[p] = Math.min(1, F.v[p] + SEED); F.s[p] = 1; F.born[p] = step; }
}
/** one step of the rule w on F, then the noise `noise` (N * N numbers), at life step `step`. Returns the step's cost: the mean squared
 *  error of the marks against 1 on marks younger than SPAN and 0 elsewhere. Pure on F. */
export function stepField(F, w, noise, step) {
  const [a, b, c, d, e] = w, v = F.v, t = F.t; let err = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let m = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) { const y = j + dj; if (y < 0 || y >= N) continue; for (let di = -1; di <= 1; di++) { const x = i + di; if ((di || dj) && x >= 0 && x < N) { m += v[y * N + x]; n++; } } }
    const p = j * N + i; t[p] = clamp(a * v[p] + (b * m) / n + c + d * F.s[p], 0, 1);
  }
  for (let p = 0; p < N * N; p++) {
    v[p] = clamp(t[p] + noise[p], 0, 1); F.s[p] *= e;
    const want = step - F.born[p] < SPAN ? 1 : 0; err += (v[p] - want) ** 2;
  }
  return err / (N * N);
}
/** how the field holds: the mean mark on marks younger than SPAN (hold), on older marks (stale) and on cells never seeded (empty). Pure. */
export function holdOf(F, step) {
  const s = { hold: [0, 0], stale: [0, 0], empty: [0, 0] };
  for (let p = 0; p < N * N; p++) { const k = F.born[p] < -1e8 ? 'empty' : step - F.born[p] < SPAN ? 'hold' : 'stale'; s[k][0] += F.v[p]; s[k][1]++; }
  return Object.fromEntries(Object.entries(s).map(([k, [x, n]]) => [k, n ? x / n : null]));
}

// ---- the trace: learning over lives ---------------------------------------------------------------------------------------------------
const fresh = (r) => Float64Array.from(RANGE, ([lo, hi]) => lo + (hi - lo) * r());
const valid = (w) => Array.isArray(w) && w.length === GENES && w.every((v, k) => typeof v === 'number' && Number.isFinite(v) && v >= RANGE[k][0] && v <= RANGE[k][1]);
const tries = (T) => {
  if (T.mode === 'blind') { T.pop = [T.w, ...Array.from({ length: PC - 1 }, () => fresh(T.r))]; return; }
  T.dirs = []; T.pop = [];
  for (let i = 0; i < PAIRS; i++) {
    const d = Float64Array.from({ length: GENES }, () => gauss(T.r)); T.dirs.push(d);
    T.pop.push(fit(Array.from(T.w, (v, k) => v + SIGMA * d[k])), fit(Array.from(T.w, (v, k) => v - SIGMA * d[k])));
  }
};
const startAll = (T) => {
  T.fields = T.pop.map(() => makeField()); T.ctl = makeField(); T.own = makeField(); T.cost.fill(0); T.ctlCost = 0; T.ownCost = 0; T.age = 0;
  T.noise = []; for (let k = 0; k < LIFE; k++) T.noise.push(Float64Array.from({ length: N * N }, () => (T.r() * 2 - 1) * NOISE)); // one life's noise, the same for every copy
};
/** a new trace. mode: 'learn' (the organ: one rule moved by mirrored tries), 'blind' (random search: the best rule so far against PC - 1
 *  fresh ones each life). It starts at the drafts' rule as written. */
export function makeTrace(seed, mode = 'learn') {
  const r = rng(seed * 52711 + 29);
  const T = { w: Float64Array.from(AS_WRITTEN), mom: new Float64Array(GENES), pop: [], dirs: [], r, mode, fields: [], ctl: null, cost: new Float64Array(PC), ctlCost: 0,
    noise: [], age: 0, lives: 0, since: EVERY - 2, gains: [], costs: [], holds: [], newest: null, fed: 0, evals: 0 };
  tries(T); startAll(T);
  return T;
}
/** one step of every copy of the field, with the focus at (x, y): at a seed step of the life the focus seeds there. Ends a life after
 *  LIFE steps; returns its result then. */
export function stepTrace(T, x, y) {
  const step = T.age;
  if (SEEDS.includes(step)) { for (const F of [...T.fields, T.ctl, T.own]) seedField(F, x, y, step); T.newest = [clamp(x, 0, 1), clamp(y, 0, 1)]; }
  for (let k = 0; k < PC; k++) T.cost[k] += stepField(T.fields[k], T.pop[k], T.noise[step], step);
  T.ctlCost += stepField(T.ctl, AS_WRITTEN, T.noise[step], step); T.ownCost += stepField(T.own, T.w, T.noise[step], step);
  if (step === LIFE - 1) T.lastHold = holdOf(T.own, step);
  return ++T.age >= LIFE ? endLife(T) : null;
}
/** the end of a life. Learning: each mirrored pair met the same seeds and noise, so the cheaper side of each pair says which way to move
 *  the rule (normalised, with momentum). Random search: a fresh rule that cost less than the best so far on this life takes its place.
 *  The drafts' rule's cost on the life over the rule's own cost (the copy that ran the rule itself) is kept as the gain. */
export function endLife(T) {
  const ctl = T.ctlCost / LIFE, c = Array.from(T.cost, (v) => v / LIFE), held = T.ownCost / LIFE;
  if (T.mode === 'blind') {
    let best = 0; for (let k = 1; k < PC; k++) if (c[k] < c[best]) best = k;
    if (best) T.w = T.pop[best];
  } else {
    const g = new Float64Array(GENES);
    for (let i = 0; i < PAIRS; i++) { const s = Math.sign(c[2 * i + 1] - c[2 * i]); for (let k = 0; k < GENES; k++) g[k] += s * T.dirs[i][k]; }
    const gn = Math.hypot(...g) || 1;
    for (let k = 0; k < GENES; k++) { T.mom[k] = MOM * T.mom[k] + (1 - MOM) * g[k] / gn; }
    T.w = fit(Array.from(T.w, (v, k) => v + STEP * T.mom[k]));
  }
  T.evals += PC; T.lives++;
  const gain = held > 1e-9 ? ctl / held : 1;
  T.gains.push(gain); if (T.gains.length > 50) T.gains.shift();
  T.costs.push(held); if (T.costs.length > 50) T.costs.shift();
  if (T.lastHold) { T.holds.push(T.lastHold); if (T.holds.length > 50) T.holds.shift(); }
  T.lastLife = { gain: r3(gain), cost: r3(held), control: r3(ctl) };
  tries(T); startAll(T);
  return T.lastLife;
}
/** the mean gain over the last (up to 50) lives: the drafts' rule's cost over the tuned rule's. Pure. */
export const gainOf = (T) => (T.gains.length ? mean(T.gains) : null);
/** the mean of each hold number over the last (up to 50) lives, at a life's last step. Pure. */
export const holdsOf = (T) => (T.holds.length ? Object.fromEntries(['hold', 'stale', 'empty'].map((k) => [k, mean(T.holds.map((h) => h[k]).filter((v) => v != null))])) : null);
/** the rule as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const ruleOf = (T) => ({ w: Array.from(T.w, r3), lives: T.lives });
/** load a kept rule; anything that is not GENES numbers in their ranges and a whole count of lives is refused and changes nothing.
 *  Returns true when loaded. */
export function loadRule(T, k) {
  if (!k || !valid(k.w) || !(Number.isInteger(k.lives) && k.lives >= 0)) return false;
  T.w = Float64Array.from(k.w); T.lives = k.lives; T.mom.fill(0); tries(T); startAll(T);
  return true;
}
/** the trace's numbers for the self. Pure. */
export function traceOf(T) {
  const g = gainOf(T), h = holdsOf(T), c = mean(T.costs);
  return { lives: T.lives, gain: g == null ? null : r3(g), cost: c == null ? null : r3(c), hold: h ? r3(h.hold) : null, stale: h && h.stale != null ? r3(h.stale) : null,
    rule: Array.from(T.w, r3), evals: T.evals, fed: T.fed };
}

export const trace = {
  id: 'trace', name: 'Trace', job: 'a cellular automaton that holds where the focus was for a while and then lets it go, whose rule the brain tunes',
  want: (b) => (b.trace.since >= EVERY ? 0.4 : 0.02),
  run(b) {
    const T = b.trace; // T.since counts ticks in stepBrain (lib/brain.js)
    if (T.since < EVERY) return 0;
    T.since = 0;
    let life = null;
    for (let n = 0; n < SUB; n++) { const r = stepTrace(T, b.focus.x, b.focus.y); if (r) life = r; }
    const g = gainOf(T);
    if (life && g > 1 && T.newest) { deposit(b.ws, 'memory', T.newest[0], T.newest[1], 0.03, 1.5, 'trace'); T.fed++; }
    b.board.trace = { x: T.newest ? T.newest[0] : b.focus.x, y: T.newest ? T.newest[1] : b.focus.y, gain: g, life: !!life, lives: T.lives, tick: b.ticks };
    return 1;
  }
};
