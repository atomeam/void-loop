/**
 * convert skill — simple unit conversions (length, weight, temperature, volume)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "5 miles in kilometers", "32 fahrenheit in celsius", "100 kg in pounds".
 */
const UNITS = {
  // length to meters
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  mile: 1609.344, miles: 1609.344, mi: 1609.344,
  yard: 0.9144, yards: 0.9144, yd: 0.9144,
  foot: 0.3048, feet: 0.3048, ft: 0.3048,
  inch: 0.0254, inches: 0.0254, in: 0.0254,
  // weight to grams
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  // volume to liters
  l: 1, liter: 1, liters: 1, litre: 1, litres: 1,
  ml: 0.001, milliliter: 0.001, milliliters: 0.001,
  gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784,
  qt: 0.946352946, quart: 0.946352946, quarts: 0.946352946,
  pt: 0.473176473, pint: 0.473176473, pints: 0.473176473,
  cup: 0.236588236, cups: 0.236588236
};
const TEMP = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };
export function convertOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  let m = t.match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:in|to|as)\s+([a-z]+)$/);
  if (!m) m = t.match(/^(-?\d+(?:\.\d+)?)\s+([a-z]+)\s+(?:in|to|as)\s+([a-z]+)$/);
  if (!m) return null;
  const n = +m[1], from = m[2], to = m[3];
  if (TEMP[from] && TEMP[to]) return { kind: 'temp', n, from: TEMP[from], to: TEMP[to] };
  if (UNITS[from] && UNITS[to] && (UNITS[from] > 10 && UNITS[to] > 10 || UNITS[from] < 10 && UNITS[to] < 10 || from === to)) {
    const isLen = (u) => /^(m|meter|metre|km|kilometer|kilometre|cm|centimeter|mm|millimeter|mile|yard|foot|feet|inch|mi|yd|ft|in)s?$/.test(u);
    const isWgt = (u) => /^(g|gram|kg|kilogram|lb|lbs|pound|oz|ounce)s?$/.test(u);
    const isVol = (u) => /^(l|liter|litre|ml|milliliter|gal|gallon|qt|quart|pt|pint|cup)s?$/.test(u);
    if ((isLen(from) && isLen(to)) || (isWgt(from) && isWgt(to)) || (isVol(from) && isVol(to))) return { kind: 'unit', n, from, to };
  }
  return null;
}
function tempConvert(n, from, to) {
  let c = from === 'c' ? n : from === 'f' ? (n - 32) * 5 / 9 : n - 273.15;
  if (to === 'c') return c;
  if (to === 'f') return c * 9 / 5 + 32;
  return c + 273.15;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = convertOf(text);
  if (!q) return 'none';
  let result, unit;
  if (q.kind === 'temp') {
    result = tempConvert(q.n, q.from, q.to);
    unit = q.to === 'c' ? '°C' : q.to === 'f' ? '°F' : 'K';
  } else {
    result = q.n * UNITS[q.from] / UNITS[q.to];
    unit = q.to;
  }
  const nice = Number.isInteger(result) ? String(result) : result.toFixed(4).replace(/\.?0+$/, '');
  showPage((el) => {
    el.innerHTML = '<h2>Convert</h2><div style="font-size:32px;font-weight:300;margin:12px 0">' + esc(q.n + ' ' + q.from + ' = ' + nice + ' ' + unit) + '</div><div class="src">exact factors for SI and common US units</div>';
  });
  return 'convert';
}
export default {
  name: 'convert',
  examples: [
    '5 miles in kilometers',
    '32 fahrenheit in celsius',
    '100 kg in pounds'
  ],
  nearMisses: [
    'convert currency',
    'what is a kilometer'
  ],
  match(lower, text) { return !!convertOf(text); },
  run,
  suite() {
    const ok = convertOf('5 miles in kilometers') && convertOf('32 fahrenheit in celsius') && Math.abs(tempConvert(32, 'f', 'c')) < 0.01 && !convertOf('convert currency');
    return { ok: !!ok, got: ok ? 'units matched' : 'failed' };
  }
};
