/**
 * convert skill — unit conversions (pure math, no key, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "100 km in miles", "32 fahrenheit to celsius", "5 feet in cm", "10 kg to lb".
 * Empty surface stays empty: only answers its own asks.
 */
const TO_BASE = {
  // length → metres
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
  cm: 0.01, mm: 0.001,
  mile: 1609.344, miles: 1609.344, mi: 1609.344,
  ft: 0.3048, feet: 0.3048, foot: 0.3048,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  // mass → grams
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
};
const LEN = new Set(['m','meter','meters','metre','metres','km','kilometer','kilometers','kilometre','kilometres','cm','mm','mile','miles','mi','ft','feet','foot','in','inch','inches','yd','yard','yards']);
const MASS = new Set(['g','gram','grams','kg','kilogram','kilograms','lb','lbs','pound','pounds','oz','ounce','ounces']);
function tempToC(v, u) {
  u = String(u).toLowerCase();
  if (u === 'c' || u === 'celsius' || u === 'centigrade') return v;
  if (u === 'f' || u === 'fahrenheit') return (v - 32) * 5 / 9;
  if (u === 'k' || u === 'kelvin') return v - 273.15;
  return null;
}
function fromC(c, u) {
  u = String(u).toLowerCase();
  if (u === 'c' || u === 'celsius' || u === 'centigrade') return c;
  if (u === 'f' || u === 'fahrenheit') return c * 9 / 5 + 32;
  if (u === 'k' || u === 'kelvin') return c + 273.15;
  return null;
}
export function convertOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw;
  // temperature: "32 fahrenheit to celsius", "100 c in f", "0 c to k"
  let m = t.match(/^(-?\d+(?:\.\d+)?)\s*(celsius|centigrade|fahrenheit|kelvin|c|f|k)\s+(?:to|in|as)\s+(celsius|centigrade|fahrenheit|kelvin|c|f|k)$/i);
  if (m) return { kind: 'temp', v: +m[1], from: m[2], to: m[3] };
  // length / mass: "100 km in miles", "10 kg to lb", "5 feet in cm"
  m = t.match(/^(\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?|mi|m|meters?|metres?|ft|feet|foot|in|inches?|inch|cm|mm|yd|yards?|kg|kilograms?|lb|lbs|pounds?|g|grams?|oz|ounces?)\s+(?:to|in|as)\s+(km|kilometers?|kilometres?|miles?|mi|m|meters?|metres?|ft|feet|foot|in|inches?|inch|cm|mm|yd|yards?|kg|kilograms?|lb|lbs|pounds?|g|grams?|oz|ounces?)$/i);
  if (m) return { kind: 'unit', v: +m[1], from: m[2].toLowerCase(), to: m[3].toLowerCase() };
  return null;
}
function convertUnit(v, from, to) {
  const f = TO_BASE[from], t = TO_BASE[to];
  if (f == null || t == null) return null;
  const same = (LEN.has(from) && LEN.has(to)) || (MASS.has(from) && MASS.has(to));
  if (!same) return null;
  return v * f / t;
}
function nice(n) {
  if (!Number.isFinite(n)) return null;
  const a = Math.abs(n);
  const d = a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4;
  return Math.round(n * 10 ** d) / 10 ** d;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = convertOf(text);
  if (!q) return 'none';
  let result, fromLabel, toLabel;
  if (q.kind === 'temp') {
    const c = tempToC(q.v, q.from);
    if (c == null) return 'none';
    const out = fromC(c, q.to);
    if (out == null) return 'none';
    result = nice(out);
    fromLabel = q.v + ' ' + q.from;
    toLabel = result + ' ' + q.to;
  } else {
    const out = convertUnit(q.v, q.from, q.to);
    if (out == null) return 'none';
    result = nice(out);
    fromLabel = q.v + ' ' + q.from;
    toLabel = result + ' ' + q.to;
  }
  if (result == null) return 'none';
  const label = fromLabel + ' = ' + toLabel;
  showPage((p) => { p.innerHTML = '<h2>Convert</h2><div style="font-size:36px;font-weight:300;line-height:1.3">' + esc(label) + '</div><p style="color:#8a8a8a">pure math · say another conversion</p>'; });
  return 'convert';
}
export default {
  name: 'convert',
  examples: ['100 km in miles', '32 fahrenheit to celsius', '5 feet in cm', '10 kg to lb', '100 c to f'],
  nearMisses: ['how far is london from paris', 'what is a kilometer', 'weather in tokyo', 'distance from nyc to boston'],
  match(lower, text) { return !!convertOf(text); },
  run
};
