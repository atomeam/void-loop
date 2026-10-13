/**
 * units skill - convert common units (pure math, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "100 fahrenheit to celsius", "10 miles in km", "5 kg to pounds", "32 f to c".
 */
const FACTORS = {
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001,
  mile: 1609.344, miles: 1609.344, mi: 1609.344,
  yard: 0.9144, yards: 0.9144, yd: 0.9144,
  foot: 0.3048, feet: 0.3048, ft: 0.3048,
  inch: 0.0254, inches: 0.0254, in: 0.0254,
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125
};

function parseUnit(s) {
  s = s.toLowerCase().replace(/s$/, '').trim();
  return FACTORS[s] ? s : null;
}

export function unitsOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/(-?\d+(?:\.\d+)?)\s*(f|fahrenheit|c|celsius|k|kelvin)\s+(?:to|in|as)\s+(f|fahrenheit|c|celsius|k|kelvin)/);
  if (m) return { kind: 'temp', value: +m[1], from: m[2][0], to: m[3][0] };
  m = t.match(/(-?\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:to|in|as)\s+([a-z]+)/);
  if (m) {
    const from = parseUnit(m[2]), to = parseUnit(m[3]);
    if (from && to && FACTORS[from] && FACTORS[to]) return { kind: 'linear', value: +m[1], from, to, factorFrom: FACTORS[from], factorTo: FACTORS[to] };
  }
  return null;
}

function convertTemp(v, from, to) {
  let c = from === 'f' ? (v - 32) * 5 / 9 : from === 'k' ? v - 273.15 : v;
  if (to === 'f') return c * 9 / 5 + 32;
  if (to === 'k') return c + 273.15;
  return c;
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = unitsOf(text);
  if (!q) return 'none';
  let result, label, formula;
  if (q.kind === 'temp') {
    result = convertTemp(q.value, q.from, q.to);
    const names = { f: '°F', c: '°C', k: 'K' };
    label = q.value + names[q.from] + ' = ' + result.toFixed(2) + names[q.to];
    formula = 'C = (F − 32) × 5/9; F = C × 9/5 + 32; K = C + 273.15';
  } else {
    const base = q.value * q.factorFrom;
    result = base / q.factorTo;
    label = q.value + ' ' + q.from + ' = ' + result.toFixed(4).replace(/\.?0+$/, '') + ' ' + q.to;
    formula = 'via SI base unit (meters or grams)';
  }
  showPage((el) => {
    el.innerHTML = '<h2>Units</h2><div style="font-size:32px;font-weight:300;margin:10px 0">' + esc(label) + '</div>'
      + '<div class="sub">' + esc(formula) + '</div><div class="src">Pure math · as of Oct 2026</div>';
  });
  return 'units';
}

export default {
  name: 'units',
  examples: ['100 fahrenheit to celsius', '10 miles in km', '5 kg to pounds', '32 f to c'],
  nearMisses: ['unit of measurement history', 'how many units in a building', 'unit test'],
  match(lower, text) { return !!unitsOf(text || lower); },
  run,
  suite() {
    const a = unitsOf('100 fahrenheit to celsius'), b = unitsOf('10 miles in km'), c = unitsOf('5 kg to pounds');
    const ok = a && Math.abs(convertTemp(100, 'f', 'c') - 37.777) < 0.01 && b && Math.abs(10 * 1609.344 / 1000 - 16.093) < 0.01 && c && Math.abs(5 * 1000 / 453.59237 - 11.023) < 0.01 && !unitsOf('what is a unit');
    return { ok, got: ok ? 'pass' : 'fail' };
  }
};
