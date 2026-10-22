/**
 * roman-num — convert between arabic and roman numerals. "roman numeral for 42", "what is XLII in numbers".
 * Pure, 1..3999. Contract: { name, examples, nearMisses, match, run, suite }
 */
const MAP = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

export function toRoman(n) {
  n = Math.floor(+n);
  if (!Number.isFinite(n) || n < 1 || n > 3999) return null;
  let out = '';
  for (const [v, s] of MAP) while (n >= v) { out += s; n -= v; }
  return out;
}

export function fromRoman(s) {
  const t = String(s || '').toUpperCase().replace(/\s+/g, '');
  if (!/^[MDCLXVI]+$/.test(t)) return null;
  const val = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const a = val[t[i]], b = val[t[i + 1]] || 0;
    n += a < b ? -a : a;
  }
  if (toRoman(n) !== t) return null; // reject non-canonical forms
  return n;
}

export function romanOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:roman(?:\s+numeral)?(?:\s+for)?|convert\s+to\s+roman)\s*:?\s*(\d{1,4})$/i)
    || t.match(/^(?:what\s+is\s+)?(\d{1,4})\s+in\s+roman(?:\s+numerals?)?$/i);
  if (m) return { kind: 'to', n: +m[1] };
  m = t.match(/^(?:what\s+is\s+)?([MDCLXVI]{1,15})\s+(?:in\s+(?:arabic|numbers?|digits?)|as\s+(?:a\s+)?number)$/i)
    || t.match(/^(?:roman\s+)?(?:to\s+)?(?:arabic|number)\s*:?\s*([MDCLXVI]{1,15})$/i);
  if (m) return { kind: 'from', s: m[1] };
  return null;
}

async function run(text, api) {
  const q = romanOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  let title, big, sub;
  if (q.kind === 'to') {
    const r = toRoman(q.n);
    if (!r) { api.say('roman numerals only for 1 to 3999'); return 'roman-num'; }
    title = String(q.n); big = r; sub = q.n + ' in roman numerals';
  } else {
    const n = fromRoman(q.s);
    if (n == null) { api.say('not a standard roman numeral'); return 'roman-num'; }
    title = q.s.toUpperCase(); big = String(n); sub = q.s.toUpperCase() + ' as a number';
  }
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<div style="font-size:44px;font-weight:300;margin:10px 0;letter-spacing:0.06em">' + esc(big) + '</div>'
      + '<p style="color:#8a8a8a">' + esc(sub) + '</p>';
  });
  api.say(big);
  return 'roman-num';
}

export default {
  name: 'roman-num',
  examples: ['roman numeral for 42', 'what is 1999 in roman', 'what is XLII in numbers'],
  nearMisses: ['roman empire', 'roman holiday', 'arabic language'],
  match(lower, text) { return !!romanOf(text); },
  run,
  suite() {
    return { ok: toRoman(42) === 'XLII' && fromRoman('XLII') === 42 && toRoman(1999) === 'MCMXCIX' && !!romanOf('roman numeral for 42') && romanOf('roman empire') === null };
  },
};
