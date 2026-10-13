/**
 * convert skill — unit conversions (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "10 miles to km", "100 f to c", "5 kg to pounds", "convert 32 fahrenheit to celsius".
 */
const UNITS = {
  mile: { to: 'km', factor: 1.60934, name: 'miles', target: 'kilometers' },
  miles: { to: 'km', factor: 1.60934, name: 'miles', target: 'kilometers' },
  km: { to: 'mile', factor: 0.621371, name: 'kilometers', target: 'miles' },
  kilometers: { to: 'mile', factor: 0.621371, name: 'kilometers', target: 'miles' },
  f: { to: 'c', factor: null, name: 'fahrenheit', target: 'celsius' },
  fahrenheit: { to: 'c', factor: null, name: 'fahrenheit', target: 'celsius' },
  c: { to: 'f', factor: null, name: 'celsius', target: 'fahrenheit' },
  celsius: { to: 'f', factor: null, name: 'celsius', target: 'fahrenheit' },
  kg: { to: 'lb', factor: 2.20462, name: 'kilograms', target: 'pounds' },
  kilograms: { to: 'lb', factor: 2.20462, name: 'kilograms', target: 'pounds' },
  lb: { to: 'kg', factor: 0.453592, name: 'pounds', target: 'kilograms' },
  pounds: { to: 'kg', factor: 0.453592, name: 'pounds', target: 'kilograms' },
};
function convertOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  let m = t.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)\s+to\s+([a-z]+)$/);
  if (!m) m = t.match(/^convert\s+(\d+(?:\.\d+)?)\s*([a-z]+)\s+to\s+([a-z]+)$/);
  if (!m) return null;
  const val = +m[1], from = m[2], to = m[3];
  const u = UNITS[from];
  if (!u || (u.to !== to && u.target !== to && u.name !== to)) return null;
  return { val, from: u.name, to: u.target, factor: u.factor, isTemp: u.factor == null };
}
function doConvert(q) {
  if (q.isTemp) {
    if (q.from.startsWith('f')) return (q.val - 32) * 5 / 9;
    return q.val * 9 / 5 + 32;
  }
  return q.val * q.factor;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = convertOf(text);
  if (!q) return 'none';
  const result = doConvert(q);
  showPage((el) => {
    el.innerHTML = '<h2>Convert</h2><div style="font-size:36px;font-weight:300;margin:12px 0">' + esc(q.val + ' ' + q.from + ' = ' + result.toFixed(2) + ' ' + q.to) + '</div><div class="sub">pure math · as of 2026-10</div>';
  });
  return 'convert';
}
export default {
  name: 'convert',
  examples: ['10 miles to km', '100 f to c', '5 kg to pounds', 'convert 32 fahrenheit to celsius'],
  nearMisses: ['what is a mile', 'convert currency', '10 dollars to euros'],
  match(lower, text) { return !!convertOf(text); },
  run
};
