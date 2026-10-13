/**
 * units skill — convert common units (pure math, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "5 miles to km", "100 fahrenheit to celsius", "2 cups to ml", "how many ounces in a pound".
 */
const FACTORS = {
  // length to meters
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  // mass to grams
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  // volume to ml
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  cup: 236.588, cups: 236.588,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  'fl oz': 29.5735, floz: 29.5735
};
const TEMP = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };

export function parseUnits(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!t) return null;
  // temperature
  let m = t.match(/^(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*(c|celsius|f|fahrenheit|k|kelvin)\s+(?:to|in)\s+(c|celsius|f|fahrenheit|k|kelvin)$/);
  if (m) return { kind: 'temp', value: +m[1], from: TEMP[m[2]], to: TEMP[m[3]] };
  // general: N unit to unit
  m = t.match(/^(?:convert\s+|how\s+many\s+)?(-?\d+(?:\.\d+)?)\s+([a-z ]+?)\s+(?:to|in)\s+([a-z ]+)$/);
  if (m) {
    const from = m[2].trim(), to = m[3].trim();
    if (FACTORS[from] && FACTORS[to]) return { kind: 'factor', value: +m[1], from, to };
  }
  // "how many ounces in a pound"
  m = t.match(/^how\s+many\s+([a-z ]+)\s+in\s+(?:a\s+|an\s+)?([a-z ]+)$/);
  if (m && FACTORS[m[1]] && FACTORS[m[2]]) return { kind: 'factor', value: 1, from: m[2], to: m[1] };
  return null;
}

function convertTemp(v, from, to) {
  let c;
  if (from === 'c') c = v;
  else if (from === 'f') c = (v - 32) * 5 / 9;
  else c = v - 273.15;
  if (to === 'c') return c;
  if (to === 'f') return c * 9 / 5 + 32;
  return c + 273.15;
}

export function convert(q) {
  if (q.kind === 'temp') return convertTemp(q.value, q.from, q.to);
  return q.value * FACTORS[q.from] / FACTORS[q.to];
}

function nice(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 100) return n.toFixed(1).replace(/\.0$/, '');
  if (a >= 1) return n.toFixed(2).replace(/\.?0+$/, '');
  return n.toPrecision(3).replace(/\.?0+$/, '');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseUnits(text);
  if (!q) return 'none';
  const result = convert(q);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Units</h2>'
      + '<div style="font-size:26px;margin:12px 0">' + esc(nice(q.value) + ' ' + q.from + ' = ' + nice(result) + ' ' + q.to) + '</div>'
      + '<div class="sub">exact conversion</div>';
  });
  return 'units';
}

export default {
  name: 'units',
  examples: ['5 miles to km', '100 fahrenheit to celsius', '2 cups to ml', 'how many ounces in a pound', '10 kg to lb'],
  nearMisses: ['what is a mile', 'convert currency', 'miles per hour', 'how far is a mile'],
  match(lower, text) { return !!parseUnits(text); },
  run
};
