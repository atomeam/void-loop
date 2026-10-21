/**
 * roman skill - convert between arabic numbers and Roman numerals (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "convert 42 to roman", "what is XIV in numbers", "1994 in roman", "roman for 8", "what does XL mean".
 */
const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
];
function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return null;
  let s = '';
  for (const [v, r] of ROMAN) {
    while (n >= v) { s += r; n -= v; }
  }
  return s;
}
function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  s = String(s || '').toUpperCase().replace(/[^IVXLCDM]/g, '');
  if (!s || !/^[IVXLCDM]+$/.test(s)) return null;
  let n = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = map[s[i]];
    n += v < prev ? -v : v;
    prev = v;
  }
  return n > 0 && n <= 3999 ? n : null;
}
function romanOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  if (!t || /history|empire|city|rome|coliseum|gladiator|emperor/.test(t)) return null;
  // number to roman
  let m = t.match(/(?:convert\s+)?(\d+)\s+(?:to|in|as)\s+roman/)
    || t.match(/roman\s+(?:for|of|numeral\s+for)\s+(\d+)/)
    || t.match(/^(\d+)\s+(?:in|to)\s+roman$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const r = toRoman(n);
    return r ? { dir: 'to', n, r } : null;
  }
  // roman to number
  m = t.match(/what\s+is\s+([ivxlcdm]+)\s+(?:in\s+)?(?:numbers?|arabic|decimal)/i)
    || t.match(/([ivxlcdm]+)\s+(?:in|to)\s+(?:numbers?|arabic|decimal)/i)
    || t.match(/what\s+does\s+([ivxlcdm]+)\s+mean/i)
    || t.match(/^([ivxlcdm]+)$/i);
  if (m) {
    const r = m[1].toUpperCase();
    const n = fromRoman(r);
    return n ? { dir: 'from', n, r } : null;
  }
  return null;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = romanOf(text);
  if (!q) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Roman numerals</h2>'
      + '<div class="sub">' + esc(q.dir === 'to' ? q.n + ' → ' : q.r + ' → ') + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
      + esc(q.dir === 'to' ? q.r : String(q.n)) + '</div>'
      + '<p style="color:#8a8a8a">Standard subtractive notation, 1–3999. Not for years before the common era or modern variants.</p>'
      + '<div class="src">Pure conversion · as of Oct 2026</div>';
  });
  return 'roman';
}
export default {
  name: 'roman',
  examples: [
    'convert 42 to roman',
    'what is XIV in numbers',
    '1994 in roman',
    'roman for 8',
    'what does XL mean'
  ],
  nearMisses: [
    'roman history',
    'rome',
    'the roman empire'
  ],
  match(lower, text) { return !!romanOf(text); },
  run
};
