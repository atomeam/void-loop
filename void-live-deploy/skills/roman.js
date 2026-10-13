/**
 * roman skill — convert between Arabic and Roman numerals
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "2026 in roman numerals", "what is XIV", "MMXXVI as a number".
 */
const MAP = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
export function toRoman(n) {
  n = Math.floor(+n);
  if (n < 1 || n > 3999 || !Number.isFinite(n)) return null;
  let s = '';
  for (const [r, v] of MAP) while (n >= v) { s += r; n -= v; }
  return s;
}
export function fromRoman(s) {
  s = String(s || '').toUpperCase().replace(/[^IVXLCDM]/g, '');
  if (!s || s.length > 15) return null;
  let n = 0, i = 0;
  for (const [r, v] of MAP) while (s.startsWith(r, i)) { n += v; i += r.length; }
  return i === s.length ? n : null;
}
export function romanOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what\s+is\s+|convert\s+)?(\d{1,4})\s+(?:in|to|as)\s+(?:roman(?:\s+numerals?)?)$/i);
  if (m) return { kind: 'to', n: +m[1] };
  m = t.match(/^(?:what\s+is\s+|convert\s+)?([IVXLCDM]{1,15})(?:\s+(?:in|to|as)\s+(?:a\s+)?(?:number|decimal|arabic))?$/i);
  if (m && fromRoman(m[1])) return { kind: 'from', s: m[1] };
  m = t.match(/^(?:roman(?:\s+numerals?)?\s+(?:for|of)\s+)(\d{1,4})$/i);
  if (m) return { kind: 'to', n: +m[1] };
  return null;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = romanOf(text);
  if (!q) return 'none';
  let title = 'Roman numerals', body = '', note = '';
  if (q.kind === 'to') {
    const r = toRoman(q.n);
    title = q.n + ' in Roman';
    body = r || 'too big (1–3999)';
  } else {
    const n = fromRoman(q.s);
    title = q.s + ' as a number';
    body = n != null ? String(n) : 'not a valid Roman numeral';
  }
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(title) + '</h2><div style="font-size:40px;font-weight:300;margin:12px 0">' + esc(body) + '</div><div class="src">standard Roman numerals (I=1 … M=1000)</div>';
  });
  return 'roman';
}
export default {
  name: 'roman',
  examples: [
    '2026 in roman numerals',
    'what is XIV',
    'MMXXVI as a number'
  ],
  nearMisses: [
    'roman empire',
    'who was the first roman emperor'
  ],
  match(lower, text) { return !!romanOf(text); },
  run,
  suite() {
    const ok = toRoman(2026) === 'MMXXVI' && fromRoman('XIV') === 14 && fromRoman('MMXXVI') === 2026 && romanOf('2026 in roman numerals') && !romanOf('roman empire');
    return { ok: !!ok, got: ok ? 'conversions correct' : 'failed' };
  }
};
