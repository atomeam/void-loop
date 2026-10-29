/**
 * formula-engine: a formula written once, as its equation, its variables (each a quantity of a kind with the unit it is shown in) and the source
 * it comes from, then worked for any one of its variables. 'A = pi*d*l' gives the surface area from the diameter and length, the diameter from
 * the area and length, and the length from the area and diameter, each in any unit of its kind, from that one definition. The left side is
 * worked out directly; any other variable is solved for numerically (a secant search from its example value, then a bracketing scan and
 * bisection), so every direction comes from the same equation and none is typed in twice. The right side is checked against the left side's
 * dimension when the formula is defined, so a formula with a unit slip cannot ship. A formula whose constants only hold in set units (a fixed
 * formula, like BMR in kg and cm) is worked in the units its variables name. compile() makes the calculators /calculators/ runs. Pure.
 * Tests: tools/formula-engine.test.mjs; every formula's worked example: tools/formulas.test.mjs.
 */
import { KINDS, unitOf, toSI, fromSI, parse, evaluate, namesIn, sameDim, dimText } from './calc-units.js';

const PLAIN = new Set(['number', 'ratio', 'angle']);
// kinds whose values can be below zero; a variable of any other kind is solved for among the positive numbers only
const SIGNED = new Set(['number', 'money', 'temperature', 'tempdiff', 'angle', 'ratio', 'voltage', 'current', 'charge', 'momentum', 'speed', 'acceleration', 'force', 'energy', 'power', 'torque']);

/** 'k|Label|kind|unit|example' read into { k, label, kind, unit, v }; throws on an unknown kind or unit. Pure. */
export function readVar(s) {
  const [k, label, kind, unit = '', v = ''] = String(s).split('|');
  if (!KINDS[kind]) throw new Error('no kind "' + kind + '" for ' + k);
  if (!unitOf(kind, unit)) throw new Error('no unit "' + unit + '" of ' + kind + ' for ' + k);
  return { k, label, kind, unit, v };
}
const vsplit = (vars) => (Array.isArray(vars) ? vars : String(vars).split(/\s*;\s*/)).filter(Boolean).map(readVar);

/**
 * one formula's definition checked and made ready: { id, name, cat, eq, src, vars: 'k|Label|kind|unit|example; …', want, fixed, solve }.
 * eq is 'lhs = rhs' with one variable on the left. want is the left side at the examples, in its unit (the worked example its test checks).
 * solve lists the variables it may be solved for (all of them when left out). Throws, naming the formula, on anything that does not fit. Pure.
 */
export function define(d) {
  const at = 'formula ' + d.id + ': ';
  const m = /^\s*([A-Za-z_\u0370-\u03ff][\w\u0370-\u03ff]*)\s*=(.*)$/.exec(String(d.eq || ''));
  if (!m) throw new Error(at + 'write the equation as "result = formula"');
  const lhs = m[1], rhs = m[2].trim(), vars = vsplit(d.vars), by = Object.fromEntries(vars.map((v) => [v.k, v]));
  if (!by[lhs]) throw new Error(at + 'the result "' + lhs + '" is not one of its variables');
  let tree; try { tree = parse(rhs); } catch (e) { throw new Error(at + e.message); }
  const names = namesIn(rhs, by);
  for (const n of names) if (!by[n]) throw new Error(at + '"' + n + '" is not one of its variables');
  for (const v of vars) if (v.k !== lhs && !names.includes(v.k)) throw new Error(at + 'the variable "' + v.k + '" is not in the formula');
  for (const v of vars) if (v.k !== lhs && (v.v === '' || !Number.isFinite(Number(v.v)))) throw new Error(at + 'the variable "' + v.k + '" needs an example value');
  if (!Number.isFinite(Number(d.want))) throw new Error(at + 'needs its worked example (want)');
  if (!d.src) throw new Error(at + 'needs a source');
  // the dimension check: the right side worked on each variable's dimension must be the left side's (a fixed formula is in set units: skipped)
  if (!d.fixed) {
    const q = Object.fromEntries(vars.map((v) => [v.k, { v: 1.2345, d: KINDS[v.kind].dim }]));
    let got; try { got = evaluate(tree, q); } catch (e) { throw new Error(at + e.message); }
    if (!sameDim(got.d, KINDS[by[lhs].kind].dim)) throw new Error(at + 'the right side is ' + (dimText(got.d) || 'a plain number') + ' but ' + lhs + ' is ' + KINDS[by[lhs].kind].name.toLowerCase());
  }
  const solve = d.solve ? d.solve.split(/[\s,]+/) : vars.map((v) => v.k);
  for (const k of solve) if (!by[k]) throw new Error(at + 'cannot solve for "' + k + '": not a variable');
  if (solve[0] !== lhs && !solve.includes(lhs)) solve.unshift(lhs);
  return { id: d.id, name: d.name, cat: d.cat, eq: d.eq, src: d.src, lhs, rhs, tree, vars, by, want: Number(d.want), fixed: !!d.fixed, solve, also: d.also || '' };
}

// a variable's value in the units the formula is worked in (SI, or its own unit for a fixed formula), and back
const into = (def, k, si) => (def.fixed ? fromSI(si, unitOf(def.by[k].kind, def.by[k].unit)) : si);
const outOf = (def, k, x) => (def.fixed ? toSI(x, unitOf(def.by[k].kind, def.by[k].unit)) : x);
const rhsAt = (def, vals) => evaluate(def.tree, Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, { v, d: def.fixed ? KINDS.number.dim : KINDS[def.by[k].kind].dim }]))).v;

/** a root of g near x0: a secant search, then a scan over magnitudes for a sign change and bisection; NaN when there is none. g.scale (1 when unset) is the size a residual is measured against. Pure. */
export function root(g, x0, { positive = false } = {}) {
  const ok = (x) => Number.isFinite(x) && (!positive || x > 0);
  const tiny = (x, gx) => gx === 0 || Math.abs(gx) <= 1e-11 * Math.max(Math.abs(g.scale ?? 1), 1e-300);
  // 1) secant from the example value
  let a = Number.isFinite(x0) && x0 !== 0 ? x0 : 1, b = a * 1.001 + (a === 0 ? 1e-3 : 0), ga = g(a), gb = g(b);
  // a small residual only counts once the steps have settled too, so a curve flattening towards an asymptote (1/x as x grows) is not a root
  const settled = (b, a, gb) => gb === 0 || Math.abs(b - a) <= 1e-7 * Math.abs(b);
  for (let i = 0; i < 80 && ok(b) && Number.isFinite(gb); i++) {
    if (tiny(b, gb) && settled(b, a, gb)) return b;
    if (gb === ga) break;
    let c = b - (gb * (b - a)) / (gb - ga);
    if (positive && c <= 0) c = b / 10;
    a = b; ga = gb; b = c; gb = g(b);
    if (Math.abs(b - a) <= 1e-15 * Math.abs(b) && Number.isFinite(gb) && tiny(b, gb * 1e-4)) return b;
  }
  if (ok(b) && Number.isFinite(gb) && tiny(b, gb) && settled(b, a, gb)) return b;
  // 2) a sign change among values from 1e-30 to 1e30 (and their negatives), the one nearest the example first
  const pts = [];
  for (let e = -120; e <= 120; e++) { const x = 10 ** (e / 4); pts.push(x); }
  const sides = positive ? [pts] : [pts, pts.map((x) => -x).reverse()];
  const pairs = [];
  for (const xs of sides) for (let i = 1; i < xs.length; i++) { const p = xs[i - 1], q = xs[i], gp = g(p), gq = g(q); if (Number.isFinite(gp) && Number.isFinite(gq) && Math.sign(gp) !== Math.sign(gq)) pairs.push([p, q, gp]); }
  if (!positive) { const g0 = g(0); if (g0 === 0) return 0; }
  const far = (x) => Math.abs(Math.log(Math.abs(x) || 1e-300) - Math.log(Math.abs(x0) || 1)) + (Math.sign(x) !== Math.sign(x0 || 1) ? 100 : 0);
  pairs.sort((u, v) => far(u[0]) - far(v[0]));
  for (const [p0, q0, gp0] of pairs) {
    let p = p0, q = q0, gp = gp0;
    for (let i = 0; i < 400; i++) { const mid = (p + q) / 2, gm = g(mid); if (!Number.isFinite(gm)) break; if (gm === 0 || Math.abs(q - p) <= 1e-16 * Math.abs(mid)) { p = q = mid; break; } if (Math.sign(gm) === Math.sign(gp)) { p = mid; gp = gm; } else q = mid; }
    const x = (p + q) / 2, gx = g(x);
    if (Number.isFinite(gx) && Math.abs(gx) <= 1e-8 * Math.max(Math.abs(g.scale ?? 1), 1e-300)) return x; // a sign change across a pole is not a root
  }
  return NaN;
}

/** the value of `target` (SI) from the others (SI values by key); throws in words when it has none. Pure. */
export function solve(def, target, si) {
  const vals = {}; for (const v of def.vars) if (v.k !== target) vals[v.k] = into(def, v.k, si[v.k]);
  if (target === def.lhs) { const r = rhsAt(def, vals); if (!Number.isFinite(r)) throw new Error('no answer for these values'); return outOf(def, target, r); }
  const L = vals[def.lhs], tv = def.by[target];
  const g = (x) => { try { return rhsAt(def, { ...vals, [target]: x }) - L; } catch (_) { return NaN; } };
  g.scale = Math.abs(L) || 1;
  const x0 = def.fixed ? Number(tv.v) : toSI(Number(tv.v), unitOf(tv.kind, tv.unit));
  const x = root(g, x0, { positive: !SIGNED.has(tv.kind) });
  if (!Number.isFinite(x)) throw new Error('no ' + tv.label.toLowerCase() + ' gives ' + def.by[def.lhs].label.toLowerCase() + ' of that value');
  return outOf(def, target, x);
}

/** the equation for people: × for *, π for pi, √ for sqrt, ² and ³ for small powers. Pure. */
export function pretty(eq) {
  return String(eq).replace(/\^2(?![\d.])/g, '²').replace(/\^3(?![\d.])/g, '³').replace(/\s*\*\s*/g, ' × ').replace(/\bpi\b/g, 'π').replace(/\bsqrt\(/g, '√(').replace(/\s*\/\s*/g, ' ÷ ').replace(/-(?=\s)/g, '−');
}

/** a definition's calculator for one target (its left side when left out), in the shape lib/calculators.js runs. Pure. */
export function compile(def, target = def.lhs) {
  if (!def.solve.includes(target)) target = def.lhs;
  const lhsEx = def.want;
  const inputs = def.vars.filter((v) => v.k !== target).map((v) => ({ k: v.k, label: v.label, kind: v.kind, unit: v.unit, v: v.k === def.lhs ? String(+lhsEx.toPrecision(10)) : v.v }));
  const t = def.by[target];
  const outputs = [{ k: t.k, label: t.label, kind: t.kind === 'number' ? 'number' : t.kind, unit: t.kind === 'number' ? '' : t.unit, sfx: t.kind === 'number' ? t.unit : undefined }];
  const formula = pretty(def.eq) + (target === def.lhs ? '' : ' (solved for ' + t.k + ')');
  return { id: def.id, name: def.name, cat: def.cat, formula, src: def.src, also: def.also, inputs, outputs, def, target, solveFor: def.solve.map((k) => [k, def.by[k].label]), f: (x) => ({ [target]: solve(def, target, x) }) };
}
/** every definition compiled, each for its left side; throws on a repeated id. Pure. */
export function compileAll(defs) {
  const seen = new Set();
  return defs.map((d) => { const def = define(d); if (seen.has(def.id)) throw new Error('formula ' + def.id + ' is defined twice'); seen.add(def.id); return compile(def); });
}
