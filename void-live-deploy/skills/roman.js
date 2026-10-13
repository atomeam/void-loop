/**
 * roman skill — convert numbers to and from Roman numerals (pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roman numerals for 42", "42 in roman", "what is XLII", "XLII as a number".
 */
const ROMAN = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
export function toRoman(n) {
  n = Math.floor(+n); if (!n || n < 1 || n > 3999) return null;
  let s = ''; for (const [k,v] of ROMAN) while (n >= v) { s += k; n -= v; } return s;
}
export function fromRoman(s) {
  s = String(s || '').toUpperCase().replace(/[^IVXLCDM]/g, ''); if (!s || s.length > 15) return null;
  let n = 0, i = 0;
  for (const [k,v] of ROMAN) while (s.startsWith(k, i)) { n += v; i += k.length; }
  return i === s.length && n ? n : null;
}
export function romanOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(?:what is |show |give me )?(?:the )?roman numerals? (?:for|of) (\d{1,4})$/) || t.match(/^(\d{1,4}) (?:in|as|to) roman(?: numerals)?$/);
  if (m) return { to: +m[1] };
  m = t.match(/^(?:what is |what number is |convert )?([ivxlcdm]+)(?: (?:as|to|in) (?:a )?(?:number|arabic|decimal))?$/);
  if (m && fromRoman(m[1])) return { from: m[1].toUpperCase() };
  return null;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = romanOf(text); if (!q) return 'none';
  if (q.to) {
    const r = toRoman(q.to);
    if (!r) { showPage((p) => { p.innerHTML = '<h2>Roman numerals</h2><p>Roman numerals go from 1 to 3999.</p>'; }); return 'roman'; }
    showPage((p) => { p.innerHTML = '<h2>' + esc(q.to) + ' in Roman</h2><div style="font-size:48px;font-weight:200;margin:12px 0">' + esc(r) + '</div><div class="sub">1–3999</div>'; });
  } else {
    const n = fromRoman(q.from);
    showPage((p) => { p.innerHTML = '<h2>' + esc(q.from) + '</h2><div style="font-size:48px;font-weight:200;margin:12px 0">' + n + '</div><div class="sub">as a number</div>'; });
  }
  return 'roman';
}
export default {
  name: 'roman',
  examples: ['roman numerals for 42', '42 in roman', 'what is XLII', 'XLII as a number'],
  nearMisses: ['what are roman numerals', 'history of the roman empire', 'roman holiday'],
  match(lower, text) { return !!romanOf(text || lower); },
  run,
  suite() {
    const ok = toRoman(42) === 'XLII' && toRoman(1994) === 'MCMXCIV' && toRoman(4) === 'IV' && fromRoman('XLII') === 42 && fromRoman('MCMXCIV') === 1994 && !toRoman(0) && !toRoman(4000) && fromRoman('IIII') === 4;
    return { ok, got: ok ? 'pass' : 'fail' };
  }
};
