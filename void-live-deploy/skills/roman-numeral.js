/**
 * roman-numeral skill — convert Arabic numbers to Roman and back (pure, no external)
 * "roman numeral for 42", "what is XLII in numbers", "convert 1999 to roman"
 */
const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
const VAL = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };

export function toRoman(n) {
  n = Math.floor(+n);
  if (!Number.isFinite(n) || n < 1 || n > 3999) return null;
  let out = '';
  for (const [v, s] of ROMAN) {
    while (n >= v) { out += s; n -= v; }
  }
  return out;
}

export function fromRoman(s) {
  const t = String(s || '').toUpperCase().replace(/[^IVXLCDM]/g, '');
  if (!t || !/^[IVXLCDM]+$/.test(t)) return null;
  let n = 0, prev = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    const v = VAL[t[i]];
    if (v < prev) n -= v; else n += v;
    prev = v;
  }
  return n > 0 && n <= 3999 ? n : null;
}

export function parseRomanAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:roman(?:\s+numeral)?(?:\s+(?:for|of))?|convert\s+to\s+roman(?:\s+numeral)?)\s*:?\s*(\d{1,4})$/i);
  if (m) return { mode: 'to', n: +m[1] };
  m = t.match(/^(?:what\s+is\s+)?(\d{1,4})\s+(?:in\s+)?roman(?:\s+numerals?)?$/i);
  if (m) return { mode: 'to', n: +m[1] };
  m = t.match(/^(?:what\s+is\s+|convert\s+)?([ivxlcdm]{1,15})\s+(?:in\s+)?(?:numbers?|arabic|decimal)$/i);
  if (m) return { mode: 'from', s: m[1] };
  m = t.match(/^([ivxlcdm]{1,15})\s+to\s+(?:numbers?|arabic|decimal)$/i);
  if (m) return { mode: 'from', s: m[1] };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseRomanAsk(text);
  if (!q) {
    showPage((p) => { p.innerHTML = '<h2>Roman numerals</h2><p>Say <b>roman numeral for 42</b> or <b>what is XLII in numbers</b>.</p>'; });
    return 'roman-numeral';
  }
  if (q.mode === 'to') {
    const r = toRoman(q.n);
    if (!r) {
      showPage((p) => { p.innerHTML = '<h2>Roman numerals</h2><p>Use a whole number from 1 to 3999.</p>'; });
      return 'roman-numeral';
    }
    showPage((p) => { p.innerHTML = '<h2>Roman numeral</h2><p style="font-size:36px;font-weight:600">' + esc(r) + '</p><div class="sub">' + q.n + '</div>'; });
    return 'roman-numeral';
  }
  const n = fromRoman(q.s);
  if (n === null) {
    showPage((p) => { p.innerHTML = '<h2>Roman numerals</h2><p>That does not look like a valid Roman numeral (1–3999).</p>'; });
    return 'roman-numeral';
  }
  showPage((p) => { p.innerHTML = '<h2>In numbers</h2><p style="font-size:36px;font-weight:600">' + n + '</p><div class="sub">' + esc(String(q.s).toUpperCase()) + '</div>'; });
  return 'roman-numeral';
}

export default {
  name: 'roman-numeral',
  examples: ['roman numeral for 42', 'what is XLII in numbers', 'convert 1999 to roman', 'MMXXIV in numbers'],
  nearMisses: ['what is a roman numeral', 'roman empire', 'latin numbers'],
  match(lower, text) { return !!parseRomanAsk(text || lower); },
  run,
  suite() {
    const ok = toRoman(42) === 'XLII' && fromRoman('XLII') === 42 && toRoman(1999) === 'MCMXCIX'
      && !!parseRomanAsk('roman numeral for 42') && !parseRomanAsk('what is a roman numeral');
    return { ok };
  },
};
