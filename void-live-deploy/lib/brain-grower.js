// brain-grower, Verse Brain's plant: a grammar it rewrites, grown toward what the brain attends to, from F453 (L-system spatial evo mind,
// atomeam/a-to-mind.com drafts/). Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it". F453's idea: the evolving
// unit is a symbolic grammar (an L-system), not numbers fed to a fixed shape; its rules are mutated and spliced. F453 itself raised a
// fitness counter on each click. Here the brain gives the plant a measured job:
//   1. a grammar: the axiom X and two rules, X -> ... and F -> ..., over six symbols (F grow a stem, X a bud, + and - turn, [ and ] a
//      branch), with a turn angle, a stem length, a depth (how many times the rules are applied) and a bend (phototropism). Every part
//      is a number, so a grammar can be kept and sealed as numbers only.
//   2. growth: the rules are applied `depth` times and a turtle draws the result from the bottom middle of the field. Each stem bends
//      toward the brain's attention by the bend gene, so the same grammar grows a different plant when the attention moves.
//   3. light: the attention (a soft spot where the brain looks) and the tissue's life. A plant scores the light at the tips of its
//      branches (each cell once), less a cost for each stem (a plant is not free), against the light of the brightest 30 cells.
//   4. evolution, the painter's rule (lib/brain-painter.js): each run scores the champion again on the brain's last 3 states together with
//      three children (one fresh grammar, two made from the champion: a symbol added, dropped or swapped, a branch added, a gene nudged, or
//      a rule taken from another grammar). A child takes the champion's place only when it scores better on those same states.
//   The tips that reach light feed the tissue there (the input layer), so the plant brings life to what the brain attends to.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const LX = 32, LY = 24, POP = 8, ENVS = 3, MAXR = 16, GROW_EVERY = 20, MAXS = 600, BRIGHT = 30, MAXCHARS = 4000;
export const SYMS = 'FX+-[]', F = 0, X = 1, PLUS = 2, MINUS = 3, OPEN = 4, CLOSE = 5;
export const RANGE = { ang: [8, 45], len: [0.02, 0.1], depth: [2, 5], bend: [0, 0.4] };
const COST = 0.05, SPOT = 0.14; // COST: the light a stem must bring in to pay for itself (light is 0..1 a cell)
const r3 = (v) => Math.round(v * 1000) / 1000;

/** is this a rule: whole numbers 0..5, 1 to MAXR long, brackets that open before they close and all close. Pure. */
export function validRule(rule) {
  if (!Array.isArray(rule) || !rule.length || rule.length > MAXR) return false;
  let open = 0;
  for (const s of rule) { if (!Number.isInteger(s) || s < 0 || s > 5) return false; if (s === OPEN) open++; else if (s === CLOSE && --open < 0) return false; }
  return open === 0;
}
/** is this a grammar: two valid rules and its genes in range. Pure. */
export function valid(g) {
  if (!g || typeof g !== 'object' || !validRule(g.x) || !validRule(g.f)) return false;
  for (const k of Object.keys(RANGE)) { const v = g[k]; if (typeof v !== 'number' || !Number.isFinite(v) || v < RANGE[k][0] || v > RANGE[k][1]) return false; }
  return Number.isInteger(g.depth);
}
/** the grammar in words, e.g. "X -> F[+X]F[-X]+X, F -> FF, 25 degrees". Pure. */
export const text = (g) => 'X -> ' + g.x.map((s) => SYMS[s]).join('') + ', F -> ' + g.f.map((s) => SYMS[s]).join('') + ', ' + Math.round(g.ang) + ' degrees';

/** the string after `depth` applications of the rules to the axiom X, cut at MAXCHARS. Pure. */
export function expand(g) {
  let s = [X];
  for (let d = 0; d < g.depth; d++) {
    const n = []; for (const c of s) { if (c === X) n.push(...g.x); else if (c === F) n.push(...g.f); else n.push(c); if (n.length > MAXCHARS) break; }
    s = n.length > MAXCHARS ? n.slice(0, MAXCHARS) : n;
  }
  return s;
}
/** draw the string with a turtle from the bottom middle, each stem bent toward the attention (fx, fy) by the bend gene. Returns the stems
 *  as x1, y1, x2, y2 in 0..1 (at most MAXS) and the tips (where a branch ends and where the plant ends). Pure. */
export function draw(g, fx, fy) {
  const segs = [], tips = [], stack = [], turn = (g.ang * Math.PI) / 180;
  let x = 0.5, y = 0.98, a = -Math.PI / 2, grew = false;
  for (const c of expand(g)) {
    if (c === F) {
      if (segs.length >= MAXS * 4) break;
      const want = Math.atan2(fy - y, fx - x); let d = want - a; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; a += d * g.bend;
      const nx = x + g.len * Math.cos(a), ny = y + g.len * Math.sin(a); segs.push(x, y, nx, ny); x = nx; y = ny; grew = true;
    } else if (c === PLUS) a -= turn; else if (c === MINUS) a += turn;
    else if (c === OPEN) { stack.push([x, y, a]); grew = false; }
    else if (c === CLOSE) { if (grew) tips.push(x, y); [x, y, a] = stack.pop(); grew = false; }
  }
  if (grew) tips.push(x, y);
  return { segs, tips };
}
/** the light the brain gives: a soft spot where it attends and the tissue's life, on an LX x LY grid. Pure on b. */
export function envOf(b) {
  const light = new Float32Array(LX * LY), A = b.ws.layers.act, GW = 64, GH = 48;
  for (let j = 0; j < LY; j++) for (let i = 0; i < LX; i++) {
    const x = (i + 0.5) / LX, y = (j + 0.5) / LY, gx = Math.floor(x * GW), gy = Math.floor(y * GH);
    light[j * LX + i] = 0.7 * Math.exp(-((x - b.focus.x) ** 2 + (y - b.focus.y) ** 2) / (2 * SPOT * SPOT)) + 0.3 * clamp(A[gy * GW + gx] * 2.4, 0, 1);
  }
  return { light, fx: b.focus.x, fy: b.focus.y, top: topOf(light) };
}
/** the light of the BRIGHT brightest cells: what a plant's tips are measured against. Pure. */
export const topOf = (light) => Array.from(light).sort((p, q) => q - p).slice(0, BRIGHT).reduce((s, v) => s + v, 0) || 1;
/** how well a plant grown in one state gathers its light, 0..1, and its parts. Pure. */
export function scoreIn(g, env) {
  const { segs, tips } = draw(g, env.fx, env.fy), seen = new Set(); let got = 0;
  for (let k = 0; k < tips.length; k += 2) {
    const tx = tips[k], ty = tips[k + 1]; if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue;
    const c = Math.floor(ty * LY) * LX + Math.floor(tx * LX); if (seen.has(c)) continue; seen.add(c); got += env.light[c];
  }
  const top = env.top || topOf(env.light), stems = segs.length / 4;
  return { score: (got - COST * stems) / top, reach: got / top, stems, tips: seen.size, segs, tipXY: tips };
}
/** a grammar's score over the brain's last states (the mean), so a plant that only suits one moment does not win. Pure. */
export function judge(g, envs) {
  const list = [].concat(envs); let score = 0, reach = 0, stems = 0, first = null;
  for (const e of list) { const s = scoreIn(g, e); score += s.score; reach += s.reach; stems += s.stems; if (!first) first = s; }
  const n = list.length; return { score: score / n, reach: reach / n, stems: stems / n, first };
}

/** a random rule: stems, buds and turns with up to two branches. Always valid. */
export function freshRule(r, bud) {
  const out = [], n = 2 + Math.floor(r() * 6), pick = () => [F, F, X, PLUS, MINUS][Math.floor(r() * 5)];
  for (let k = 0; k < n; k++) out.push(pick());
  if (bud && !out.includes(X)) out.push(X);
  for (let k = Math.floor(r() * 3); k > 0 && out.length + 3 <= MAXR; k--) { const at = Math.floor(r() * (out.length + 1)); out.splice(at, 0, OPEN, r() < 0.5 ? PLUS : MINUS, bud ? X : F, CLOSE); }
  return out.length > MAXR ? out.slice(0, MAXR).filter((s) => s !== OPEN && s !== CLOSE) : out;
}
const between = (k, v) => clamp(v, RANGE[k][0], RANGE[k][1]);
/** a random grammar. Always valid. */
export function fresh(r) {
  const g = { x: freshRule(r, true), f: r() < 0.6 ? [F] : freshRule(r, false), ang: r3(between('ang', 12 + r() * 30)), len: r3(between('len', 0.03 + r() * 0.05)), depth: 2 + Math.floor(r() * 3), bend: r3(r() * 0.25) };
  return valid(g) ? g : { x: [F, OPEN, PLUS, X, CLOSE, F, OPEN, MINUS, X, CLOSE, X], f: [F], ang: 25, len: 0.05, depth: 3, bend: 0.1 };
}
const copy = (g) => ({ x: g.x.slice(), f: g.f.slice(), ang: g.ang, len: g.len, depth: g.depth, bend: g.bend });
const same = (a, b) => a.x.join() === b.x.join() && a.f.join() === b.f.join() && a.ang === b.ang && a.len === b.len && a.depth === b.depth && a.bend === b.bend;
/** a child: in one rule a symbol added, dropped or swapped, or a branch added; or a gene nudged. Always a valid grammar. */
export function mutate(g, r) {
  for (let tries = 0; tries < 10; tries++) {
    const c = copy(g), u = r(), key = r() < 0.7 ? 'x' : 'f', rule = c[key], i = Math.floor(r() * rule.length);
    if (u < 0.18) rule.splice(Math.floor(r() * (rule.length + 1)), 0, [F, X, PLUS, MINUS][Math.floor(r() * 4)]);
    else if (u < 0.32) { if (rule[i] !== OPEN && rule[i] !== CLOSE) rule.splice(i, 1); }
    else if (u < 0.5) { if (rule[i] !== OPEN && rule[i] !== CLOSE) rule[i] = [F, X, PLUS, MINUS][Math.floor(r() * 4)]; }
    else if (u < 0.6) rule.splice(Math.floor(r() * (rule.length + 1)), 0, OPEN, r() < 0.5 ? PLUS : MINUS, key === 'x' ? X : F, CLOSE);
    else if (u < 0.72) c.ang = r3(between('ang', c.ang + (r() - 0.5) * 12));
    else if (u < 0.82) c.len = r3(between('len', c.len * (0.75 + r() * 0.5)));
    else if (u < 0.92) c.bend = r3(between('bend', c.bend + (r() - 0.5) * 0.15));
    else c.depth = between('depth', c.depth + (r() < 0.5 ? -1 : 1));
    if (valid(c) && !same(c, g)) return c;
  }
  return copy(g);
}
/** a child of two grammars: one rule from each, the genes of the first. */
export function cross(a, b, r) { const c = copy(a); if (r() < 0.5) c.x = b.x.slice(); else c.f = b.f.slice(); return valid(c) && !same(c, a) ? c : mutate(a, r); }
const pick = (G) => { let w = Math.floor(G.r() * POP); for (let k = 0; k < 2; k++) { const c = Math.floor(G.r() * POP); if ((G.fit[c] ?? -1) > (G.fit[w] ?? -1)) w = c; } return w; }; // a tournament of 3

/** a new grower: 8 random grammars, none scored yet. */
export function makeGrower(seed) {
  const r = rng(seed * 40503 + 29), pop = [];
  while (pop.length < POP) pop.push(fresh(r));
  return { pop, fit: new Array(POP).fill(null), champ: 0, gen: 0, since: GROW_EVERY - 7, r, envs: [], evals: 0, first: null, best: null, last: null, fed: 0 };
}
/** one generation on the states in G.envs: the champion scored again with three children on the same states; the best child that beats
 *  the champion becomes champion, and children replace the worst of the rest when they score higher. */
export function evolve(G) {
  G.gen++;
  const r = G.r, champ = judge(G.pop[G.champ], G.envs); G.fit[G.champ] = champ.score; G.evals++;
  const kids = [fresh(r)];
  for (let k = 1; k < 3; k++) kids.push(r() < 0.25 ? cross(G.pop[G.champ], G.pop[pick(G)], r) : mutate(G.pop[G.champ], r));
  const js = kids.map((kid) => judge(kid, G.envs)); G.evals += kids.length;
  let win = -1, top = champ.score; js.forEach((k, i) => { if (k.score > top) { top = k.score; win = i; } });
  kids.forEach((kid, i) => {
    let w = -1; for (let j = 0; j < POP; j++) if (j !== G.champ && (w < 0 || (G.fit[j] ?? -1) < (G.fit[w] ?? -1))) w = j;
    if (i === win || js[i].score > (G.fit[w] ?? -1)) { G.pop[w] = kid; G.fit[w] = js[i].score; if (i === win) G.champ = w; }
  });
  const now = win < 0 ? champ : js[win];
  if (G.first == null) G.first = champ.score; G.best = Math.max(G.best ?? -1, now.score);
  G.last = { score: r3(now.score), reach: r3(now.reach), stems: Math.round(now.stems) };
  return { now, changed: win >= 0 };
}
/** the grammars as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const grammarsOf = (G) => ({ pop: G.pop.map(copy), champ: G.champ, gen: G.gen });
/** load kept grammars; anything that is not a population of valid grammars is refused and changes nothing. Returns true when loaded. */
export function loadGrammars(G, k) {
  if (!k || !Array.isArray(k.pop) || k.pop.length !== POP || !k.pop.every(valid) || !Number.isInteger(k.champ) || k.champ < 0 || k.champ >= POP || !(Number.isInteger(k.gen) && k.gen >= 0)) return false;
  G.pop = k.pop.map(copy); G.champ = k.champ; G.gen = k.gen; G.fit = new Array(POP).fill(null);
  return true;
}
/** the grower's numbers for the self. Pure. */
export function growerOf(G) {
  return { gen: G.gen, grammar: text(G.pop[G.champ]), score: G.last ? G.last.score : null, reach: G.last ? G.last.reach : null, stems: G.last ? G.last.stems : null, first: G.first == null ? null : r3(G.first), best: G.best == null ? null : r3(G.best), evals: G.evals, fed: G.fed };
}

export const grower = {
  id: 'grower', name: 'Grower', job: 'grows a plant from a grammar it rewrites, bent toward what the brain attends to, and feeds the tissue where its tips reach light',
  want: (b) => (b.grower.since >= GROW_EVERY ? 0.6 : 0.02),
  run(b) {
    const G = b.grower; // G.since counts ticks in stepBrain (lib/brain.js)
    if (G.since < GROW_EVERY) return 0;
    G.since = 0;
    const env = envOf(b); G.envs.push(env); if (G.envs.length > ENVS) G.envs.shift();
    const { changed } = evolve(G), now = scoreIn(G.pop[G.champ], env);
    // the brightest tips feed the tissue: up to 4 small drops of fresh life where the plant reaches light
    const lit = []; for (let k = 0; k < now.tipXY.length; k += 2) { const x = now.tipXY[k], y = now.tipXY[k + 1]; if (x >= 0 && x < 1 && y >= 0 && y < 1) lit.push([env.light[Math.floor(y * LY) * LX + Math.floor(x * LX)], x, y]); }
    lit.sort((p, q) => q[0] - p[0]); for (const [v, x, y] of lit.slice(0, 4)) if (v > 0.3) { deposit(b.ws, 'input', x, y, 0.06, 1, 'grower'); G.fed++; }
    b.board.grow = { segs: Float32Array.from(now.segs), gen: G.gen, reach: now.reach, tips: now.tips, changed, x: lit.length ? lit[0][1] : 0.5, y: lit.length ? lit[0][2] : 0.9, tick: b.ticks };
    return 1;
  }
};
