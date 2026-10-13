/**
 * roman skill — convert to/from Roman numerals (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "42 in roman", "what is MCMXCIX", "roman for 1999".
 */
const ROMAN = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
function toRoman(num) {
  if (num < 1 || num > 3999) return null;
  let out = '';
  for (const [sym, val] of ROMAN) {
    while (num >= val) { out += sym; num -= val; }
  }
  return out;
}
function fromRoman(str) {
  const s = String(str || '').toUpperCase();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let num = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const val = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}[s[i]];
    if (!val) return null;
    num += val < prev ? -val : val;
    prev = val;
  }
  return num > 0 && num < 4000 ? num : null;
}
function parseRoman(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const to = t.match(/(?:what\s+is\s+|roman\s+(?:for|of)\s+|in\s+roman(?:\s+numerals?)?\s+)?(\d{1,4})\s*(?:in\s+roman|as\s+roman)?/i) ||
             t.match(/(\d{1,4})\s+in\s+roman/i);
  if (to) {
    const n = parseInt(to[1], 10);
    if (n >= 1 && n <= 3999) return { to: n };
  }
  const from = t.match(/(?:what\s+is\s+|roman\s+)?([IVXLCDM]{2,})/i);
  if (from && fromRoman(from[1])) return { from: from[1].toUpperCase() };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseRoman(text);
  if (!q) return 'none';
  if (q.to) {
    const r = toRoman(q.to);
    showPage((p) => { p.innerHTML = '<h2>Roman</h2><div style="font-size:48px;font-weight:300;margin:8px 0">' + esc(r) + '</div><div class="sub">' + q.to + ' in Roman numerals</div>'; });
  } else {
    const n = fromRoman(q.from);
    showPage((p) => { p.innerHTML = '<h2>Roman</h2><div style="font-size:48px;font-weight:300;margin:8px 0">' + n + '</div><div class="sub">' + esc(q.from) + ' as a number</div>'; });
  }
  return 'roman';
}
export default {
  name: 'roman',
  examples: ['42 in roman', 'what is MCMXCIX', 'roman for 1999', 'XIV'],
  nearMisses: ['roman history', 'what is a roman', 'italy'],
  match(lower, text) { return !!parseRoman(text); },
  run
};
