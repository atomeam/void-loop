/**
 * keypad: the button-by-button scientific calculator on /calculators/ (#keypad). A state { expr, shown, ans, mem, deg, done, error } and
 * press(state, key) giving the next state, so the page and the tests drive the same thing. Keys: digits, '.', + − × ÷, ( ), xʸ (^), √, x², 1/x,
 * n!, %, sin cos tan and their inverses, ln, log, π, e, EXP (×10ⁿ), ±, Back, AC, Ans, RND, M+, M−, MR, MC, Deg/Rad and =. Sums are worked out by
 * lib/calc-units.js evaluate() on plain numbers. RND writes a random number from 0 to 1 (crypto). Pure apart from RND. Tests: tools/keypad.test.mjs.
 */
import { evaluate } from './calc-units.js';

export const KEYS = ['Deg', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'π', 'e', 'xʸ', 'x²', '√', 'ln', 'log', 'n!', '1/x', '(', ')', '%', 'EXP',
  'MC', 'M+', 'M−', 'MR', 'RND', '7', '8', '9', '÷', 'Back', '4', '5', '6', '×', 'AC', '1', '2', '3', '−', 'Ans', '0', '.', '±', '+', '='];
export const RAND = { next: () => { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] / 2 ** 32; } };
export const start = () => ({ expr: '', shown: '0', ans: 0, mem: 0, deg: true, done: false, error: '' });

const FN = { sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'asin(', acos: 'acos(', atan: 'atan(', ln: 'ln(', log: 'log(', '√': 'sqrt(' };
const TOKENS = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'sqrt(', 'ln(', 'log(', 'Ans', '×10^', 'π'];
/** a number written for the display: up to 12 significant figures, no trailing zeros. Pure. */
export function show(v) {
  if (!Number.isFinite(v)) return 'Error';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e12 || a < 1e-9) return v.toExponential(9).replace(/\.?0+e/, 'e');
  return String(Number(v.toPrecision(12)));
}
const fact = (n) => { if (!Number.isInteger(n) || n < 0) throw new Error('n! needs a whole number, 0 or more'); if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
/** the typed sum worked out: degrees or radians for the trig keys, Ans for the last answer. Throws in words. Pure. */
export function calc(expr, { ans = 0, deg = true } = {}) {
  let s = String(expr).replace(/×10\^/g, 'E');
  // n! on a number or a bracket, done before the parser (it has no postfix operators)
  for (let guard = 0; s.includes('!') && guard < 50; guard++) {
    s = s.replace(/(\d+(?:\.\d+)?)!/, (_, n) => '(' + fact(Number(n)) + ')');
    const k = s.indexOf(')!'); if (k >= 0) { let d = 0, j = k; for (; j >= 0; j--) { if (s[j] === ')') d++; else if (s[j] === '(') { d--; if (d === 0) break; } } if (j < 0) throw new Error('a bracket is missing'); s = s.slice(0, j) + '(' + fact(calc(s.slice(j, k + 1), { ans, deg })) + ')' + s.slice(k + 2); }
    else if (s.includes('!')) throw new Error('n! goes after a number or a bracket');
  }
  s = s.replace(/(\d|\.)E([-+]?\d)/g, '$1e$2'); if (/E/.test(s)) throw new Error('EXP needs a number on both sides');
  s = s.replace(/%/g, '/100');
  const opens = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length; if (opens > 0) s += ')'.repeat(opens); // close what was left open, as a desk calculator does
  if (deg) s = s.replace(/\b(a?)(sin|cos|tan)\(/g, (_, inv, f) => (inv ? '(180/pi)*a' + f + '(' : f + 'd('));
  const v = evaluate(s, { Ans: { v: ans, d: evaluate('1').d } }).v;
  if (!Number.isFinite(v)) throw new Error(Number.isNaN(v) ? 'not a real number' : 'division by zero, or too big');
  return /(sin|cos|tan)d?\(/.test(s) && Math.abs(v) < 1e-12 ? 0 : v; // sin 180° is 0, not 1.2e-16
}
const lastNumber = /(\d+\.?\d*(?:×10\^-?\d*)?|\.\d+)$/;
/** the state after one key. Pure, apart from RND reading `rng`. */
export function press(st, key, rng = RAND) {
  const s = { ...st, error: '' }, fresh = st.done || st.error;
  const put = (t, continues = false) => { s.expr = (fresh && !continues ? '' : fresh ? 'Ans' : s.expr) + t; s.done = false; s.shown = s.expr; return s; };
  const value = () => { try { return st.done ? st.ans : st.expr ? calc(st.expr, st) : 0; } catch { return st.ans; } };
  if (/^[0-9]$/.test(key) || key === '.') return put(key);
  if (key in FN) return put(FN[key]);
  switch (key) {
    case 'π': case 'e': case '(': return put(key === 'π' ? 'π' : key);
    case ')': return put(')', true);
    case '+': case '−': case '×': case '÷': return put({ '+': '+', '−': '−', '×': '×', '÷': '÷' }[key], true);
    case 'xʸ': return put('^', true);
    case 'x²': return put('^2', true);
    case '1/x': s.expr = '1/(' + (fresh ? 'Ans' : s.expr || '0') + ')'; s.done = false; s.shown = s.expr; return s;
    case 'n!': return put('!', true);
    case '%': return put('%', true);
    case 'EXP': return put('×10^', true);
    case 'Ans': return put('Ans');
    case 'RND': return put(show(Number(rng.next().toFixed(10))));
    case '±': {
      if (fresh) { s.expr = '−Ans'; s.done = false; s.shown = s.expr; return s; }
      const neg = /\(−(\d+\.?\d*|\.\d+)\)$/.exec(s.expr); // (−x) back to x
      if (neg) { s.expr = s.expr.slice(0, neg.index) + neg[1]; s.shown = s.expr; return s; }
      const m = lastNumber.exec(s.expr);
      if (!m) { s.expr = '−(' + s.expr + ')'; s.shown = s.expr; return s; }
      const at = m.index, before = s.expr.slice(0, at);
      s.expr = before === '−' ? m[1] : before + '(−' + m[1] + ')'; s.shown = s.expr; return s;
    }
    case 'Back': {
      if (fresh) return { ...start(), ans: st.ans, mem: st.mem, deg: st.deg };
      const t = TOKENS.find((x) => s.expr.endsWith(x)); s.expr = s.expr.slice(0, s.expr.length - (t ? t.length : 1)); s.shown = s.expr || '0'; return s;
    }
    case 'AC': return { ...start(), ans: st.ans, mem: st.mem, deg: st.deg };
    case 'Deg': case 'Rad': s.deg = !st.deg; return s;
    case 'MC': s.mem = 0; return s;
    case 'M+': s.mem = st.mem + value(); return s;
    case 'M−': s.mem = st.mem - value(); return s;
    case 'MR': return put(st.mem < 0 ? '(' + show(st.mem).replace('-', '−') + ')' : show(st.mem));
    case '=': {
      if (!st.expr || st.done) return s;
      try { const v = calc(st.expr, st); s.ans = v; s.shown = show(v); s.done = true; }
      catch (e) { s.error = String(e.message || e); s.shown = 'Error'; }
      return s;
    }
  }
  throw new Error('no key called "' + key + '"');
}
/** press several keys in order. Pure, apart from RND. */
export const pressAll = (keys, st = start(), rng = RAND) => keys.reduce((s, k) => press(s, k, rng), st);
