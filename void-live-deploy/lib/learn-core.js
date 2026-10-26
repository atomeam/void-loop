/**
 * learn-core: the pure logic of the learning pages (/learn/ and one page per site of the learning lane, lib/learn-sites.js; owner, 2026-10-26: "go through every site").
 * Every exercise is made here from numbers (Verse's own, procedurally: nothing is copied from any course), with its worked solution written step by step
 * as templates (TPL) the screen fills in English or German (lib/learn-de.js). Also: fractions, mastery levels and spaced review for skills, an SM-2 style
 * review for flashcards, the adaptive level of the word quiz, the typing tutor's lessons and per-key statistics, and the share tokens. No DOM, no storage,
 * no clock except where a day is passed in. Tests: tools/learn.test.mjs.
 */

// ---------- numbers ----------
/** a seeded random source in [0, 1) (mulberry32): the same seed makes the same worksheet. Pure. */
export function rng(seed) { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export function shuffle(r, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
/** a number as people write it: whole, or up to 4 decimals with no trailing zeros, a true minus sign. Pure. */
export function nf(x) { if (!Number.isFinite(x)) return ''; const s = String(Math.round(x * 1e4) / 1e4); return s.replace(/^-/, '−'); }

// ---------- fractions ----------
/** a fraction in lowest terms with a positive bottom, or null for a zero bottom. Pure. */
export function F(n, d = 1) { if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return null; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
export const fadd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
export const fsub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
export const fmul = (a, b) => F(a.n * b.n, a.d * b.d);
export const fdiv = (a, b) => (b.n ? F(a.n * b.d, a.d * b.n) : null);
export const feq = (a, b) => !!a && !!b && a.n * b.d === b.n * a.d;
export const fval = (a) => a.n / a.d;
/** "3/4", "-5", "1 1/2" (a mixed number), "0.75", "1,5" or "3 / 4" as a fraction in lowest terms, else null. Pure. */
export function parseFrac(s) {
  const t = String(s == null ? '' : s).trim().replace(/[−–]/g, '-').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
  let m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(t); if (m) { const d = +m[4]; if (!d) return null; return F((m[1] ? -1 : 1) * (+m[2] * d + +m[3]), d); }
  if ((m = /^(-?\d+)\/(-?\d+)$/.exec(t))) return F(+m[1], +m[2]);
  const x = parseNum(t); if (x === null) return null;
  const dp = (String(t).split(/[.,]/)[1] || '').length; if (dp > 6) return null; const p = 10 ** dp; return F(Math.round(x * p), p);
}
/** a typed number: "12", "-3", "1.5", "1,5" (German), "1,500" (thousands), "25%" (as 25). null when it is not one. Pure. */
export function parseNum(s) {
  let t = String(s == null ? '' : s).trim().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/%$/, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ''); else if (/^-?\d*,\d+$/.test(t)) t = t.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null; return Number(t);
}
export const fstr = (f) => (f ? (f.d === 1 ? nf(f.n) : nf(f.n) + '/' + f.d) : '');
/** 7/2 as "3 1/2"; a proper fraction or a whole number as itself. Pure. */
export function mixedStr(f) { if (!f || f.d === 1 || Math.abs(f.n) < f.d) return fstr(f); const w = Math.trunc(f.n / f.d), r = Math.abs(f.n % f.d); return nf(w) + ' ' + r + '/' + f.d; }

// ---------- the worked steps: templates the screen fills (lib/learn-de.js has each one in German) ----------
// {0}, {1}... are the values; a value { w: 'ones' } is a word the screen translates. Never put a person's text in a template.
export const TPL = Object.freeze({
  'q.op': '{0} {1} {2} = ?', 'q.expr': '{0} = ?', 'q.div': '{0} ÷ {1} = ? (with a remainder)', 'q.simp': 'Write {0} in its simplest form', 'q.fof': 'What is {0} of {1}?', 'q.pct': 'What is {0}% of {1}?',
  'q.f2p': 'Write {0} as a percent', 'q.eq': 'Solve for x: {0}', 'q.eval': 'Work out {0} when x = {1}', 'q.rectA': 'A rectangle is {0} by {1}. What is its area?', 'q.rectP': 'A rectangle is {0} by {1}. What is its perimeter?',
  'q.triA': 'A triangle has a base of {0} and a height of {1}. What is its area?', 'q.times': '{0} × {1} = ?',
  's.make10': 'Make a ten: {0} + {2} = 10, and {1} is {2} + {3}', 's.ten': 'Then 10 + {0} = {1}', 's.count': 'Count on {1} from {0}: {2}', 's.back10': 'Take {2} from {0} to reach 10 ({1} is {2} + {3})', 's.backrest': 'Then 10 − {0} = {1}',
  's.backsmall': 'Count back {1} from {0}: {2}', 's.split': 'Split {1} into {2} + {3}: {0} × {2} = {4} and {0} × {3} = {5}', 's.sum': 'Add them: {0} + {1} = {2}', 's.skip': 'Count in {0}s, {1} times: {2}',
  's.divfact': 'Which number times {0} makes {1}? {0} × {2} = {1}', 's.colAdd': '{0}: {1} + {2} + {3} carried = {4}; write {5}, carry {6}', 's.colSub': '{0}: {1} − {2} = {3}',
  's.borrow': '{0}: {1} is less than {2}, so borrow 1 from the next column: {3} − {2} = {4}', 's.partial': 'Split {0} into {1} + {2}: {1} × {3} = {4} and {2} × {3} = {5}', 's.divstep': 'Divide {0} by {1}: {2} times ({3}), {4} left over',
  's.borrow0': '{0}: the 0 has lent 1, so it borrows from the next column and becomes 9: 9 − {1} = {2}', 's.rem': '{0} ÷ {1} = {2} remainder {3}', 's.gcf': 'The greatest common factor of {0} and {1} is {2}', 's.divboth': 'Divide the top and the bottom by {0}: {1}', 's.already': '{0} is already in its simplest form',
  's.lcd': 'Common denominator: the least common multiple of {0} and {1} is {2}', 's.rewrite': 'Rewrite: {0} = {1} and {2} = {3}', 's.topsAdd': 'Add the tops: {0} + {1} = {2}, so the answer is {3}',
  's.topsSub': 'Subtract the tops: {0} − {1} = {2}, so the answer is {3}', 's.simplify': 'Simplify: {0} = {1}', 's.mixed': 'As a mixed number: {0}', 's.mulfr': 'Multiply the tops and the bottoms: ({0} × {1}) / ({2} × {3}) = {4}',
  's.recip': 'Dividing by {0} is the same as multiplying by its reciprocal {1}', 's.fof': '{0} of {1}: {1} ÷ {2} = {3}, then {3} × {4} = {5}', 's.hund': 'In hundredths: {0} + {1} = {2} hundredths', 's.dec': 'So the answer is {0}',
  's.pct10': '10% of {0} is {0} ÷ 10 = {1}', 's.pctof': '{0}% of {1} = {1} × {0} ÷ 100 = {2}', 's.to100': 'Multiply the top and the bottom by {0}: {1} = {2}/100', 's.pctis': 'Hundredths are percent: {0}%',
  's.intsub': 'Subtracting {0} is the same as adding {1}: {2}', 's.line': 'On the number line, start at {0} and move {1} {2}: {3}', 's.muldiv': 'Multiply and divide before you add and subtract: {0} = {1}',
  's.brackets': 'Brackets first: {0} = {1}', 's.then': 'Then {0} = {1}', 's.subBoth': 'Subtract {0} from both sides: {1} = {2}', 's.addBoth': 'Add {0} to both sides: {1} = {2}', 's.divBoth': 'Divide both sides by {0}: x = {1} ÷ {0} = {2}',
  's.put': 'Put {0} in for x: {1}', 's.area': 'Area = length × width = {0} × {1} = {2} square units', 's.perim': 'Perimeter = 2 × ({0} + {1}) = 2 × {2} = {3}', 's.tri': 'Area = base × height ÷ 2 = {0} × {1} ÷ 2 = {2} square units',
  's.improper': 'Write {0} as an improper fraction: {1}', 's.decfr': '{0} has {1} decimal places, so it is {2}', 's.answer': 'Answer: {0}', 's.check': 'Check: {0}',
});
/** a template filled with its values; `word` translates { w } values and `tpl` gives the template text (English by default). Pure. */
export function fill(step, tpl = TPL, word = (w) => w) {
  const s = (tpl && tpl[step.k]) || TPL[step.k] || step.k;
  return s.replace(/\{(\d+)\}/g, (_, i) => { const v = (step.v || [])[+i]; return v && typeof v === 'object' && 'w' in v ? word(v.w) : v == null ? '' : String(v); });
}
const S = (k, ...v) => ({ k, v });
const W = (w) => ({ w });
const PLACES = ['ones', 'tens', 'hundreds', 'thousands'];
const digits = (n, k) => Array.from({ length: k }, (_, i) => Math.floor(n / 10 ** i) % 10);

// ---------- the course: units of skills, each a problem made from numbers ----------
// make(nums) builds the problem from its numbers (so a link, a test or the gate can ask for one exact problem: ?skill=fadd&p=3,4,1,6);
// gen(r) picks the numbers. kind: 'num' (a number), 'frac' (a fraction, any equal form accepted), 'rem' (a quotient and a remainder).
const sk = (id, unit, name, gen, make, kind = 'num') => ({ id, unit, name, gen, make, kind });
const fr = (n, d) => n + '/' + d;
function fracOp(op, a, b, c, d) {
  const x = F(a, b), y = F(c, d), steps = [];
  if (op === '+' || op === '−') {
    const L = lcm(b, d), A = a * (L / b), C = c * (L / d), top = op === '+' ? A + C : A - C, raw = fr(top, L), res = F(top, L);
    if (b !== d) { steps.push(S('s.lcd', b, d, L)); steps.push(S('s.rewrite', fr(a, b), fr(A, L), fr(c, d), fr(C, L))); }
    steps.push(S(op === '+' ? 's.topsAdd' : 's.topsSub', A, C, nf(top), raw));
    if (res.d !== L || res.n !== top) steps.push(S('s.simplify', raw, fstr(res)));
    if (Math.abs(res.n) > res.d && res.d > 1) steps.push(S('s.mixed', mixedStr(res)));
    return { val: res, steps };
  }
  let p = x, q = y;
  if (op === '÷') { q = F(d, c); steps.push(S('s.recip', fr(c, d), fr(d, c))); }
  const rn = p.n * q.n, rd = p.d * q.d, res = F(rn, rd);
  steps.push(S('s.mulfr', op === '÷' ? a : a, op === '÷' ? d : c, b, op === '÷' ? c : d, fr(rn, rd)));
  if (res.n !== rn || res.d !== rd) steps.push(S('s.simplify', fr(rn, rd), fstr(res)));
  if (Math.abs(res.n) > res.d && res.d > 1) steps.push(S('s.mixed', mixedStr(res)));
  return { val: res, steps };
}
const proper = (r, lo = 2, hi = 12) => { const d = int(r, lo, hi); return [int(r, 1, d - 1), d]; };
export const UNITS = Object.freeze([
  { id: 'facts', name: 'Number facts', video: 'https://www.khanacademy.org/math/arithmetic' },
  { id: 'multi', name: 'Multi-digit arithmetic', video: 'https://www.khanacademy.org/math/arithmetic' },
  { id: 'fractions', name: 'Fractions', video: 'https://www.khanacademy.org/math/arithmetic/fraction-arithmetic' },
  { id: 'decimals', name: 'Decimals and percent', video: 'https://www.khanacademy.org/math/pre-algebra' },
  { id: 'integers', name: 'Negative numbers and order of operations', video: 'https://www.khanacademy.org/math/pre-algebra' },
  { id: 'algebra', name: 'Equations', video: 'https://www.khanacademy.org/math/algebra-basics' },
  { id: 'geometry', name: 'Area and perimeter', video: 'https://www.khanacademy.org/math/basic-geo' },
]);
export const SKILLS = Object.freeze([
  sk('add20', 'facts', 'Add within 20', (r) => [int(r, 2, 9), int(r, 2, 9)], ([a, b]) => {
    const s = a + b, steps = s > 10 ? [S('s.make10', a, b, 10 - a, b - (10 - a)), S('s.ten', b - (10 - a), s)] : [S('s.count', a, b, s)];
    return { q: S('q.op', a, '+', b), val: s, steps };
  }),
  sk('sub20', 'facts', 'Subtract within 20', (r) => { const a = int(r, 11, 18); return [a, int(r, a - 9, 9)]; }, ([a, b]) => {
    const s = a - b, first = a - 10, steps = b > first && first > 0 ? [S('s.back10', a, b, first, b - first), S('s.backrest', b - first, s)] : [S('s.backsmall', a, b, s)];
    return { q: S('q.op', a, '−', b), val: s, steps };
  }),
  sk('times', 'facts', 'Times tables', (r) => [int(r, 2, 12), int(r, 2, 12)], ([a, b]) => ({ q: S('q.times', a, b), val: a * b, steps: timesSteps(a, b) })),
  sk('divide', 'facts', 'Division facts', (r) => [int(r, 2, 12), int(r, 2, 12)], ([a, b]) => ({ q: S('q.op', a * b, '÷', a), val: b, steps: [S('s.divfact', a, a * b, b), S('s.answer', b)] })),
  sk('add3', 'multi', 'Add three-digit numbers', (r) => [int(r, 105, 899), int(r, 105, 899)], ([a, b]) => {
    const s = a + b, k = Math.max(String(a).length, String(b).length), da = digits(a, k), db = digits(b, k), steps = []; let c = 0;
    for (let i = 0; i < k; i++) { const t = da[i] + db[i] + c, nc = Math.floor(t / 10); steps.push(S('s.colAdd', W(PLACES[i]), da[i], db[i], c, t, t % 10, nc)); c = nc; }
    steps.push(S('s.answer', s)); return { q: S('q.op', a, '+', b), val: s, steps };
  }),
  sk('sub3', 'multi', 'Subtract three-digit numbers', (r) => { const a = int(r, 300, 999); return [a, int(r, 102, a - 50)]; }, ([a, b]) => {
    const da = digits(a, 3), db = digits(b, 3), steps = []; let borrow = 0;
    for (let i = 0; i < 3; i++) { const top = da[i] - borrow; if (top < 0) { steps.push(S('s.borrow0', W(PLACES[i]), db[i], 9 - db[i])); borrow = 1; } else if (top < db[i]) { steps.push(S('s.borrow', W(PLACES[i]), top, db[i], top + 10, top + 10 - db[i])); borrow = 1; } else { steps.push(S('s.colSub', W(PLACES[i]), top, db[i], top - db[i])); borrow = 0; } }
    steps.push(S('s.answer', a - b)); return { q: S('q.op', a, '−', b), val: a - b, steps };
  }),
  sk('mul21', 'multi', 'Multiply by a one-digit number', (r) => [10 * int(r, 1, 9) + int(r, 1, 9), int(r, 3, 9)], ([a, b]) => {
    const t = Math.floor(a / 10) * 10, o = a % 10; if (!o || !t) return { q: S('q.times', a, b), val: a * b, steps: [S('s.answer', a * b)] }; return { q: S('q.times', a, b), val: a * b, steps: [S('s.partial', a, t, o, b, t * b, o * b), S('s.sum', t * b, o * b, a * b)] };
  }),
  sk('longdiv', 'multi', 'Long division with a remainder', (r) => [int(r, 100, 999), int(r, 3, 9)], ([n, d]) => {
    const steps = [], ds = String(n).split('').map(Number); let cur = 0, q = '';
    for (const x of ds) { cur = cur * 10 + x; const k = Math.floor(cur / d); if (q || k) { steps.push(S('s.divstep', cur, d, k, k * d, cur - k * d)); q += k; } cur -= k * d; }
    const Q = Math.floor(n / d), R = n % d; steps.push(S('s.rem', n, d, Q, R));
    return { q: S('q.div', n, d), val: { q: Q, r: R }, steps };
  }, 'rem'),
  sk('fsimp', 'fractions', 'Simplify fractions', (r) => { let [n, d] = proper(r, 2, 9); const g = gcd(n, d); n /= g; d /= g; const k = int(r, 2, 6); return [n * k, d * k]; }, ([n, d]) => {
    const g = gcd(n, d), res = F(n, d); return { q: S('q.simp', fr(n, d)), val: res, steps: g > 1 ? [S('s.gcf', n, d, g), S('s.divboth', g, fr(n, d) + ' = ' + fstr(res))] : [S('s.already', fr(n, d))] };
  }, 'frac'),
  sk('fadd', 'fractions', 'Add fractions', (r) => [...proper(r), ...proper(r)], ([a, b, c, d]) => { const o = fracOp('+', a, b, c, d); return { q: S('q.op', fr(a, b), '+', fr(c, d)), ...o }; }, 'frac'),
  sk('fsub', 'fractions', 'Subtract fractions', (r) => { for (;;) { const x = [...proper(r), ...proper(r)]; if (x[0] / x[1] > x[2] / x[3]) return x; } }, ([a, b, c, d]) => { const o = fracOp('−', a, b, c, d); return { q: S('q.op', fr(a, b), '−', fr(c, d)), ...o }; }, 'frac'),
  sk('fmul', 'fractions', 'Multiply fractions', (r) => [...proper(r, 2, 9), ...proper(r, 2, 9)], ([a, b, c, d]) => { const o = fracOp('×', a, b, c, d); return { q: S('q.op', fr(a, b), '×', fr(c, d)), ...o }; }, 'frac'),
  sk('fdiv', 'fractions', 'Divide fractions', (r) => [...proper(r, 2, 9), ...proper(r, 2, 9)], ([a, b, c, d]) => { const o = fracOp('÷', a, b, c, d); return { q: S('q.op', fr(a, b), '÷', fr(c, d)), ...o }; }, 'frac'),
  sk('fof', 'fractions', 'A fraction of a number', (r) => { const [n, d] = proper(r, 2, 10); return [n, d, d * int(r, 2, 12)]; }, ([n, d, N]) => ({ q: S('q.fof', fr(n, d), N), val: (N / d) * n, steps: [S('s.fof', fr(n, d), N, d, N / d, n, (N / d) * n)] })),
  sk('dadd', 'decimals', 'Add decimals', (r) => [int(r, 11, 999), int(r, 11, 999)], ([a, b]) => ({ q: S('q.op', nf(a / 100), '+', nf(b / 100)), val: (a + b) / 100, steps: [S('s.hund', a, b, a + b), S('s.dec', nf((a + b) / 100))] })),
  sk('pct', 'decimals', 'Percent of a number', (r) => { const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 50, 75]); return [p, 20 * int(r, 1, 20)]; }, ([p, n]) => ({ q: S('q.pct', p, n), val: (p * n) / 100, steps: [S('s.pct10', n, nf(n / 10)), S('s.pctof', p, n, nf((p * n) / 100))] })),
  sk('f2p', 'decimals', 'Fractions as percents', (r) => { const d = pick(r, [2, 4, 5, 10, 20, 25, 50]); return [int(r, 1, d - 1), d]; }, ([n, d]) => ({ q: S('q.f2p', fr(n, d)), val: (n * 100) / d, steps: [S('s.to100', 100 / d, fr(n, d), (n * 100) / d), S('s.pctis', (n * 100) / d)] })),
  sk('iadd', 'integers', 'Add and subtract negative numbers', (r) => [int(r, -12, 12) || 3, int(r, -12, 12) || -4, int(r, 0, 1)], ([a, b, sub]) => {
    const B = sub ? -b : b, s = a + B, steps = []; if (sub) steps.push(S('s.intsub', nf(b), nf(-b), nf(a) + ' + ' + (B < 0 ? '(' + nf(B) + ')' : nf(B))));
    steps.push(S('s.line', nf(a), Math.abs(B), W(B < 0 ? 'to the left' : 'to the right'), nf(s)));
    return { q: S('q.op', nf(a), sub ? '−' : '+', b < 0 ? '(' + nf(b) + ')' : nf(b)), val: s, steps };
  }),
  sk('order', 'integers', 'Order of operations', (r) => { const f = int(r, 0, 2), c = int(r, 2, 9); return f === 2 ? [f, int(r, 10, 40), int(r, 2, 9) * c, c] : [f, int(r, 2, 20), int(r, 2, 9), c]; }, ([f, a, b, c]) => {
    if (f === 0) return { q: S('q.expr', a + ' + ' + b + ' × ' + c), val: a + b * c, steps: [S('s.muldiv', b + ' × ' + c, b * c), S('s.then', a + ' + ' + b * c, a + b * c)] };
    if (f === 1) return { q: S('q.expr', '(' + a + ' + ' + b + ') × ' + c), val: (a + b) * c, steps: [S('s.brackets', a + ' + ' + b, a + b), S('s.then', a + b + ' × ' + c, (a + b) * c)] };
    return { q: S('q.expr', a + ' − ' + b + ' ÷ ' + c), val: a - b / c, steps: [S('s.muldiv', b + ' ÷ ' + c, b / c), S('s.then', a + ' − ' + b / c, nf(a - b / c))] };
  }),
  sk('eq1', 'algebra', 'One-step equations', (r) => [int(r, 0, 1), int(r, 2, 12), int(r, 1, 15)], ([f, a, x]) => (f
    ? { q: S('q.eq', a + 'x = ' + a * x), val: x, steps: [S('s.divBoth', a, a * x, x), S('s.check', a + ' × ' + x + ' = ' + a * x)] }
    : { q: S('q.eq', 'x + ' + a + ' = ' + (x + a)), val: x, steps: [S('s.subBoth', a, 'x', x + a + ' − ' + a + ' = ' + x), S('s.check', x + ' + ' + a + ' = ' + (x + a))] })),
  sk('eq2', 'algebra', 'Two-step equations', (r) => [int(r, 2, 9), int(r, 1, 20), int(r, -6, 12) || 5], ([a, b, x]) => {
    const c = a * x + b; return { q: S('q.eq', a + 'x + ' + b + ' = ' + nf(c)), val: x, steps: [S('s.subBoth', b, a + 'x', nf(c) + ' − ' + b + ' = ' + nf(c - b)), S('s.divBoth', a, nf(c - b), nf(x)), S('s.check', a + ' × ' + nf(x) + ' + ' + b + ' = ' + nf(c))] };
  }),
  sk('evalx', 'algebra', 'Evaluate an expression', (r) => [int(r, 2, 9), int(r, 1, 20), int(r, 2, 10)], ([a, b, x]) => ({ q: S('q.eval', a + 'x + ' + b, x), val: a * x + b, steps: [S('s.put', x, a + ' × ' + x + ' + ' + b + ' = ' + a * x + ' + ' + b + ' = ' + (a * x + b))] })),
  sk('rectA', 'geometry', 'Area of a rectangle', (r) => [int(r, 2, 15), int(r, 2, 15)], ([l, w]) => ({ q: S('q.rectA', l, w), val: l * w, steps: [S('s.area', l, w, l * w)] })),
  sk('rectP', 'geometry', 'Perimeter of a rectangle', (r) => [int(r, 2, 20), int(r, 2, 20)], ([l, w]) => ({ q: S('q.rectP', l, w), val: 2 * (l + w), steps: [S('s.perim', l, w, l + w, 2 * (l + w))] })),
  sk('triA', 'geometry', 'Area of a triangle', (r) => [2 * int(r, 1, 10), int(r, 2, 15)], ([b, h]) => ({ q: S('q.triA', b, h), val: (b * h) / 2, steps: [S('s.tri', b, h, nf((b * h) / 2))] })),
]);
export const skillOf = (id) => SKILLS.find((s) => s.id === id) || null;
/** the hint for a times fact: split the larger number at 5 or 10, or count in steps. Pure. */
export function timesSteps(a, b) {
  if (b > 10) return [S('s.split', a, b, 10, b - 10, a * 10, a * (b - 10)), S('s.sum', a * 10, a * (b - 10), a * b)];
  if (b > 5) return [S('s.split', a, b, 5, b - 5, a * 5, a * (b - 5)), S('s.sum', a * 5, a * (b - 5), a * b)];
  return [S('s.skip', a, b, Array.from({ length: b }, (_, i) => a * (i + 1)).join(', '))];
}
/** a problem of a skill: from its numbers when given (and they make a sound problem), else picked by the random source. Pure. */
export function problem(id, r = Math.random, nums = null) {
  const s = skillOf(id); if (!s) return null;
  let p = null; if (Array.isArray(nums) && nums.length && nums.every(Number.isFinite)) { try { p = s.make(nums); } catch (_) { p = null; } }
  if (!p || p.val == null || (typeof p.val === 'number' && !Number.isFinite(p.val))) { nums = s.gen(r); p = s.make(nums); }
  const ans = s.kind === 'frac' ? fstr(p.val) : s.kind === 'rem' ? (p.val.r ? p.val.q + ' R ' + p.val.r : String(p.val.q)) : nf(p.val);
  const steps = p.steps[p.steps.length - 1].k === 's.answer' || p.steps.some((x) => String(x.v.join(' ')).includes(ans)) ? p.steps : p.steps.concat(S('s.answer', ans));
  return { skill: id, kind: s.kind, nums, q: p.q, val: p.val, answer: ans, steps };
}
/** whether a typed answer is right: a number equal to the answer, a fraction equal in value (any form), or a quotient with its remainder. Pure. */
export function check(p, input) {
  const t = String(input == null ? '' : input).trim(); if (!t) return false;
  if (p.kind === 'rem') { const m = /^(-?\d+)\s*(?:r|R|rest|remainder|Rest|Rem\.?)\s*(\d+)$/.exec(t); if (m) return +m[1] === p.val.q && +m[2] === p.val.r; return p.val.r === 0 && parseNum(t) === p.val.q; }
  if (p.kind === 'frac') return feq(parseFrac(t), p.val);
  const f = parseFrac(t); if (f) return Math.abs(fval(f) - p.val) < 1e-9; const x = parseNum(t); return x !== null && Math.abs(x - p.val) < 1e-9;
}
/** a printable worksheet: n problems of a skill from a seed, with the answer key. Pure. */
export function worksheet(id, n = 20, seed = 1) { const r = rng(seed); return Array.from({ length: Math.min(60, Math.max(1, n)) }, () => problem(id, r)); }

// ---------- mastery and spaced review (Khan-like levels, kept on the device by the screen) ----------
export const LEVELS = Object.freeze(['Not started', 'Attempted', 'Familiar', 'Proficient', 'Mastered']);
export const DUE_DAYS = Object.freeze([0, 1, 2, 5, 14]);
export const addDays = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** a skill's record after one answer: 3 right in a row without a hint is Familiar, 6 Proficient, 10 on at least two different days Mastered;
 *  a wrong answer from Proficient or Mastered drops one level. The next review is due a few days later, longer the higher the level. Pure. */
export function recordAnswer(rec, ok, hinted, day) {
  const r = { seen: 0, right: 0, run: 0, level: 0, days: [], ...(rec || {}) }; r.days = (r.days || []).slice();
  r.seen++; r.last = day; if (ok) { r.right++; if (!r.days.includes(day)) r.days = r.days.concat(day).slice(-30); }
  r.run = ok && !hinted ? r.run + 1 : 0;
  let lv = Math.max(r.level, 1); if (!ok && lv >= 3) lv--;
  if (r.run >= 3) lv = Math.max(lv, 2); if (r.run >= 6) lv = Math.max(lv, 3); if (r.run >= 10 && r.days.length >= 2) lv = 4;
  r.level = lv; r.due = addDays(day, DUE_DAYS[lv]); return r;
}
/** skills whose review is due on `day`, the longest overdue first. Pure. */
export const dueSkills = (map, day) => Object.entries(map || {}).filter(([id, r]) => skillOf(id) && r && r.level >= 1 && r.due && r.due <= day).sort((a, b) => (a[1].due < b[1].due ? -1 : 1)).map(([id]) => id);
/** the course's progress: levels counted and the share of mastery points, 0 to 100. Pure. */
export function courseProgress(map, skills = SKILLS) { const counts = [0, 0, 0, 0, 0]; let pts = 0; for (const s of skills) { const lv = (map && map[s.id] && map[s.id].level) || 0; counts[lv]++; pts += lv; } return { counts, pct: Math.round((100 * pts) / (4 * skills.length)) }; }
/** days in a row with practice, ending today or yesterday. Pure. */
export function streak(days, today) { const set = new Set(days || []); let d = set.has(today) ? today : addDays(today, -1), n = 0; while (set.has(d)) { n++; d = addDays(d, -1); } return n; }

// ---------- flashcards: an SM-2 style review and decks from text ----------
/** a card after one review: again (forgot), hard, good or easy; the interval grows with the card's ease. Pure. */
export function reviewCard(card, grade, day) {
  const c = { ease: 2.5, ivl: 0, reps: 0, lapses: 0, ...(card || {}) };
  if (grade === 'again') { c.reps = 0; c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.ivl = 0; }
  else if (grade === 'hard') { c.ivl = Math.max(1, Math.round(c.ivl * 1.2)); c.ease = Math.max(1.3, c.ease - 0.15); c.reps++; }
  else if (grade === 'easy') { c.ivl = c.reps === 0 ? 4 : Math.round(Math.max(1, c.ivl) * c.ease * 1.3); c.ease += 0.15; c.reps++; }
  else { c.ivl = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.ivl * c.ease); c.reps++; }
  c.ease = Math.round(c.ease * 100) / 100; c.due = addDays(day, c.ivl); return c;
}
export const dueCards = (cards, day) => (cards || []).filter((c) => !c.due || c.due <= day);
/** "front<TAB>back", "front = back", "front - back", "front; back" or a CSV line "front,back" (as flashcard sites and Anki export them) into cards. Pure. */
export function parseDeck(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue; let f = null, b = null;
    const csv = /^"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"$/.exec(line);
    if (csv) { f = csv[1].replace(/""/g, '"'); b = csv[2].replace(/""/g, '"'); }
    else for (const sep of ['\t', ' = ', ' - ', ' – ', ' — ', ' : ', ';', ' -> ', ',']) { const i = line.indexOf(sep); if (i > 0) { f = line.slice(0, i); b = line.slice(i + sep.length); break; } }
    if (f && b && f.trim() && b.trim()) out.push({ f: f.trim().slice(0, 500), b: b.trim().slice(0, 500) });
    if (out.length >= 2000) break;
  }
  return out;
}
export const deckText = (cards) => (cards || []).map((c) => c.f.replace(/[\t\n]/g, ' ') + '\t' + c.b.replace(/[\t\n]/g, ' ')).join('\n');
const b64u = (s) => { const b = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(String.fromCharCode(...new TextEncoder().encode(s))); return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); return typeof Buffer !== 'undefined' ? Buffer.from(t, 'base64').toString('utf8') : new TextDecoder().decode(Uint8Array.from(atob(t), (c) => c.charCodeAt(0))); };
/** a deck as a link token (its name and cards, never the review state) and back; null for a token that is not one. Pure. */
export const deckToken = (deck) => b64u(JSON.stringify({ n: String(deck.name || '').slice(0, 80), c: (deck.cards || []).slice(0, 300).map((c) => [c.f, c.b]) }));
export function deckOfToken(tok) { try { const d = JSON.parse(unb64u(tok)); if (!d || !Array.isArray(d.c)) return null; return { name: String(d.n || '').slice(0, 80), cards: d.c.filter((x) => Array.isArray(x) && x[0] && x[1]).slice(0, 300).map((x) => ({ f: String(x[0]).slice(0, 500), b: String(x[1]).slice(0, 500) })) }; } catch (_) { return null; } }
/** four choices for a card: its own back and three others from the deck. Pure. */
export function choicesFor(cards, i, r = Math.random) { const right = cards[i].b, others = shuffle(r, [...new Set(cards.map((c) => c.b).filter((b) => b !== right))]).slice(0, 3); return shuffle(r, [right, ...others]); }

// ---------- the word quiz: an adaptive level ----------
/** the level after an answer: three right in a row go up a level, a miss goes down one. Pure. */
export function vocabStep(st, ok, max = 5) { const s = { level: 1, run: 0, right: 0, seen: 0, ...(st || {}) }; s.seen++; if (ok) { s.right++; s.run++; if (s.run >= 3 && s.level < max) { s.level++; s.run = 0; } } else { s.run = 0; s.level = Math.max(1, s.level - 1); } return s; }
/** a question: a word of the level, its meaning and three other meanings of words of the same level. Pure. */
export function vocabQuestion(words, level, r = Math.random, avoid = [], field = 'def') {
  const pool = words.filter((w) => w.level === level && !avoid.includes(w.word)), all = pool.length ? pool : words.filter((w) => w.level === level);
  const w = pick(r, all.length ? all : words), wrong = shuffle(r, words.filter((x) => x.word !== w.word && x[field] !== w[field] && Math.abs(x.level - w.level) <= 1)).slice(0, 3).map((x) => x[field]);
  return { word: w.word, answer: w[field], choices: shuffle(r, [w[field], ...wrong]) };
}

// ---------- the typing tutor ----------
// the letters in the order they are opened, most used first (English, then German); a lesson uses only the open letters
export const KEY_ORDER = Object.freeze({ en: 'enitrlsauodychgmpbkvwfzxqj', de: 'enirstahdulcgmobwfkzpvüäößjyxq' });
/** words of a list made only of the open letters, with the newest letter in most of them; made-up syllables when the list has too few. Pure. */
export function lesson(letters, words, r = Math.random, n = 14) {
  const set = new Set(letters), newest = letters[letters.length - 1], ok = words.filter((w) => w.length > 1 && [...w].every((c) => set.has(c)));
  const withNew = ok.filter((w) => w.includes(newest)), out = [];
  const vowels = letters.filter((c) => 'aeiouäöü'.includes(c)), cons = letters.filter((c) => !'aeiouäöü'.includes(c));
  const made = () => { let w = ''; const len = int(r, 3, 6); for (let i = 0; i < len; i++) w += i % 2 ? pick(r, vowels.length ? vowels : letters) : pick(r, cons.length ? cons : letters); return i0(w); };
  const i0 = (w) => (w.includes(newest) ? w : newest + w.slice(1));
  for (let i = 0; i < n; i++) out.push(withNew.length >= 3 && r() < 0.7 ? pick(r, withNew) : ok.length >= 8 ? pick(r, ok) : made());
  return out.join(' ');
}
/** words a minute (a word is five characters) and accuracy from the characters typed. Pure. */
export const wpm = (chars, ms) => (ms > 0 ? Math.round((chars / 5) / (ms / 60000)) : 0);
/** per-key numbers from a log of { k, ok, ms } presses: count, misses, average ms and a speed in words a minute. Pure. */
export function keyStats(log, prev = {}) {
  const s = JSON.parse(JSON.stringify(prev || {}));
  for (const e of log || []) { if (!e || !e.k) continue; const k = s[e.k] || (s[e.k] = { n: 0, miss: 0, ms: 0 }); k.n++; if (!e.ok) k.miss++; else if (e.ms > 0 && e.ms < 4000) k.ms += e.ms; }
  for (const k of Object.values(s)) { const hits = k.n - k.miss; k.wpm = hits > 0 && k.ms > 0 ? Math.round(12000 / (k.ms / hits)) : 0; k.acc = k.n ? Math.round((100 * (k.n - k.miss)) / k.n) : 0; }
  return s;
}
/** the next letter opens when every open letter has been typed 15 times at the target speed with 92% accuracy or better. Pure. */
export function nextLetters(letters, stats, order, target = 30) {
  const ready = letters.every((c) => stats[c] && stats[c].n >= 15 && stats[c].wpm >= target && stats[c].acc >= 92);
  if (!ready) return letters; const nx = [...order].find((c) => !letters.includes(c)); return nx ? letters.concat(nx) : letters;
}

// ---------- times tables ----------
export const timesFacts = (tables, upTo = 12) => tables.flatMap((t) => Array.from({ length: upTo }, (_, i) => [t, i + 1]));
/** a speed-test answer's points: 10 for a right answer and one for every second left of the ten. Pure. */
export const speedPoints = (ok, secLeft) => (ok ? 10 + Math.max(0, Math.floor(secLeft)) : 0);
/** a fact is known after two right answers, the last one right, in under five seconds on average. Pure. */
export const known = (st) => !!st && st.right >= 2 && st.lastOk && st.ms / Math.max(1, st.right) < 5000;
export function factAnswer(st, ok, ms) { const s = { n: 0, right: 0, ms: 0, ...(st || {}) }; s.n++; if (ok) { s.right++; s.ms += Math.min(ms, 20000); } s.lastOk = !!ok; return s; }

// ---------- the periodic table ----------
const CORES = [[2, 'He'], [10, 'Ne'], [18, 'Ar'], [36, 'Kr'], [54, 'Xe'], [86, 'Rn']];
const ORBITALS = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
const CAP = { s: 2, p: 6, d: 10, f: 14 };
// the ground states that do not follow the filling order (measured; the heavier ones after 103 are predictions and follow the rule here)
const EXCEPT = { 24: '[Ar] 3d5 4s1', 29: '[Ar] 3d10 4s1', 41: '[Kr] 4d4 5s1', 42: '[Kr] 4d5 5s1', 44: '[Kr] 4d7 5s1', 45: '[Kr] 4d8 5s1', 46: '[Kr] 4d10', 47: '[Kr] 4d10 5s1', 57: '[Xe] 5d1 6s2', 58: '[Xe] 4f1 5d1 6s2', 64: '[Xe] 4f7 5d1 6s2', 78: '[Xe] 4f14 5d9 6s1', 79: '[Xe] 4f14 5d10 6s1', 89: '[Rn] 6d1 7s2', 90: '[Rn] 6d2 7s2', 91: '[Rn] 5f2 6d1 7s2', 92: '[Rn] 5f3 6d1 7s2', 93: '[Rn] 5f4 6d1 7s2', 96: '[Rn] 5f7 6d1 7s2', 103: '[Rn] 5f14 7s2 7p1' };
/** the ground-state electron configuration, shortened by the noble gas before it and ordered by shell: 26 -> "[Ar] 3d6 4s2". Pure. */
export function electronConfig(z) {
  if (EXCEPT[z]) return EXCEPT[z];
  let left = z; const fill = []; for (const o of ORBITALS) { if (left <= 0) break; const k = Math.min(CAP[o[1]], left); fill.push([o, k]); left -= k; }
  let core = null; for (const [n, sym] of CORES) if (n < z) core = [n, sym];
  let skip = core ? core[0] : 0; const tail = [];
  for (const [o, k] of fill) { if (skip >= k) { skip -= k; continue; } tail.push([o, k - skip]); skip = 0; }
  tail.sort((a, b) => +a[0][0] - +b[0][0] || 'spdf'.indexOf(a[0][1]) - 'spdf'.indexOf(b[0][1]));
  return (core ? '[' + core[1] + '] ' : '') + tail.map(([o, k]) => o + k).join(' ');
}
/** period, group (null for the f-block row), block and where it sits on the 18-column grid (rows 9 and 10 are the f-block). Pure. */
export function placeOf(z) {
  const period = z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : z <= 36 ? 4 : z <= 54 ? 5 : z <= 86 ? 6 : 7;
  const start = [0, 1, 3, 11, 19, 37, 55, 87][period], i = z - start; let group;
  if (period === 1) group = z === 1 ? 1 : 18; else if (period <= 3) group = i < 2 ? i + 1 : i + 11; else if (period <= 5) group = i + 1; else group = i < 2 ? i + 1 : i <= 16 ? null : i - 13;
  const fRow = group === null, block = fRow ? 'f' : group <= 2 || z === 2 ? 's' : group >= 13 ? 'p' : 'd';
  return { period, group, block, row: fRow ? period + 3 : period, col: fRow ? i + 1 : group };
}
const CATS = { alkali: [3, 11, 19, 37, 55, 87], alkaline: [4, 12, 20, 38, 56, 88], post: [13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116], metalloid: [5, 14, 32, 33, 51, 52], nonmetal: [1, 6, 7, 8, 15, 16, 34], halogen: [9, 17, 35, 53, 85, 117], noble: [2, 10, 18, 36, 54, 86, 118] };
/** the family an element is shown in. Pure. */
export function categoryOf(z) { if (z >= 57 && z <= 71) return 'lanthanide'; if (z >= 89 && z <= 103) return 'actinide'; for (const [k, l] of Object.entries(CATS)) if (l.includes(z)) return k; return 'transition'; }
const GASES = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86];
/** solid, liquid or gas at 20 °C; unknown past fermium (too few atoms have ever been made). Pure. */
export const stateOf = (z) => (z >= 100 ? 'unknown' : GASES.includes(z) ? 'gas' : z === 35 || z === 80 ? 'liquid' : 'solid');
/** the elements as rows: { z, sym, name, de, mass, stable }, from the packed list in lib/learn-data.js. Pure. */
export const unpackElements = (packed) => packed.split(';').map((row, i) => { const [sym, name, de, m] = row.split(','); const stable = !/^\[/.test(m); return { z: i + 1, sym, name, de, mass: m.replace(/[[\]]/g, ''), stable, ...placeOf(i + 1), cat: categoryOf(i + 1), state: stateOf(i + 1), config: electronConfig(i + 1) }; });
/** an element by its symbol, number or English or German name (any case, accents ignored). Pure. */
export function findElement(els, q) {
  const k = String(q || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (!k) return null;
  if (/^\d+$/.test(k)) return els[+k - 1] || null;
  const n = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return els.find((e) => n(e.sym) === k) || els.find((e) => n(e.name) === k || n(e.de) === k) || els.find((e) => n(e.name).startsWith(k) || n(e.de).startsWith(k)) || null;
}

/** the fraction calculator: a op b for fractions, mixed or whole numbers ('add', 'sub', 'mul', 'div'), with the worked steps; null for a bad input or a division by zero. Pure. */
export function fracCalc(aText, op, bText) {
  const a = parseFrac(aText), b = parseFrac(bText), sym = { add: '+', sub: '−', mul: '×', div: '÷' }[op]; if (!a || !b || !sym || (op === 'div' && !b.n)) return null;
  const pre = []; for (const [txt, f] of [[aText, a], [bText, b]]) { const t = String(txt).trim(); if (/\d\s+\d+\s*\/\s*\d+/.test(t) || /[.,]/.test(t)) pre.push(S(/[.,]/.test(t) ? 's.decfr' : 's.improper', ...(/[.,]/.test(t) ? [t, (t.split(/[.,]/)[1] || '').length, fr(f.n, f.d)] : [t, fr(f.n, f.d)]))); }
  const o = fracOp(sym, a.n, a.d, b.n, b.d); if (!o.val) return null;
  return { a, b, sym, val: o.val, steps: pre.concat(o.steps), mixed: mixedStr(o.val), decimal: nf(fval(o.val)) };
}
/** a decimal as a fraction in lowest terms with its steps: 0.375 -> 3/8. Pure. */
export function decToFrac(text) {
  const t = String(text || '').trim(), f = parseFrac(t); if (!f || !/[.,]/.test(t)) return f ? { val: f, steps: [S('s.answer', fstr(f))] } : null;
  const dp = (t.split(/[.,]/)[1] || '').length, raw = fr(Math.round(fval(f) * 10 ** dp), 10 ** dp), steps = [S('s.decfr', t, dp, raw)];
  if (raw !== fstr(f)) steps.push(S('s.simplify', raw, fstr(f))); return { val: f, steps };
}
