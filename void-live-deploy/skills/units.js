/**
 * units skill — convert between common units (pure math, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "convert 5 km to miles", "how many feet in a meter", "10 kg to pounds".
 * Empty surface stays empty.
 */
const UNITS = {
  km: { type: 'length', toM: 1000 },
  kilometer: { type: 'length', toM: 1000 },
  kilometers: { type: 'length', toM: 1000 },
  m: { type: 'length', toM: 1 },
  meter: { type: 'length', toM: 1 },
  meters: { type: 'length', toM: 1 },
  mi: { type: 'length', toM: 1609.344 },
  mile: { type: 'length', toM: 1609.344 },
  miles: { type: 'length', toM: 1609.344 },
  ft: { type: 'length', toM: 0.3048 },
  foot: { type: 'length', toM: 0.3048 },
  feet: { type: 'length', toM: 0.3048 },
  cm: { type: 'length', toM: 0.01 },
  centimeter: { type: 'length', toM: 0.01 },
  centimeters: { type: 'length', toM: 0.01 },
  in: { type: 'length', toM: 0.0254 },
  inch: { type: 'length', toM: 0.0254 },
  inches: { type: 'length', toM: 0.0254 },
  kg: { type: 'mass', toG: 1000 },
  kilogram: { type: 'mass', toG: 1000 },
  kilograms: { type: 'mass', toG: 1000 },
  g: { type: 'mass', toG: 1 },
  gram: { type: 'mass', toG: 1 },
  grams: { type: 'mass', toG: 1 },
  lb: { type: 'mass', toG: 453.592 },
  lbs: { type: 'mass', toG: 453.592 },
  pound: { type: 'mass', toG: 453.592 },
  pounds: { type: 'mass', toG: 453.592 },
  oz: { type: 'mass', toG: 28.3495 },
  ounce: { type: 'mass', toG: 28.3495 },
  ounces: { type: 'mass', toG: 28.3495 },
  c: { type: 'temp' },
  celsius: { type: 'temp' },
  f: { type: 'temp' },
  fahrenheit: { type: 'temp' }
};

function normUnit(u) {
  return String(u || '').toLowerCase().replace(/°/g, '').trim();
}

export function parseUnits(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:please\s+)?(?:convert\s+)?(\d+(?:\.\d+)?)\s+([a-zA-Z°]+)\s+(?:to|into)\s+([a-zA-Z°]+)$/i);
  if (m) return { value: parseFloat(m[1]), from: normUnit(m[2]), to: normUnit(m[3]) };
  m = t.match(/^(?:how many|how much)\s+([a-zA-Z°]+)\s+(?:in|are in)\s+(?:a|an|one)?\s*(\d+(?:\.\d+)?)?\s*([a-zA-Z°]+)$/i);
  if (m) return { value: m[2] ? parseFloat(m[2]) : 1, from: normUnit(m[3]), to: normUnit(m[1]) };
  return null;
}

export function convertUnits(q) {
  if (!q || !Number.isFinite(q.value)) return null;
  const from = UNITS[q.from], to = UNITS[q.to];
  if (!from || !to || from.type !== to.type) return null;
  if (from.type === 'temp') {
    if (q.from === 'c' || q.from === 'celsius') {
      if (q.to === 'f' || q.to === 'fahrenheit') return q.value * 9 / 5 + 32;
      return q.value;
    }
    if (q.from === 'f' || q.from === 'fahrenheit') {
      if (q.to === 'c' || q.to === 'celsius') return (q.value - 32) * 5 / 9;
      return q.value;
    }
    return null;
  }
  if (from.type === 'length') return q.value * from.toM / to.toM;
  if (from.type === 'mass') return q.value * from.toG / to.toG;
  return null;
}

async function run(text, api) {
  const q = parseUnits(text);
  if (!q) return 'none';
  const res = convertUnits(q);
  if (res == null) return 'none';
  const { showPage, esc } = api;
  const pretty = (n) => (Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : n.toFixed(2).replace(/\.?0+$/, ''));
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(q.value + ' ' + q.from) + ' → ' + esc(q.to) + '</h2>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(pretty(res)) + ' ' + esc(q.to) + '</div>'
      + '<div class="sub">exact conversion, no rounding until display</div>';
  });
  return 'units';
}

export default {
  name: 'units',
  examples: ['convert 5 km to miles', 'how many feet in a meter', '10 kg to pounds'],
  nearMisses: ['what is a kilometer', 'distance from London to Paris', 'how far is Tokyo from Osaka', 'tip on 45'],
  match(lower, text) { return !!parseUnits(text); },
  run,
  suite() {
    const q = parseUnits('convert 5 km to miles');
    const res = convertUnits(q);
    const ok = !!q && res != null && Math.abs(res - 3.106855) < 0.001 && parseUnits('what is a km') === null && convertUnits(parseUnits('how many feet in a meter')) != null;
    return { ok, got: res };
  }
};
