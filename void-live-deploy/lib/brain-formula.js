// brain-formula, Verse Brain's own formula for its tissue, from F451 (expression-tree spatial evo mind, atomeam/a-to-mind.com drafts/).
// Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it". F451's idea: the evolving unit is a formula, a tree of
// operations over x, y and time, not a fixed shape with numbers in it; F451 mutated the tree and raised a fitness counter on each click.
// Here the brain gives the formula a measured job:
//   1. a formula: a tree of at most MAXN nodes over eight things the brain can see at one place of its tissue: the life there now (a), the
//      substrate it feeds on (s), the fresh input (i), the memory (m), how far the place is from where the brain attends (d), x, y, and the
//      mean life 2 cells away (n). Operations: + - *, min, max and tanh (no divide: a divide by a small number made formulas that only fit
//      the moment). Every node is a number, so a formula can be kept and sealed as numbers only.
//   2. its job: say how the life at each of 108 places will change in GAP ticks. The rule is "life next = life now + k0 + k1 x formula",
//      with k0 and k1 fitted by least squares on the last ENVS changes, so the empty formula is "nothing changes". Skill is 1 less the
//      squared error over the error of "nothing changes". A formula is judged on a change BEFORE it sees it (with its old k0 and k1), and
//      the champion the brain uses is the one with the best mean of those tests: skill on changes it had not seen, not a fit.
//   3. evolution, the painter's rule (lib/brain-painter.js): each change, KIDS children (one fresh formula, the rest a branch grown again,
//      a node changed, a constant nudged, or a branch taken from another formula) replace the formula that fits the last changes worst
//      when they fit them better.
//   Measured on 16 real brains (80 changes each, mean tested skill over the last 40): skill above "nothing changes" on 16 of 16 brains,
//   mean 0.10 (up to 0.26); evolution beat random search with the same number of scorings on 11 of 16, mean +0.03. The formulas found the
//   tissue's rule by themselves: life grows with its food (s) and the life around it (n), for example "life next = life now - 0.42 +
//   0.75 x (n + tanh(tanh(tanh(s))))". It costs about 1.3-5 ms a run, one run every GAP ticks.
//   The places where the formula expects the most new life feed the tissue there (the input layer) a little before it arrives, so the
//   brain acts on what it understands of itself, and the self says the formula in words.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit, GW, GH } from './brain-workspace.js';

export const POP = 12, ENVS = 6, KIDS = 12, CMAX = 3, MAXN = 15, MAXD = 4, GAP = 20, SX = 12, SY = 9, VARS = 'asimdxyn', NV = 8;
export const OPS = ['+', '-', '*', 'min', 'max', 'tanh'];
const NODE_COST = 0.004, ARITY = [2, 2, 2, 2, 2, 1];
const r3 = (v) => Math.round(v * 1000) / 1000;

// a node is a plain object of numbers: { o, a, b } an operation, { v } one of VARS, or { c } a constant in -CMAX..CMAX
/** the number of nodes in a tree, or Infinity when it is not a tree. Pure. */
export function size(t, depth = 0) {
  if (!t || typeof t !== 'object' || depth > MAXD + 1) return Infinity;
  if ('c' in t) return typeof t.c === 'number' && Number.isFinite(t.c) && t.c >= -CMAX && t.c <= CMAX ? 1 : Infinity;
  if ('v' in t) return Number.isInteger(t.v) && t.v >= 0 && t.v < VARS.length ? 1 : Infinity;
  if (!Number.isInteger(t.o) || t.o < 0 || t.o >= OPS.length) return Infinity;
  return 1 + size(t.a, depth + 1) + (ARITY[t.o] === 2 ? size(t.b, depth + 1) : 0);
}
/** is this a formula the brain can use: a tree of at most MAXN nodes. Pure. */
export const valid = (t) => size(t) <= MAXN;
/** the formula in words, e.g. "max(a, tanh(i - d))". Pure. */
export function text(t) {
  if ('c' in t) return String(Math.round(t.c * 100) / 100);
  if ('v' in t) return VARS[t.v];
  const op = OPS[t.o];
  if (ARITY[t.o] === 1) return op + '(' + text(t.a) + ')';
  if (op === 'min' || op === 'max') return op + '(' + text(t.a) + ', ' + text(t.b) + ')';
  return '(' + text(t.a) + ' ' + op + ' ' + text(t.b) + ')';
}
/** the formula's value at one place, f = [a, s, i, m, d, x, y, n]. Pure. */
export function value(t, f) {
  if ('c' in t) return t.c;
  if ('v' in t) return f[t.v];
  const p = value(t.a, f);
  switch (t.o) {
    case 0: return p + value(t.b, f);
    case 1: return p - value(t.b, f);
    case 2: return p * value(t.b, f);
    case 3: return Math.min(p, value(t.b, f));
    case 4: return Math.max(p, value(t.b, f));
    default: return Math.tanh(p);
  }
}
const P = SX * SY;
/** the formula's value at every sample place at once, X holding NV numbers a place (as seeOf makes them). Not finite values become 0. */
export function many(t, X) {
  const out = new Float64Array(P);
  if ('c' in t) return out.fill(t.c);
  if ('v' in t) { for (let p = 0; p < P; p++) out[p] = X[p * NV + t.v]; return out; }
  const A = many(t.a, X);
  if (ARITY[t.o] === 1) { for (let p = 0; p < P; p++) out[p] = Math.tanh(A[p]); return out; }
  const Bv = many(t.b, X);
  for (let p = 0; p < P; p++) { const v = t.o === 0 ? A[p] + Bv[p] : t.o === 1 ? A[p] - Bv[p] : t.o === 2 ? A[p] * Bv[p] : t.o === 3 ? Math.min(A[p], Bv[p]) : Math.max(A[p], Bv[p]); out[p] = Number.isFinite(v) ? v : 0; }
  return out;
}
/** what the life will be by a formula and its fitted scale: the life now, plus k0, plus k1 times the formula, clamped to the range life
 *  has. Pure. */
export const predict = (t, f, ab) => { const v = value(t, f); return Number.isFinite(v) ? clamp(f[0] + ab[0] + ab[1] * v, 0, 1) : clamp(f[0] + ab[0], 0, 1); };
/** what the brain shows at the SX x SY sample places: NV numbers a place (VARS). Pure on b. */
export function seeOf(b) {
  const L = b.ws.layers, f = new Float32Array(SX * SY * NV);
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
    const x = (i + 0.5) / SX, y = (j + 0.5) / SY, c = Math.floor(y * GH) * GW + Math.floor(x * GW), k = (j * SX + i) * NV;
    const gx = Math.floor(x * GW), gy = Math.floor(y * GH), at = (dx, dy) => L.act[clamp(gy + dy, 0, GH - 1) * GW + clamp(gx + dx, 0, GW - 1)];
    f[k] = L.act[c]; f[k + 1] = L.sub[c]; f[k + 2] = L.input[c]; f[k + 3] = L.memory[c]; f[k + 4] = Math.hypot(x - b.focus.x, y - b.focus.y); f[k + 5] = x; f[k + 6] = y;
    f[k + 7] = (at(-2, 0) + at(2, 0) + at(0, -2) + at(0, 2)) / 4;
  }
  return f;
}
/** one change to learn from: what the brain showed, and the life GAP ticks later at the same places. */
export const changeOf = (before, after) => {
  const want = new Float32Array(SX * SY); let base = 0;
  for (let p = 0; p < SX * SY; p++) { want[p] = after[p * NV]; base += (want[p] - before[p * NV]) ** 2; }
  return { f: before, want, base: base / (SX * SY) };
};
/** the scale that fits a formula best to some changes: k0 and k1 by least squares on the change in life (the formula models the change,
 *  so the empty formula is "nothing changes"). Pure. */
export function fit(t, changes) {
  let n = 0, sv = 0, sy = 0, svv = 0, svy = 0;
  for (const ch of [].concat(changes)) {
    const V = many(t, ch.f);
    for (let p = 0; p < P; p++) { const v = V[p], y = ch.want[p] - ch.f[p * NV]; n++; sv += v; sy += y; svv += v * v; svy += v * y; }
  }
  const den = n * svv - sv * sv, k1 = Math.abs(den) < 1e-9 ? 0 : clamp((n * svy - sv * sy) / den, -CMAX, CMAX), k0 = clamp((sy - k1 * sv) / Math.max(n, 1), -1, 1);
  return [k0, k1];
}
/** how well a formula with a given scale says one change: its squared error. Pure. */
export function errIn(t, ch, ab) {
  const V = many(t, ch.f); let e = 0;
  for (let p = 0; p < P; p++) e += (clamp(ch.f[p * NV] + ab[0] + ab[1] * V[p], 0, 1) - ch.want[p]) ** 2;
  return e / P;
}
/** a formula's skill over some changes: 1 less its error over the error of "nothing changes" (summed over the changes), less the cost of
 *  its nodes. The scale is fitted on the same changes unless one is given (to judge a formula on changes it never saw). Pure. */
export function judge(t, changes, ab) {
  const list = [].concat(changes), k = ab || fit(t, list); let e = 0, base = 0;
  for (const ch of list) { e += errIn(t, ch, k); base += ch.base; }
  const skill = 1 - e / Math.max(base, 1e-9);
  return { score: skill - NODE_COST * size(t), skill, err: e / list.length, base: base / list.length, ab: k };
}

/** a random tree of at most `depth` levels. Always valid. */
export function grow(r, depth = MAXD) {
  if (depth <= 1 || r() < 0.3) return r() < 0.7 ? { v: Math.floor(r() * VARS.length) } : { c: r3((r() * 2 - 1) * CMAX) };
  const o = Math.floor(r() * OPS.length), n = { o, a: grow(r, depth - 1) };
  if (ARITY[o] === 2) n.b = grow(r, depth - 1);
  return n;
}
/** a random formula. Always valid. */
export function fresh(r) { for (let k = 0; k < 20; k++) { const t = grow(r, 2 + Math.floor(r() * (MAXD - 1))); if (valid(t)) return t; } return { v: 0 }; }
const copy = (t) => JSON.parse(JSON.stringify(t));
/** the paths to every node, as lists of 'a' and 'b'. Pure. */
function paths(t, at = [], out = []) { out.push(at); if (t.a) paths(t.a, at.concat('a'), out); if (t.b) paths(t.b, at.concat('b'), out); return out; }
const get = (t, p) => p.reduce((n, k) => n[k], t);
function put(t, p, n) { if (!p.length) return n; const root = copy(t), parent = get(root, p.slice(0, -1)); parent[p[p.length - 1]] = n; return root; }
const depthAt = (p) => MAXD - p.length;
/** a child: a branch grown again, a node changed, or a constant nudged. Always a valid formula that differs from its parent. */
export function mutate(t, r) {
  const before = JSON.stringify(t);
  for (let tries = 0; tries < 12; tries++) {
    const all = paths(t), p = all[Math.floor(r() * all.length)], n = get(t, p), u = r(); let c;
    if (u < 0.45) c = put(t, p, grow(r, Math.max(1, depthAt(p))));
    else if ('c' in n) c = put(t, p, { c: r3(clamp(n.c * (r() < 0.5 ? 0.8 + r() * 0.4 : 1) + (r() - 0.5) * 0.4, -CMAX, CMAX)) });
    else if ('v' in n) c = put(t, p, { v: Math.floor(r() * VARS.length) });
    else { const o = Math.floor(r() * OPS.length), m = { o, a: copy(n.a) }; if (ARITY[o] === 2) m.b = n.b ? copy(n.b) : grow(r, 1); c = put(t, p, m); }
    if (valid(c) && JSON.stringify(c) !== before) return c;
  }
  return fresh(r);
}
/** a child of two formulas: a branch of the second put in place of a branch of the first. */
export function cross(a, b, r) {
  for (let tries = 0; tries < 8; tries++) {
    const pa = paths(a), pb = paths(b), p = pa[Math.floor(r() * pa.length)], q = pb[Math.floor(r() * pb.length)], c = put(a, p, copy(get(b, q)));
    if (valid(c) && JSON.stringify(c) !== JSON.stringify(a)) return c;
  }
  return mutate(a, r);
}
const pick = (S) => { let w = Math.floor(S.r() * POP); for (let k = 0; k < 2; k++) { const c = Math.floor(S.r() * POP); if (S.win[c] > S.win[w]) w = c; } return w; }; // a tournament of 3
const MIN_TESTS = 3, KEEP = 0.85;

/** a new formula keeper: POP random formulas, none tested yet. With blind set, its children are all fresh formulas (random search): the
 *  control it is measured against. */
export function makeFormula(seed, blind = false) {
  const r = rng(seed * 52711 + 41), pop = [];
  while (pop.length < POP) pop.push(fresh(r));
  return { pop, ab: pop.map(() => [0, 0]), win: new Array(POP).fill(-9), test: new Array(POP).fill(0), tests: new Array(POP).fill(0), champ: 0, gen: 0,
    since: GAP - 9, r, blind, seen: null, changes: [], evals: 0, first: null, best: null, last: null, said: [], fed: 0 };
}
/** one change seen: every formula is first tested on it with the scale it had BEFORE the change (a prediction, not a fit), and keeps a
 *  slow mean of those tests; then the scales are fitted again on the last ENVS changes, KIDS children are bred from the formulas that fit
 *  those changes best, and a child takes the place of the formula that fits them worst when it fits them better. The champion, the formula
 *  the brain uses and says, is the one with the best tested mean after at least MIN_TESTS tests. */
export function step(S, ch) {
  S.gen++;
  const r = S.r;
  if (S.changes.length) {
    for (let j = 0; j < POP; j++) {
      const s = clamp(1 - errIn(S.pop[j], ch, S.ab[j]) / Math.max(ch.base, 1e-9), -1, 1);
      S.test[j] = S.tests[j] ? KEEP * S.test[j] + (1 - KEEP) * s : s; S.tests[j]++;
      if (j === S.champ) { S.last = { skill: r3(s), mean: r3(S.test[j]) }; S.said.push(s); if (S.said.length > 50) S.said.shift(); }
    }
    S.evals += POP;
  }
  S.changes.push(ch); if (S.changes.length > ENVS) S.changes.shift();
  for (let j = 0; j < POP; j++) { const k = judge(S.pop[j], S.changes); S.ab[j] = k.ab; S.win[j] = k.score; }
  S.evals += POP;
  for (let k = 0; k < KIDS; k++) {
    const kid = S.blind || k === 0 ? fresh(r) : r() < 0.3 ? cross(S.pop[pick(S)], S.pop[pick(S)], r) : mutate(S.pop[pick(S)], r), got = judge(kid, S.changes);
    S.evals++;
    let w = -1; for (let j = 0; j < POP; j++) if (j !== S.champ && (w < 0 || S.win[j] < S.win[w])) w = j;
    if (got.score > S.win[w]) { S.pop[w] = kid; S.ab[w] = got.ab; S.win[w] = got.score; S.test[w] = 0; S.tests[w] = 0; }
  }
  let c = -1; for (let j = 0; j < POP; j++) if (S.tests[j] >= MIN_TESTS && (c < 0 || S.test[j] > S.test[c])) c = j;
  if (c < 0) for (let j = 0; j < POP; j++) if (c < 0 || S.win[j] > S.win[c]) c = j;
  const changed = c !== S.champ; S.champ = c;
  if (S.last) { if (S.first == null) S.first = S.last.mean; S.best = Math.max(S.best ?? -9, S.last.mean); }
  return { changed, skill: S.tests[c] ? S.test[c] : S.win[c] };
}
/** the champion's mean tested skill over its last (up to 50) changes: how well the formula the brain used said what came next. Pure. */
export const saidOf = (S) => (S.said.length ? S.said.reduce((a, v) => a + v, 0) / S.said.length : null);
/** the formulas as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const formulasOf = (S) => ({ pop: S.pop.map(copy), champ: S.champ, gen: S.gen });
/** load kept formulas; anything that is not a population of valid formulas is refused and changes nothing. Returns true when loaded. */
export function loadFormulas(S, k) {
  if (!k || !Array.isArray(k.pop) || k.pop.length !== POP || !k.pop.every(valid) || !Number.isInteger(k.champ) || k.champ < 0 || k.champ >= POP || !(Number.isInteger(k.gen) && k.gen >= 0)) return false;
  S.pop = k.pop.map(copy); S.champ = k.champ; S.gen = k.gen; S.ab = S.pop.map(() => [0, 0]); S.win.fill(-9); S.test.fill(0); S.tests.fill(0);
  return true;
}
/** the whole rule in words: "life next = life now + k0 + k1 x formula". Pure. */
export const ruleText = (t, ab) => 'life next = life now ' + (ab[0] < 0 ? '- ' : '+ ') + Math.abs(Math.round(ab[0] * 1000) / 1000) + (ab[1] < 0 ? ' - ' : ' + ') + Math.abs(Math.round(ab[1] * 100) / 100) + ' x ' + text(t);
/** the formula keeper's numbers for the self. Pure. */
export function formulaOf(S) {
  return { gen: S.gen, formula: text(S.pop[S.champ]), rule: ruleText(S.pop[S.champ], S.ab[S.champ]), nodes: size(S.pop[S.champ]), skill: S.last ? S.last.mean : null, said: saidOf(S) == null ? null : r3(saidOf(S)), first: S.first == null ? null : r3(S.first), best: S.best == null ? null : r3(S.best), evals: S.evals, fed: S.fed };
}

export const formula = {
  id: 'formula', name: 'Formula', job: 'evolves a formula that says how its own tissue will change, scored against "nothing changes", and primes the places where it expects new life',
  want: (b) => (b.formula.since >= GAP ? 0.6 : 0.02),
  run(b) {
    const S = b.formula; // S.since counts ticks in stepBrain (lib/brain.js)
    if (S.since < GAP) return 0;
    S.since = 0;
    const now = seeOf(b);
    if (!S.seen) { S.seen = now; return 1; }
    const { changed, skill } = step(S, changeOf(S.seen, now)), t = S.pop[S.champ], ab = S.ab[S.champ];
    // where the formula expects the most new life GAP ticks from now, and only when it has skill: up to 3 small drops before it arrives
    const rise = [], V = many(t, now);
    if (skill > 0) for (let p = 0; p < P; p++) { const a = now[p * NV], d = clamp(a + ab[0] + ab[1] * V[p], 0, 1) - a; if (d > 0.02) rise.push([d, now[p * NV + 5], now[p * NV + 6]]); }
    rise.sort((p, q) => q[0] - p[0]); for (const [, x, y] of rise.slice(0, 3)) { deposit(b.ws, 'input', x, y, 0.05, 1, 'formula'); S.fed++; }
    S.seen = now;
    b.board.formula = { text: ruleText(t, ab), skill, changed, x: rise.length ? rise[0][1] : 0.5, y: rise.length ? rise[0][2] : 0.5, rising: rise.length, tick: b.ticks };
    return 1;
  }
};
