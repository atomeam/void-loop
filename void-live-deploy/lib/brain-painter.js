// brain-painter, Verse Brain's look as code it rewrites, from F322 (self-mutating shader mind, atomeam/a-to-mind.com drafts/). Owner,
// 2026-10-29: "combine all the builds into one entity", "dont fake it". F322's idea: the evolutionary unit is the rendering code itself,
// not numbers fed to fixed code. Here the brain's look is a small program it writes and rewrites:
//   1. a program: a postfix expression over x, y, time, the tissue's activity under each cell, the rhythm's phase there and the distance
//      to where the brain attends, with + - * min max sin cos abs and constants. Every token is a number (a symbol is 100 and up), so a
//      program can be kept and sealed as numbers only. It runs in a small stack interpreter (no eval).
//   2. genetic programming: a population of 8 programs; each run scores the champion again on the brain's last 3 states (they change)
//      together with three children: one fresh random program and two made from the champion (a constant nudged, a symbol swapped or a
//      subtree regrown, or a crossover with a tournament winner). A child takes the champion's place only when it paints better than the
//      champion on those same states; the others replace the worst of the rest when they score higher. Measured against random search
//      given the same number of scored programs, on 40 recorded brains it scored 0.85 against 0.82 (26 wins, 7 losses), and on 30 new
//      brains over 15000 ticks 0.86 against 0.81 (22 wins, 7 losses). An older rule, where the champion was the best of scores taken on
//      older states, did no better than random search (0.83 against 0.81, 18 wins, 11 losses). Every 15 ticks: four programs scored.
//   3. a score of the picture the program paints on a 24 x 16 grid: hue variety, structure (neither flat nor noise), how it follows the
//      tissue's activity, and how it answers the attention moving. A new champion marks where its picture changes most, so attention
//      looks there; the card paints the champion's hues over the tissue.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { GW, GH, RG, RH, deposit } from './brain-workspace.js';

export const PX = 24, PY = 16, POP = 8, ENVS = 3, MAXLEN = 25, PAINT_EVERY = 15, SYM0 = 100, CMAX = 8;
// symbols: arity 0 (inputs), 1, 2
export const SYMS = ['x', 'y', 't', 'a', 'p', 'd', 'sin', 'cos', 'abs', '+', '-', '*', 'min', 'max'];
const AR = { x: 0, y: 0, t: 0, a: 0, p: 0, d: 0, sin: 1, cos: 1, abs: 1, '+': 2, '-': 2, '*': 2, min: 2, max: 2 };
const IN = SYMS.filter((s) => AR[s] === 0), UN = SYMS.filter((s) => AR[s] === 1), BI = SYMS.filter((s) => AR[s] === 2);
const code = (s) => SYM0 + SYMS.indexOf(s);
export const symOf = (tok) => (Number.isInteger(tok) && tok >= SYM0 && tok < SYM0 + SYMS.length ? SYMS[tok - SYM0] : null);
const arity = (tok) => { const s = symOf(tok); return s ? AR[s] : 0; };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** is this a program: numbers only, known symbols or constants in [-8, 8], a stack that never runs short and ends with one value. Pure. */
export function valid(prog) {
  if (!Array.isArray(prog) || !prog.length || prog.length > MAXLEN) return false;
  let h = 0;
  for (const t of prog) {
    if (typeof t !== 'number' || !Number.isFinite(t)) return false;
    if (t >= SYM0) { if (!symOf(t)) return false; const k = arity(t); if (h < k) return false; h += 1 - k; } else if (Math.abs(t) > CMAX) return false; else h++;
  }
  return h === 1;
}
/** where the subtree that ends at i starts (postfix). Pure. */
export function startOf(prog, i) { let need = 1, j = i; while (need > 0 && j >= 0) { need += arity(prog[j]) - 1; j--; } return j + 1; }
/** a random program as a tree up to `depth` deep, in postfix. */
export function grow(r, depth) {
  if (depth <= 0 || r() < 0.3) return r() < 0.75 ? [code(IN[Math.floor(r() * IN.length)])] : [r3((r() - 0.5) * 6)];
  if (r() < 0.35) return [...grow(r, depth - 1), code(UN[Math.floor(r() * UN.length)])];
  return [...grow(r, depth - 1), ...grow(r, depth - 1), code(BI[Math.floor(r() * BI.length)])];
}
/** a child: a constant nudged, a symbol swapped for one of the same arity, or a subtree regrown. Always a valid program. */
export function mutateProg(prog, r) {
  for (let tries = 0; tries < 8; tries++) {
    const p = prog.slice(), i = Math.floor(r() * p.length), u = r();
    if (u < 0.4) { const cs = p.map((t, k) => (t < SYM0 ? k : -1)).filter((k) => k >= 0); if (!cs.length) continue; const k = cs[Math.floor(r() * cs.length)]; p[k] = r3(clamp(p[k] + (r() + r() + r() - 1.5) * 1.2, -CMAX, CMAX)); }
    else if (u < 0.7) { const s = symOf(p[i]), pool = !s || AR[s] === 0 ? IN : AR[s] === 1 ? UN : BI; p[i] = s || r() < 0.5 ? code(pool[Math.floor(r() * pool.length)]) : r3((r() - 0.5) * 6); }
    else { const a = startOf(p, i); p.splice(a, i - a + 1, ...grow(r, 2)); }
    if (valid(p) && p.join() !== prog.join()) return p;
  }
  return prog.slice();
}
/** run a program over the grid. env: { act: Float32Array(PX*PY) 0..1, phase: Float32Array(PX*PY) 0..1, fx, fy, t }. Hues 0..1. Pure. */
export function paint(prog, env, out = new Float32Array(PX * PY)) {
  const st = new Float64Array(MAXLEN + 1);
  for (let j = 0; j < PY; j++) for (let i = 0; i < PX; i++) {
    const c = j * PX + i, x = (i + 0.5) / PX, y = (j + 0.5) / PY; let h = 0;
    for (const tk of prog) {
      const s = tk >= SYM0 ? SYMS[tk - SYM0] : null;
      if (!s) { st[h++] = tk; continue; }
      switch (s) {
        case 'x': st[h++] = x; break; case 'y': st[h++] = y; break; case 't': st[h++] = env.t; break; case 'a': st[h++] = env.act[c]; break;
        case 'p': st[h++] = env.phase[c]; break; case 'd': st[h++] = Math.hypot(x - env.fx, y - env.fy); break;
        case 'sin': st[h - 1] = Math.sin(st[h - 1] * Math.PI); break; case 'cos': st[h - 1] = Math.cos(st[h - 1] * Math.PI); break; case 'abs': st[h - 1] = Math.abs(st[h - 1]); break;
        case '+': h--; st[h - 1] += st[h]; break; case '-': h--; st[h - 1] -= st[h]; break; case '*': h--; st[h - 1] = clamp(st[h - 1] * st[h], -1e6, 1e6); break;
        case 'min': h--; st[h - 1] = Math.min(st[h - 1], st[h]); break; case 'max': h--; st[h - 1] = Math.max(st[h - 1], st[h]); break;
      }
    }
    const v = st[0]; out[c] = Number.isFinite(v) ? v - Math.floor(v) : 0;
  }
  return out;
}
const cdist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
/** how good a picture is, 0..1, and its parts: variety (hue entropy), structure (neighbours differ, but not like noise), follow (the hues
 *  vary with the tissue's activity), answer (the picture changes when the attention moves). `moved` is the same program painted with
 *  the attention elsewhere. Pure. */
export function scoreOf(h, act, moved) {
  const N = PX * PY, bins = new Float64Array(12); for (let c = 0; c < N; c++) bins[Math.min(11, Math.floor(h[c] * 12))]++;
  let ent = 0; for (const n of bins) if (n) { const q = n / N; ent -= q * Math.log(q); } const variety = ent / Math.log(12);
  let nd = 0, nn = 0; for (let j = 0; j < PY; j++) for (let i = 0; i < PX; i++) { const c = j * PX + i; if (i + 1 < PX) { nd += cdist(h[c], h[c + 1]); nn++; } if (j + 1 < PY) { nd += cdist(h[c], h[c + PX]); nn++; } }
  nd /= nn; const structure = clamp(1 - Math.abs(nd - 0.08) / 0.08, 0, 1);
  let ma = 0; for (let c = 0; c < N; c++) ma += act[c]; ma /= N;
  let sa = 0, sc = 0, ss = 0, cc = 0, cs = 0, sx = 0, sy = 0;
  for (let c = 0; c < N; c++) { const da = act[c] - ma, co = Math.cos(h[c] * 6.2832), si = Math.sin(h[c] * 6.2832); sa += da * da; sx += co; sy += si; cc += co * co; ss += si * si; sc += da * co; cs += da * si; }
  const vc = cc - (sx * sx) / N, vs = ss - (sy * sy) / N, rc = sa > 1e-9 && vc > 1e-9 ? sc / Math.sqrt(sa * vc) : 0, rs = sa > 1e-9 && vs > 1e-9 ? cs / Math.sqrt(sa * vs) : 0;
  const follow = clamp(Math.hypot(rc, rs) / Math.SQRT2 * 1.4, 0, 1);
  let md = 0; for (let c = 0; c < N; c++) md += cdist(h[c], moved[c]); const answer = clamp(md / N / 0.1, 0, 1);
  const score = 0.3 * variety + 0.25 * structure + 0.3 * follow + 0.15 * answer;
  return { score, variety, structure, follow, answer };
}
/** what a program sees of the brain now: the tissue and the rhythm sampled onto the grid, the attention, time. Pure on b. */
export function envOf(b, out = { act: new Float32Array(PX * PY), phase: new Float32Array(PX * PY) }) {
  const L = b.ws.layers.act, ph = b.ws.phase;
  for (let j = 0; j < PY; j++) for (let i = 0; i < PX; i++) {
    const c = j * PX + i, gx = Math.floor((i + 0.5) / PX * GW), gy = Math.floor((j + 0.5) / PY * GH);
    out.act[c] = clamp(L[gy * GW + gx] * 2.4, 0, 1); out.phase[c] = ph[Math.floor(gy * RH / GH) * RG + Math.floor(gx * RG / GW)];
  }
  out.fx = b.focus.x; out.fy = b.focus.y; out.t = (b.ticks % 600) / 600;
  return out;
}
/** score a program against one or more states of the brain (the mean), so a program that only suits one moment does not win. Pure. */
export function judge(prog, envs) {
  const list = [].concat(envs); let score = 0, variety = 0, structure = 0, follow = 0, answer = 0, h = null;
  for (const env of list) {
    const p = paint(prog, env), m = paint(prog, { ...env, fx: (env.fx + 0.35) % 1, fy: (env.fy + 0.3) % 1 }), s = scoreOf(p, env.act, m);
    score += s.score; variety += s.variety; structure += s.structure; follow += s.follow; answer += s.answer; if (!h) h = p;
  }
  const n = list.length; return { h, score: score / n, variety: variety / n, structure: structure / n, follow: follow / n, answer: answer / n };
}
/** one point of each parent: a subtree of b grafted in place of a subtree of a, when the child stays short enough. */
export function cross(a, b, r) {
  for (let tries = 0; tries < 6; tries++) {
    const i = Math.floor(r() * a.length), j = Math.floor(r() * b.length), ai = startOf(a, i), bj = startOf(b, j);
    const kid = [...a.slice(0, ai), ...b.slice(bj, j + 1), ...a.slice(i + 1)];
    if (valid(kid) && kid.join() !== a.join()) return kid;
  }
  return mutateProg(a, r);
}
const pick = (P) => { let w = Math.floor(P.r() * POP); for (let k = 0; k < 2; k++) { const c = Math.floor(P.r() * POP); if ((P.fit[c] ?? -1) > (P.fit[w] ?? -1)) w = c; } return w; }; // a tournament of 3

/** a new painter: 8 random programs, none scored yet. */
export function makePainter(seed) {
  const r = rng(seed * 2654435 + 17), pop = [];
  while (pop.length < POP) { const p = grow(r, 3); if (valid(p)) pop.push(p); }
  return { pop, fit: new Array(POP).fill(null), champ: 0, gen: 0, since: PAINT_EVERY - 5, r, envs: [], evals: 0, first: null, best: null, last: null };
}
/** the programs as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const programsOf = (P) => ({ pop: P.pop.map((p) => p.slice()), champ: P.champ, gen: P.gen });
/** load kept programs; anything that is not a population of valid programs is refused. Returns true when loaded. */
export function loadPrograms(P, k) {
  if (!k || !Array.isArray(k.pop) || k.pop.length !== POP || !k.pop.every(valid) || !Number.isInteger(k.champ) || k.champ < 0 || k.champ >= POP || !(Number.isInteger(k.gen) && k.gen >= 0)) return false;
  P.pop = k.pop.map((p) => p.slice()); P.champ = k.champ; P.gen = k.gen; P.fit = new Array(POP).fill(null);
  return true;
}
/** the painter's numbers for the self. Pure. */
export function painterOf(P) {
  const c = P.pop[P.champ];
  return { gen: P.gen, tokens: c.length, score: P.last ? r3(P.last.score) : null, first: P.first == null ? null : r3(P.first), best: P.best == null ? null : r3(P.best), evals: P.evals, program: text(c) };
}
/** a program in words, for a person: infix, e.g. "sin(x + a * 2.1)". Pure. */
export function text(prog) {
  const st = []; // each entry: [the words, whether they are a binary sum wrapped in brackets]
  const bare = (e) => (e[1] ? e[0].slice(1, -1) : e[0]);
  for (const t of prog) {
    const s = symOf(t);
    if (!s) st.push([String(t), false]); else if (AR[s] === 0) st.push([s, false]); else if (AR[s] === 1) st.push([s + '(' + bare(st.pop()) + ')', false]);
    else { const q = st.pop(), p = st.pop(); st.push(s === 'min' || s === 'max' ? [s + '(' + bare(p) + ', ' + bare(q) + ')', false] : ['(' + p[0] + ' ' + s + ' ' + q[0] + ')', true]); }
  }
  return st[0] ? bare(st[0]) : '';
}

const fresh = (r) => { let g; do g = grow(r, 3); while (!valid(g)); return g; };
/** one generation on the states in P.envs: score the champion again with three children (one fresh program, two from the champion) on
 *  the same states; the best child that beats the champion becomes champion, and children replace the worst of the rest when they score
 *  higher. Returns the champion's judgement and whether it changed. */
export function evolve(P) {
  P.gen++;
  const r = P.r, champ = judge(P.pop[P.champ], P.envs); P.fit[P.champ] = champ.score; P.evals++;
  const kids = [fresh(r)];
  for (let k = 1; k < 3; k++) kids.push(r() < 0.3 ? cross(P.pop[P.champ], P.pop[pick(P)], r) : mutateProg(P.pop[P.champ], r));
  const js = kids.map((kid) => judge(kid, P.envs)); P.evals += kids.length;
  let win = -1, top = champ.score; js.forEach((k, i) => { if (k.score > top) { top = k.score; win = i; } });
  kids.forEach((kid, i) => {
    let w = -1; for (let j = 0; j < POP; j++) if (j !== P.champ && (w < 0 || (P.fit[j] ?? -1) < (P.fit[w] ?? -1))) w = j;
    if (i === win || js[i].score > (P.fit[w] ?? -1)) { P.pop[w] = kid; P.fit[w] = js[i].score; if (i === win) P.champ = w; }
  });
  const now = win < 0 ? champ : js[win];
  if (P.first == null) P.first = champ.score; P.best = Math.max(P.best ?? 0, now.score);
  P.last = { score: now.score, variety: r3(now.variety), structure: r3(now.structure), follow: r3(now.follow), answer: r3(now.answer) };
  return { now, changed: win >= 0 };
}

export const painter = {
  id: 'painter', name: 'Painter', job: 'paints the brain\'s look with a program it writes, and rewrites the program when a child paints better',
  want: (b) => (b.painter.since >= PAINT_EVERY ? 0.6 : 0.02),
  run(b) {
    const P = b.painter; // P.since counts ticks in stepBrain (lib/brain.js)
    if (P.since < PAINT_EVERY) return 0;
    P.since = 0;
    P.envs.push(envOf(b)); if (P.envs.length > ENVS) P.envs.shift();
    const { now, changed } = evolve(P);
    // a new look draws the eye: attention is pulled to where its picture changes most
    let mx = 0, at = 0; for (let j = 0; j < PY; j++) for (let i = 0; i + 1 < PX; i++) { const c = j * PX + i, d = cdist(now.h[c], now.h[c + 1]) + (j + 1 < PY ? cdist(now.h[c], now.h[c + PX]) : 0); if (d > mx) { mx = d; at = c; } }
    const x = ((at % PX) + 0.5) / PX, y = (Math.floor(at / PX) + 0.5) / PY;
    if (changed) deposit(b.ws, 'input', x, y, 0.1, 2, 'painter');
    b.board.paint = { hues: now.h, gen: P.gen, x, y, changed, tick: b.ticks };
    return 1;
  }
};
