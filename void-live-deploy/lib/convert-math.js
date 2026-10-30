/**
 * Pure maths and ask-reading for the convert card (skills/convert.js): unit tables, conversion both ways, the number as the
 * card shows it, and what an ask ("unit converter", "keep a converter for miles and km", "5 miles to km as a card") wants.
 * No DOM, no network. Factors: NIST SP 811. Tested with fixed inputs in tools/convert-math.test.mjs.
 */
// [label, factor to the kind's base unit, words that name it]; temperature is done by formula, not a factor
export const KINDS = {
  length: { label: 'Length', units: [['meters', 1, 'm|meters?|metres?'], ['kilometers', 1000, 'km|kilomet(?:er|re)s?'], ['centimeters', 0.01, 'cm|centimet(?:er|re)s?'], ['millimeters', 0.001, 'mm|millimet(?:er|re)s?'], ['miles', 1609.344, 'mi|miles?'], ['yards', 0.9144, 'yd|yards?'], ['feet', 0.3048, 'ft|feet|foot'], ['inches', 0.0254, 'in|inch(?:es)?'], ['nautical miles', 1852, 'nmi|nautical miles?']] },
  mass: { label: 'Weight', units: [['kilograms', 1, 'kg|kilos?|kilograms?'], ['grams', 0.001, 'g|grams?'], ['milligrams', 1e-6, 'mg|milligrams?'], ['pounds', 0.45359237, 'lbs?|pounds?'], ['ounces', 0.028349523125, 'oz|ounces?'], ['stone', 6.35029318, 'st|stones?'], ['metric tons', 1000, 'tonnes?|metric tons?'], ['US tons', 907.18474, 'tons?|short tons?|us tons?']] },
  volume: { label: 'Volume (cooking)', units: [['milliliters', 1, 'ml|millilit(?:er|re)s?'], ['liters', 1000, 'l|lit(?:er|re)s?'], ['cups (US)', 236.5882365, 'cups?'], ['tablespoons', 14.78676478125, 'tbsp|tbs|tablespoons?'], ['teaspoons', 4.92892159375, 'tsp|teaspoons?'], ['fluid ounces', 29.5735295625, 'fl oz|fluid ounces?'], ['pints (US)', 473.176473, 'pt|pints?'], ['quarts (US)', 946.352946, 'qt|quarts?'], ['gallons (US)', 3785.411784, 'gal|gallons?']] },
  temperature: { label: 'Temperature', units: [['Celsius', 0, 'c|°c|celsius|centigrade'], ['Fahrenheit', 0, 'f|°f|fahrenheit'], ['Kelvin', 0, 'k|kelvins?']] },
  speed: { label: 'Speed', units: [['km/h', 1 / 3.6, 'km/?h|kph|kmh'], ['mph', 0.44704, 'mph|miles per hour'], ['m/s', 1, 'm/s|meters per second'], ['knots', 1852 / 3600, 'knots?|kn|kt']] },
  area: { label: 'Area', units: [['square meters', 1, 'm2|m²|sq m|square met(?:er|re)s?'], ['square feet', 0.09290304, 'ft2|ft²|sq ft|square f(?:ee|oo)t'], ['acres', 4046.8564224, 'acres?'], ['hectares', 10000, 'ha|hectares?'], ['square km', 1e6, 'km2|km²|sq km|square kilomet(?:er|re)s?'], ['square miles', 2589988.110336, 'mi2|sq mi|square miles?']] },
  data: { label: 'Data', units: [['MB', 1048576, 'mb|megabytes?'], ['KB', 1024, 'kb|kilobytes?'], ['GB', 1073741824, 'gb|gigabytes?'], ['TB', 1099511627776, 'tb|terabytes?'], ['bytes', 1, 'b|bytes?']] },
  time: { label: 'Time', units: [['hours', 3600, 'h|hrs?|hours?'], ['minutes', 60, 'mins?|minutes?'], ['seconds', 1, 's|secs?|seconds?'], ['days', 86400, 'd|days?'], ['weeks', 604800, 'wks?|weeks?'], ['years', 31557600, 'yrs?|years?']] },
  energy: { label: 'Energy', units: [['kcal (food calories)', 4184, 'kcal|calories|calorie|cal'], ['kilojoules', 1000, 'kj|kilojoules?'], ['joules', 1, 'j|joules?'], ['kWh', 3.6e6, 'kwh|kilowatt[ -]hours?'], ['BTU', 1055.05585, 'btus?']] },
};
export const DEFAULT = { length: [4, 1], mass: [3, 0], volume: [2, 1], temperature: [0, 1], speed: [1, 0], area: [1, 0], data: [2, 0], time: [0, 1], energy: [0, 1] }; // the everyday pair each kind opens on
export const KIND_WORDS = [['temperature', /\b(?:temperature|temp|celsius|fahrenheit|kelvin|degrees?)\b/], ['volume', /\b(?:cooking|kitchen|recipe|baking|volume|liquid|cups?)\b/], ['mass', /\b(?:weight|mass|kg|pounds?|grams?)\b/], ['length', /\b(?:length|distance|height|metric|inch(?:es)?|feet|miles?)\b/], ['speed', /\bspeed\b/], ['area', /\barea\b/], ['data', /\b(?:data|file\s+size|bytes?)\b/], ['time', /\btime\b(?!\s+zones?)/], ['energy', /\b(?:energy|calories)\b/]];

export const unitIndex = (kind, w) => { w = String(w || '').trim().toLowerCase().replace(/\.$/, ''); return KINDS[kind].units.findIndex((u) => new RegExp('^(?:' + u[2] + ')$').test(w)); };
/** { kind, from, to } for two unit words of one kind, or null. Pure. */
export function pairOf(a, b) {
  for (const kind of Object.keys(KINDS)) { const i = unitIndex(kind, a), j = unitIndex(kind, b); if (i >= 0 && j >= 0 && i !== j) return { kind, from: i, to: j }; }
  return null;
}
/** the value in the kind's base unit (meters, kg, ml, °C, m/s, ...). Pure. */
export function toBase(kind, i, v) {
  if (kind === 'temperature') return i === 0 ? v : i === 1 ? (v - 32) * 5 / 9 : v - 273.15;
  return v * KINDS[kind].units[i][1];
}
export function fromBase(kind, i, v) {
  if (kind === 'temperature') return i === 0 ? v : i === 1 ? v * 9 / 5 + 32 : v + 273.15;
  return v / KINDS[kind].units[i][1];
}
export const convert = (kind, from, to, v) => fromBase(kind, to, toBase(kind, from, v));
/** a number as the card shows it: seven significant digits (1 TB is 1,048,576 MB, not 1,048,580), thousands grouped, very big or small in powers of ten. Pure. */
export function fmt(v) {
  if (!Number.isFinite(v)) return '';
  if (Object.is(v, -0) || Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e12 || a < 1e-4) return v.toExponential(4).replace(/\.?0+e/, 'e').replace('e+', ' × 10^').replace('e-', ' × 10^-');
  return (+v.toPrecision(7)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** the converter card's ask for what a page shows ("give me a converter for 5 m to km"), only when the card reads it back to the same
 *  number in a pair the page agrees with: `answer(word)` is the page's own result for `value` in the unit `word` names (NaN if it
 *  reads no such unit). With no second unit, the card's everyday partner for the first one is asked. '' otherwise. Pure. */
export function cardAsk(value, fromWords, toWords, answer) {
  const n = String(value); if (!Number.isFinite(value) || !/^-?\d+(?:\.\d+)?$/.test(n)) return '';
  const name = (u) => u[0].replace(/\s*\(.*\)$/, '');
  for (const a of fromWords) {
    const tos = toWords || Object.keys(KINDS).flatMap((k) => { const i = unitIndex(k, a), d = DEFAULT[k]; return i < 0 ? [] : [name(KINDS[k].units[i === d[0] ? d[1] : d[0]])]; });
    for (const b of tos) {
      const ask = 'give me a converter for ' + n + ' ' + a + ' to ' + b, q = askOf(ask), want = answer(b);
      if (!q || !Number.isInteger(q.from) || q.value !== value || !Number.isFinite(want)) continue;
      if (Math.abs(convert(q.kind, q.from, q.to, value) - want) <= 1e-9 * Math.max(1, Math.abs(want))) return ask;
    }
  }
  return '';
}

/** what an ask wants: { open, kind?, value?, from?, to? } or { close: true }, or null. Pure. */
export function askOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/\b(?:currency|money|exchange|time\s*zones?|pdf|video|image|file|audio|mp3|mp4|youtube|word|docx?|jpe?g|png|heic|text|case|binary|hex|roman|base|color|colour|number\s+to\s+words)\b/.test(t)) return null;
  if (/^(?:please\s+)?(?:close|remove|delete|hide|clear|get\s+rid\s+of)\s+(?:the\s+|my\s+)?(?:unit\s+|units\s+)?(?:converter|convert(?:er)?\s+card|conversion\s+card)(?:\s+please)?$/.test(t)) return { close: true };
  // "keep 5 miles to km as a card", "5 miles in km as a converter card": a one-off conversion kept (the tail names the card, so the plain "5 miles in km" stays the answer card's)
  const kp = t.match(/^(?:please\s+)?(?:keep|save|pin)?\s*(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*([a-z°²/ ]+?)\s+(?:to|in|into)\s+([a-z°²/ ]+?)\s+(?:as|on|in|into)\s+(?:a\s+|an\s+|the\s+|my\s+)?(?:converter|conversion|convert|unit)?\s*(?:card|converter)(?:\s+(?:here|on\s+(?:the\s+)?(?:stage|screen|page)))?(?:\s+please)?$/);
  if (kp) { const p = pairOf(kp[2], kp[3]); return p ? Object.assign({ open: true }, p, { value: +kp[1] }) : null; }
  const m = t.match(/^(?:please\s+)?(?:(?:open|show|make|add|give|put|keep|save|pin|bring\s+up|pull\s+up|start|i\s+(?:need|want))\s+(?:me\s+)?(?:up\s+)?)?(?:a\s+|an\s+|the\s+|my\s+)?(.*?)\s*(?:unit\s+|units\s+)?(?:converter|conversion\s+(?:card|calculator|tool|chart|table)|convert(?:er)?\s+card|unit\s+conversions?)(?:\s+(?:card|tool|app))?(?:\s+(?:for|with)\s+(.+?))?(?:\s+(?:here|on\s+(?:the\s+)?(?:stage|screen|page)))?(?:\s+please)?$/);
  if (!m) return /^convert\s+units$/.test(t) ? { open: true } : null;
  const pre = m[1].replace(/\b(?:unit|units|a|an|the|simple|quick|handy|metric\s+to\s+imperial|imperial\s+to\s+metric)\b/g, ' ').trim(), post = m[2] || '';
  const q = { open: true };
  const k = KIND_WORDS.find(([, re]) => re.test(pre) || re.test(post));
  if (pre && !k && !/^(?:metric|imperial|measurement|measurements|everyday|all|every)$/.test(pre)) return null; // "a pdf converter" and friends are not this card
  if (k) q.kind = k[0];
  const v = post.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°²/ ]+?)\s+(?:to|in|into|as)\s+([a-z°²/ ]+)$/);
  if (v) { const p = pairOf(v[2], v[3]); if (p) Object.assign(q, p, { value: +v[1] }); }
  else { const u = post.match(/^([a-z°²/ ]+?)\s+(?:and|to|vs|versus|<->|<=>|&)\s+([a-z°²/ ]+)$/); if (u) { const p = pairOf(u[1], u[2]); if (!p) return null; Object.assign(q, p); } } // "a converter for miles and km": the pair, no number yet
  return q;
}
