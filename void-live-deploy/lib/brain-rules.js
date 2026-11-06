// brain-rules, Verse Brain's rules: a decision tree that learns which way the visitor's next stroke goes from how the last one went and
// where it ended, from the decision-tree drafts (atomeam/a-to-mind.com drafts/: F296, F528, F595, F596). Owner, 2026-10-29: "combine all
// the builds into one entity", "dont fake it". The drafts' idea (F296 as written): a tree grows on pointer features (where it is, how it
// moves) with binary splits, drops leaves that do not help, and is sealed. Nothing in the drafts measured whether the tree guessed right.
// Here:
//   1. the strokes are the stroke memory's (lib/brain-strokes.js sampleStroke): each piece of L samples it cuts is also handed here, with
//      its places. A piece's features: where it ended (x, y), how far it went (dx, dy), how much it turned, how long it was. Its way: right,
//      down, left or up, by the larger of dx and dy.
//   2. each new piece is a test before it is learned: from the features of the piece before it, the tree guesses its way, and so do three
//      rules that need no tree: the way the visitor goes most, the same way as the last piece, and the way that most often came after the
//      last piece's way (a table of what follows what, Markov). Each guess is scored right or wrong, on the last WINDOW pieces.
//   3. the tree: grown from the last N pieces every REFIT pieces, Gini splits on the six features, at most DEPTH deep, at least MIN_LEAF
//      pieces in a leaf; a split that does not take at least MIN_GAIN wrong guesses off its leaf is cut back (the drafts' pruning). It is
//      not sealed: it keeps learning while the visitor draws.
//   4. the gain is how often the tree guessed right over how often the best of the three rules did, on the last WINDOW pieces. A visitor
//      whose next way hangs on where the last stroke ended gets a gain far over 1; a visitor who draws a fixed cycle gets 1 (the table of
//      what follows what knows the cycle too); a visitor who goes any way gets about 1, over or under by luck. Only while the gain is over 1
//      and the tree guessed AHEAD more pieces right than the best rule does its guess leave a memory in the workspace where the next stroke
//      will go, and show its orb there.
//   Measured (tools/brain-rules.test.mjs, 3 visitors, 300 strokes, the last 50 scored): see that file's header.
// The strokes stay on the visitor's device: only the tree is kept, in the brain's own knowledge (lib/brain-mind.js knowledgeOf).
// Pure: no DOM, no clock, no Math.random.
import { deposit } from './brain-workspace.js';

export const FEATURES = ['where it ended across', 'where it ended down', 'how far it went across', 'how far it went down', 'how much it turned', 'how long it was'];
export const WAYS = ['right', 'down', 'left', 'up'];
export const N = 150, REFIT = 10, DEPTH = 3, MIN_LEAF = 6, MIN_GAIN = 3, WINDOW = 50, MIN_SCORED = 20, AHEAD = 5, STEP = 0.08;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0, r4 = (v) => Math.round(v * 10000) / 10000 || 0; // never -0: it does not survive JSON
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v, n = WINDOW) => { arr.push(v); if (arr.length > n) arr.shift(); };
const argmax = (c) => { let k = 0; for (let i = 1; i < c.length; i++) if (c[i] > c[k]) k = i; return k; };

/** rules with nothing learned. */
export function makeRules() {
  return { fresh: false, prev: null, rows: [], tree: 0, since: 0, pieces: 0, scored: 0, fed: 0, hits: { tree: [], most: [], same: [], after: [] }, last: null };
}

// ---- the pieces -----------------------------------------------------------------------------------------------------------------------
/** a piece's features, from its places [[x, y], ...]: [x, y, dx, dy, turn, len]. Pure. */
export function featuresOf(pts) {
  const n = pts.length, a = pts[0], m = pts[n >> 1], z = pts[n - 1];
  const u = [m[0] - a[0], m[1] - a[1]], v = [z[0] - m[0], z[1] - m[1]];
  const turn = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) / Math.PI;
  let len = 0; for (let i = 1; i < n; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return [z[0], z[1], z[0] - a[0], z[1] - a[1], Number.isFinite(turn) ? turn : 0, len];
}
/** a piece's way, by the larger of how far it went across and down: 0 right, 1 down, 2 left, 3 up. Pure. */
export const wayOf = (f) => (Math.abs(f[2]) >= Math.abs(f[3]) ? (f[2] >= 0 ? 0 : 2) : (f[3] >= 0 ? 1 : 3));
/** a piece of the stroke memory, handed over when it is cut (lib/brain-strokes.js sampleStroke): scored and learned at once, like the
 *  stroke memory's own sampling, so the learning takes no run from the other organs. Pure on R. */
export function takePiece(R, pts) { scoreAndLearn(R, pts.map((p) => [p[0], p[1]])); R.fresh = true; }

// ---- the tree -------------------------------------------------------------------------------------------------------------------------
// a leaf is a way (0..3); a split is [feature, threshold, below, at or over]; a row is [features, the next piece's way, its own way]
/** the way a tree guesses for features f. Pure. */
export function guess(tree, f) { let t = tree; while (Array.isArray(t)) t = f[t[0]] < t[1] ? t[2] : t[3]; return t; }
const countsOf = (rows) => { const c = [0, 0, 0, 0]; for (const r of rows) c[r[1]]++; return c; };
const gini = (c, n) => { let s = 1; for (const k of c) s -= (k / n) ** 2; return s; };
const wrongOf = (c) => c.reduce((a, x) => a + x, 0) - Math.max(...c);
const leaves = (t) => (Array.isArray(t) ? leaves(t[2]) + leaves(t[3]) : 1);
const wrongIn = (t, rows) => rows.reduce((a, r) => a + (guess(t, r[0]) === r[1] ? 0 : 1), 0);
/** a tree grown on rows [[features, way], ...]: Gini splits, at most `depth` deep, at least MIN_LEAF rows in a leaf; a split that does not
 *  take MIN_GAIN wrong guesses off its leaf is cut back. Pure. */
export function grow(rows, depth = DEPTH) {
  const c = countsOf(rows), n = rows.length, leaf = argmax(c);
  if (!depth || n < 2 * MIN_LEAF || !wrongOf(c)) return leaf;
  let best = null;
  for (let f = 0; f < FEATURES.length; f++) {
    const s = rows.map((r) => [r[0][f], r[1]]).sort((a, b) => a[0] - b[0]), lc = [0, 0, 0, 0], rc = c.slice();
    for (let i = 0; i < n - 1; i++) {
      lc[s[i][1]]++; rc[s[i][1]]--;
      if (i + 1 < MIN_LEAF || n - i - 1 < MIN_LEAF || s[i][0] === s[i + 1][0]) continue;
      const g = ((i + 1) * gini(lc, i + 1) + (n - i - 1) * gini(rc, n - i - 1)) / n;
      if (!best || g < best.g - 1e-12) best = { g, f, t: (s[i][0] + s[i + 1][0]) / 2 };
    }
  }
  if (!best) return leaf;
  const lo = rows.filter((r) => r[0][best.f] < best.t), hi = rows.filter((r) => r[0][best.f] >= best.t);
  const t = [best.f, best.t, grow(lo, depth - 1), grow(hi, depth - 1)];
  return wrongOf(c) - wrongIn(t, rows) >= MIN_GAIN ? t : leaf; // the drafts' pruning: a split that does not help is cut back
}

// ---- the test and the learning --------------------------------------------------------------------------------------------------------
/** the three rules that need no tree, for a piece after the one with way w: [most, same, after]. Pure. */
export function rulesGuess(R, w) {
  const most = argmax(countsOf(R.rows)), after = [0, 0, 0, 0];
  for (const r of R.rows) if (r[2] === w) after[r[1]]++;
  return [most, w, after.some((x) => x) ? argmax(after) : most];
}
/** one piece: scored against the guesses made from the piece before it, then learned. Pure on R. */
export function scoreAndLearn(R, pts) {
  const f = featuresOf(pts), w = wayOf(f);
  R.pieces++;
  if (R.prev) {
    const pf = R.prev, pw = wayOf(pf), [most, same, after] = rulesGuess(R, pw);
    if (R.rows.length >= 2 * MIN_LEAF) {
      keep(R.hits.tree, guess(R.tree, pf) === w ? 1 : 0); keep(R.hits.most, most === w ? 1 : 0); keep(R.hits.same, same === w ? 1 : 0); keep(R.hits.after, after === w ? 1 : 0); R.scored++;
    }
    keep(R.rows, [pf, w, pw], N); // each row: the features of a piece, the way of the next, and its own way
    if (++R.since >= REFIT || R.rows.length === 2 * MIN_LEAF) { R.tree = grow(R.rows); R.since = 0; }
  }
  R.prev = f; R.last = f;
}
/** how often the tree guessed right over how often the best rule without a tree did, on the last WINDOW pieces; null until MIN_SCORED. */
export function gainOf(R) {
  if (R.scored < MIN_SCORED) return null;
  const best = Math.max(mean(R.hits.most), mean(R.hits.same), mean(R.hits.after));
  return best > 1e-9 ? mean(R.hits.tree) / best : null;
}
/** how many more of the last WINDOW pieces the tree guessed right than the best rule without a tree did. */
export const aheadOf = (R) => { const sum = (v) => v.reduce((a, x) => a + x, 0); return sum(R.hits.tree) - Math.max(sum(R.hits.most), sum(R.hits.same), sum(R.hits.after)); };
/** the tree speaks only when it is clearly ahead: a gain over 1 and AHEAD more right guesses in the window, so luck on a visitor who goes
 *  any way does not show an orb */
export const sureOf = (R) => { const g = gainOf(R); return g != null && g > 1 && aheadOf(R) >= AHEAD; };
/** where the tree says the next stroke goes: a step of STEP from where the last piece ended, its way. Pure. */
export function nextOf(R) {
  if (!R.last) return null;
  const w = guess(R.tree, R.last), d = [[1, 0], [0, 1], [-1, 0], [0, -1]][w];
  return { way: w, x: Math.min(1, Math.max(0, R.last[0] + STEP * d[0])), y: Math.min(1, Math.max(0, R.last[1] + STEP * d[1])) };
}

// ---- kept knowledge -------------------------------------------------------------------------------------------------------------------
const cleanTree = (t) => (Array.isArray(t) ? [t[0], r4(t[1]), cleanTree(t[2]), cleanTree(t[3])] : t);
/** the tree, as kept: { tree, pieces }. */
export const treeOf = (R) => ({ tree: cleanTree(R.tree), pieces: R.pieces });
const validTree = (t, d) => (Array.isArray(t)
  ? d > 0 && t.length === 4 && Number.isInteger(t[0]) && t[0] >= 0 && t[0] < FEATURES.length && typeof t[1] === 'number' && Number.isFinite(t[1]) && Math.abs(t[1]) <= 2 && validTree(t[2], d - 1) && validTree(t[3], d - 1)
  : Number.isInteger(t) && t >= 0 && t < WAYS.length);
/** loads a kept tree; one of the wrong shape or range is refused and changes nothing. */
export function loadTree(R, k) {
  if (!k || typeof k !== 'object' || !validTree(k.tree, DEPTH) || !Number.isInteger(k.pieces) || k.pieces < 0) return false;
  R.tree = cleanTree(k.tree); R.pieces = k.pieces; return true;
}
/** the root split's feature, or null for a tree that is one leaf. */
const rootOf = (t) => (Array.isArray(t) ? FEATURES[t[0]] : null);
export function rulesOf(R) {
  const g = gainOf(R), hit = mean(R.hits.tree);
  return { pieces: R.pieces, scored: R.scored, leaves: leaves(R.tree), root: rootOf(R.tree), right: hit == null ? null : r3(hit), gain: g == null ? null : r3(g), sure: sureOf(R), fed: R.fed };
}

export const rules = {
  id: 'rules', name: 'Rules', job: 'a decision tree that guesses which way your next stroke goes from how the last one went and where it ended',
  // the learning is done as each piece comes (takePiece); the organ asks for a run only to act: after a new piece, while the tree is sure.
  // A tree that is not sure takes no run from the others (scheduleTick skips an organ that rests).
  rests: (b) => !(b.rules.fresh && sureOf(b.rules)),
  want: () => 0.4,
  run(b) {
    const R = b.rules, at = nextOf(R); R.fresh = false; // fed by the stroke memory's pieces (lib/brain-strokes.js sampleStroke cuts them)
    deposit(b.ws, 'memory', at.x, at.y, 0.04, 1.2, 'rules'); R.fed++;
    b.board.rules = { x: at.x, y: at.y, way: WAYS[at.way], gain: gainOf(R), sure: true, tick: b.ticks };
    return 1;
  }
};
