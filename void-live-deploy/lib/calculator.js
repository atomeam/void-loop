/**
 * calculator: the arithmetic of a scientific calculator (the tower's calculator.net floor, a-to-mind.com/calculator/). Brackets, powers, roots,
 * trig in degrees or radians, logs, factorial, percent the way a calculator means it (200 + 10% = 220, 17% of 240 = 40.8), memory, and results
 * shown to 15 significant digits so floating-point noise never shows (0.1 + 0.2 = 0.3). No eval. The stage calculator's own asks ("what is ...",
 * "calculate ...") and its unit conversions (skills/calc.js expressionOf, convertUnits) are reused, not copied. Pure. Tests: tools/calculator.test.mjs.
 */
import { expressionOf, convertUnits, evaluate } from '../skills/calc.js';

const FUNCS = {
  sin: (x, d) => trig(Math.sin, x, d), cos: (x, d) => trig(Math.cos, x, d), tan: (x, d) => { if (d && mod(x, 180) === 90) throw new Error('tan of 90° is undefined'); return trig(Math.tan, x, d); },
  asin: (x, d) => inv(Math.asin(x), d), acos: (x, d) => inv(Math.acos(x), d), atan: (x, d) => inv(Math.atan(x), d),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: (x) => { if (x <= 0) throw new Error('ln needs a number above 0'); return Math.log(x); },
  log: (x) => { if (x <= 0) throw new Error('log needs a number above 0'); return Math.log10(x); },
  log2: (x) => { if (x <= 0) throw new Error('log2 needs a number above 0'); return Math.log2(x); },
  sqrt: (x) => { if (x < 0) throw new Error('no real square root of a negative number'); return Math.sqrt(x); },
  cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const mod = (x, m) => ((x % m) + m) % m;
// degrees are exact at the angles people type (sin 30° = 0.5, cos 90° = 0), and a result within 1e-15 of zero is zero
function trig(f, x, deg) {
  if (deg) { const a = mod(x, 360); const exact = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0], 30: [0.5, null], 150: [0.5, null], 210: [-0.5, null], 330: [-0.5, null], 60: [null, 0.5], 120: [null, -0.5], 240: [null, -0.5], 300: [null, 0.5] }[a];
    if (exact) { const v = f === Math.sin ? exact[0] : f === Math.cos ? exact[1] : null; if (v !== null && v !== undefined) return v; if (f === Math.tan && (a === 0 || a === 180)) return 0; }
    x = x * Math.PI / 180; }
  const r = f(x); return Math.abs(r) < 1e-15 ? 0 : r;
}
const inv = (r, deg) => { if (Number.isNaN(r)) throw new Error('out of range for an inverse'); return deg ? r * 180 / Math.PI : r; };
function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('factorial needs a whole number 0 or more');
  if (n > 170) throw new Error('too large'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

/** the tokens of an expression: numbers, names, operators and brackets; ×, ÷, −, √, π and ² as people type them. Pure. */
export function tokens(src) {
  const s = String(src || '').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^').replace(/,(?=\d{3}\b)/g, '');
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const name = /^(?:log2|[a-z]+|π|√|∛)/i.exec(s.slice(i));
    if (name) { out.push({ t: 'name', v: name[0].toLowerCase() }); i += name[0].length; continue; }
    if ('+-*/^%!()'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error('"' + c + '" is not something I can work out');
  }
  return out;
}

/** the stage card's ask for the sum in the box ("calculator 2*(3+4)"), only when the stage calculator (skills/calc.js) works out the
 *  same number this page does; '' for a sum it reads another way or not at all (sin, π, Ans, a bare %), so the link opens the example. Pure. */
export function cardAsk(src, opts) {
  const raw = String(src || '').trim().replace(/=+\s*$/, ''); if (!raw || raw.length > 200) return '';
  const ask = 'calculator ' + raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'), expr = expressionOf(ask); if (expr === null) return '';
  const a = calc(raw, opts), b = evaluate(expr);
  return a.ok && b.ok && Number.isFinite(a.value) && Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(a.value)) ? ask : '';
}

/** the card for the page: just after =, the box holds the answer, so the card takes the sum that gave it (the history's top row), not the bare number. */
export function boxAsk(box, list, done, opts) {
  const top = done && Array.isArray(list) && list[0];
  return (top && top.v === String(box || '').trim() && cardAsk(top.e, opts)) || cardAsk(box, opts);
}

/** work out an expression: { ok, value } or { ok: false, error }. opts: { deg (true: trig in degrees), ans (the last answer), mem }. Pure. */
export function calc(src, { deg = true, ans = 0, mem = 0 } = {}) {
  try {
    const raw = String(src || '').trim(); if (!raw) throw new Error('empty');
    // an ask in words ("what is 17% of 240", "5 miles to km") goes through the stage calculator's own reading
    const asked = expressionOf(raw), conv = asked && /^convert\(([\d.]+),\s*"([^"]+)",\s*"([^"]+)"\)$/.exec(asked);
    if (conv) { const v = convertUnits(parseFloat(conv[1]), conv[2].toLowerCase(), conv[3].toLowerCase()); if (v === null) throw new Error('unknown units: ' + conv[2] + ' to ' + conv[3]); return { ok: true, value: v }; }
    const text = (asked && !/^calculator?$/i.test(raw) ? asked : raw).replace(/[=?]+\s*$/, '');
    const tk = tokens(text); let i = 0;
    const peek = () => tk[i], take = () => tk[i++];
    const starts = (x) => x && (x.t === 'num' || x.t === 'name' || x.t === '(');
    // expr := term (('+'|'-') term)*; a term that ends in % after + or - is a share of what is left of it (200 + 10% = 220)
    const expr = () => {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = take().t, r = term(true);
        const rhs = r.pct ? v * r.value : r.value; v = op === '+' ? v + rhs : v - rhs; // r.value is already the share (10% is 0.1)
      }
      return v;
    };
    // term := unary (('*'|'/'|'of'|implicit) unary)*
    const term = (wantPct) => {
      let u = unary(), v = u.value, pct = u.pct;
      for (;;) {
        const x = peek();
        if (x && (x.t === '*' || x.t === '/')) { take(); const r = unary(); if (x.t === '/' && r.value === 0) throw new Error('cannot divide by zero'); v = x.t === '*' ? v * r.value : v / r.value; pct = false; continue; }
        if (x && x.t === 'name' && x.v === 'of') { take(); v = v * unary().value; pct = false; continue; }
        if (starts(x) && !(x.t === 'name' && x.v === 'of')) { v = v * unary().value; pct = false; continue; } // 2π, 3(4), (1)(2), 2 sin 30
        break;
      }
      const out = { value: v, pct: !!(wantPct && pct) };
      return wantPct ? out : out.value;
    };
    // unary := ('-'|'+') unary | power
    const unary = () => { const x = peek(); if (x && (x.t === '-' || x.t === '+')) { take(); const u = unary(); return { value: x.t === '-' ? -u.value : u.value, pct: u.pct }; } return power(); };
    // power := postfix ('^' unary)?   (right to left: 2^3^2 = 2^9; -2^2 = -4)
    const power = () => { const b = postfix(); if (peek() && peek().t === '^') { take(); const e = unary(); const v = Math.pow(b.value, e.value); if (Number.isNaN(v)) throw new Error('no real answer'); return { value: v, pct: false }; } return b; };
    const postfix = () => {
      let v = atom(), pct = false;
      while (peek() && (peek().t === '!' || peek().t === '%')) { const op = take().t; if (op === '!') { v = factorial(v); pct = false; } else { v = v / 100; pct = true; } }
      return { value: v, pct };
    };
    const atom = () => {
      const x = take(); if (!x) throw new Error('something is missing at the end');
      if (x.t === 'num') return x.v;
      if (x.t === '(') { const v = expr(); if (peek() && peek().t === ')') take(); return v; } // a bracket left open is closed at the end, as calculators do
      if (x.t === 'name') {
        if (x.v === 'pi' || x.v === 'π') return Math.PI;
        if (x.v === 'e') return Math.E;
        if (x.v === 'ans') return ans;
        if (x.v === 'mr') return mem;
        const f = x.v === '√' ? FUNCS.sqrt : x.v === '∛' ? FUNCS.cbrt : FUNCS[x.v];
        if (!f) throw new Error('"' + x.v + '" is not something I can work out');
        return f(peek() && peek().t === '(' ? postfix().value : unary().value, deg); // sin(30)^2 is (sin 30)^2; sin 30^2 is sin 900
      }
      throw new Error('"' + x.t + '" in the wrong place');
    };
    const v = expr();
    if (i < tk.length) throw new Error(tk[i].t === ')' ? 'a ) with no ( before it' : 'something is in the wrong place');
    if (!Number.isFinite(v)) throw new Error(Number.isNaN(v) ? 'no real answer' : 'too large');
    return { ok: true, value: v };
  } catch (e) { return { ok: false, error: e.message || 'not something I can work out' }; }
}

/** a result as shown: 15 significant digits (0.1 + 0.2 = 0.3, 1/3 = 0.333333333333333), no -0, an exponent past 1e21 or under 1e-9. Pure. */
export function show(value) {
  if (!Number.isFinite(value)) return 'Error';
  const r = Number(value.toPrecision(15)); if (r === 0) return '0';
  const a = Math.abs(r);
  if (a >= 1e21 || a < 1e-9) return r.toExponential().replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e');
  return String(r);
}
/** the same with digit groups for reading (12,345,678.9), never inside an exponent. Pure. */
export function grouped(value) { const s = show(value); if (/e|Error/.test(s)) return s; const [w, f] = s.split('.'); return w.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }

/** memory keys: MC clears, M+ adds, M− takes away, MS stores; MR is read by calc's `mr`. Pure. */
export function memory(mem, key, value) {
  if (key === 'mc') return 0; if (key === 'ms') return value; if (key === 'm+') return Number((mem + value).toPrecision(15)); if (key === 'm-') return Number((mem - value).toPrecision(15)); return mem;
}
/** the history after a result: newest first, the same sum twice in a row kept once, at most `max`. Pure. */
export function remember(list, expr, value, max = 50) {
  const row = { e: String(expr).trim(), v: show(value) }, l = Array.isArray(list) ? list : [];
  if (l[0] && l[0].e === row.e && l[0].v === row.v) return l;
  return [row, ...l].slice(0, max);
}
