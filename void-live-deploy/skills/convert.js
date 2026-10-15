/**
 * convert skill - a unit converter that stays on the stage (asked by Void, daily 2026-10-14 ask-20261014-1820-2:
 * "a 'convert-card' skill that outputs a persistent, interactive UI element for unit conversions on the stage").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "unit converter", "open a converter", "temperature converter", "cooking converter", "a converter for 5 miles to km".
 * Copied from the best: Google's unit converter (a kind picker, two linked fields that convert both ways, a swap) and
 * one notch past it: every other unit of the kind listed under the pair, and the card is a stage thing, so its kind,
 * units and number are saved and survive a reload. One-off asks ("5 miles in km") still go to the page's answer card;
 * this card is for when you keep converting. Factors: NIST SP 811 (exact where defined: inch 2.54 cm, pound 0.45359237 kg,
 * US gallon 231 in³). Pure maths is in `toBase`/`fromBase`/`convert` (tested in tools/test_void.mjs, "convert card").
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
const DEFAULT = { length: [4, 1], mass: [3, 0], volume: [2, 1], temperature: [0, 1], speed: [1, 0], area: [1, 0], data: [2, 0], time: [0, 1], energy: [0, 1] }; // the everyday pair each kind opens on
const KIND_WORDS = [['temperature', /\b(?:temperature|temp|celsius|fahrenheit|kelvin|degrees?)\b/], ['volume', /\b(?:cooking|kitchen|recipe|baking|volume|liquid|cups?)\b/], ['mass', /\b(?:weight|mass|kg|pounds?|grams?)\b/], ['length', /\b(?:length|distance|height|metric|inch(?:es)?|feet|miles?)\b/], ['speed', /\bspeed\b/], ['area', /\barea\b/], ['data', /\b(?:data|file\s+size|bytes?)\b/], ['time', /\btime\b(?!\s+zones?)/], ['energy', /\b(?:energy|calories)\b/]];

const unitIndex = (kind, w) => { w = String(w || '').trim().toLowerCase().replace(/\.$/, ''); return KINDS[kind].units.findIndex((u) => new RegExp('^(?:' + u[2] + ')$').test(w)); };
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

/** what an ask wants: { open, kind?, value?, from?, to? } or { close: true }, or null. Pure. */
export function askOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/\b(?:currency|money|exchange|time\s*zones?|pdf|video|image|file|audio|mp3|mp4|youtube|word|docx?|jpe?g|png|heic|text|case|binary|hex|roman|base|color|colour|number\s+to\s+words)\b/.test(t)) return null;
  if (/^(?:please\s+)?(?:close|remove|delete|hide|clear|get\s+rid\s+of)\s+(?:the\s+|my\s+)?(?:unit\s+|units\s+)?(?:converter|convert(?:er)?\s+card|conversion\s+card)(?:\s+please)?$/.test(t)) return { close: true };
  const m = t.match(/^(?:please\s+)?(?:(?:open|show|make|add|give|put|bring\s+up|pull\s+up|start|i\s+(?:need|want))\s+(?:me\s+)?(?:up\s+)?)?(?:a\s+|an\s+|the\s+|my\s+)?(.*?)\s*(?:unit\s+|units\s+)?(?:converter|conversion\s+(?:card|calculator|tool|chart|table)|convert(?:er)?\s+card|unit\s+conversions?)(?:\s+(?:card|tool|app))?(?:\s+(?:for|with)\s+(.+?))?(?:\s+(?:here|on\s+(?:the\s+)?(?:stage|screen|page)))?(?:\s+please)?$/);
  if (!m) return /^convert\s+units$/.test(t) ? { open: true } : null;
  const pre = m[1].replace(/\b(?:unit|units|a|an|the|simple|quick|handy|metric\s+to\s+imperial|imperial\s+to\s+metric)\b/g, ' ').trim(), post = m[2] || '';
  const q = { open: true };
  const k = KIND_WORDS.find(([, re]) => re.test(pre) || re.test(post));
  if (pre && !k && !/^(?:metric|imperial|measurement|measurements|everyday|all|every)$/.test(pre)) return null; // "a pdf converter" and friends are not this card
  if (k) q.kind = k[0];
  const v = post.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°²/ ]+?)\s+(?:to|in|into|as)\s+([a-z°²/ ]+)$/);
  if (v) { const p = pairOf(v[2], v[3]); if (p) Object.assign(q, p, { value: +v[1] }); }
  return q;
}

function mount(th, stageApi) {
  const kind = KINDS[th.ckind] ? th.ckind : 'length';
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card convert-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(340px, calc(100vw - 20px))';
  const FIELD = 'background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:6px 8px;font:inherit;color-scheme:dark;'; // the dark fields the stage cards use
  const stop = (n) => { n.addEventListener('pointerdown', (e) => e.stopPropagation()); n.addEventListener('keydown', (e) => e.stopPropagation()); return n; };
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Convert</span><span class="g-sub">stays here · type in either box</span>';
  const pick = stop(document.createElement('select')); pick.className = 'cv-kind'; pick.setAttribute('aria-label', 'What to convert');
  for (const [k, d] of Object.entries(KINDS)) { const o = document.createElement('option'); o.value = k; o.textContent = d.label; pick.appendChild(o); }
  pick.value = kind; pick.style.cssText = FIELD + 'width:100%;margin:8px 0 6px';
  const side = (cls, label) => {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin:4px 0';
    const inp = stop(document.createElement('input')); inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = cls + '-val'; inp.setAttribute('aria-label', label + ' amount'); inp.style.cssText = FIELD + 'flex:1;min-width:0;font-size:18px';
    const sel = stop(document.createElement('select')); sel.className = cls + '-unit'; sel.setAttribute('aria-label', label + ' unit'); sel.style.cssText = FIELD + 'flex:1;min-width:0';
    row.append(inp, sel); return { row, inp, sel };
  };
  const A = side('cv-from', 'From'), B = side('cv-to', 'To');
  const swap = stop(document.createElement('button')); swap.type = 'button'; swap.className = 'g-btn cv-swap'; swap.textContent = '⇅ swap'; swap.setAttribute('aria-label', 'Swap the units');
  const all = document.createElement('div'); all.className = 'cv-all g-sub'; all.setAttribute('aria-live', 'polite'); all.style.cssText = 'display:block;margin-top:8px;white-space:pre-line;line-height:1.5';
  const src = document.createElement('div'); src.className = 'src'; src.style.cssText = 'margin-top:6px;font-size:11px;opacity:.7'; src.textContent = 'Factors: NIST SP 811 · US cups and gallons';
  el.append(head, pick, A.row, swap, B.row, all, src);

  const fill = (k) => { for (const s of [A.sel, B.sel]) { s.innerHTML = ''; KINDS[k].units.forEach((u, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = u[0]; s.appendChild(o); }); } };
  const state = () => ({ k: pick.value, f: +A.sel.value, t: +B.sel.value });
  const num = (s) => { const n = parseFloat(String(s).replace(/,/g, '').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
  const others = () => { const { k, f } = state(), v = num(A.inp.value); if (!Number.isFinite(v)) { all.textContent = ''; return; }
    all.textContent = fmt(v) + ' ' + KINDS[k].units[f][0] + ' is also\n' + KINDS[k].units.map((u, i) => i === f || i === +B.sel.value ? null : fmt(convert(k, f, i, v)) + ' ' + u[0]).filter(Boolean).join(' · '); };
  const keep = () => { const { k, f, t } = state(); th.ckind = k; th.from = f; th.to = t; th.value = num(A.inp.value); stageApi.save(); };
  const fromA = () => { const { k, f, t } = state(), v = num(A.inp.value); B.inp.value = Number.isFinite(v) ? fmt(convert(k, f, t, v)) : ''; others(); keep(); };
  const fromB = () => { const { k, f, t } = state(), v = num(B.inp.value); if (Number.isFinite(v)) A.inp.value = fmt(convert(k, t, f, v)); others(); keep(); };
  fill(kind);
  const d = DEFAULT[kind], n = KINDS[kind].units.length;
  A.sel.value = String(Number.isInteger(th.from) && th.from < n ? th.from : d[0]);
  B.sel.value = String(Number.isInteger(th.to) && th.to < n && th.to !== +A.sel.value ? th.to : d[1]);
  A.inp.value = fmt(Number.isFinite(th.value) ? th.value : 1);
  pick.addEventListener('change', () => { fill(pick.value); const dd = DEFAULT[pick.value]; A.sel.value = String(dd[0]); B.sel.value = String(dd[1]); fromA(); });
  A.inp.addEventListener('input', fromA); A.sel.addEventListener('change', fromA);
  B.inp.addEventListener('input', fromB); B.sel.addEventListener('change', fromA);
  swap.addEventListener('click', (e) => { e.stopPropagation(); const f = A.sel.value; A.sel.value = B.sel.value; B.sel.value = f; A.inp.value = B.inp.value || A.inp.value; fromA(); });
  fromA();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

const cards = (api) => Object.values(api.stage.things()).filter((t) => t && t.kind === 'convert');

function run(text, api) {
  const q = askOf(text);
  if (!q) return 'none';
  if (q.close) {
    const c = cards(api);
    if (!c.length) { api.say('There is no converter on the stage · ask "unit converter" to open one'); return 'convert'; }
    for (const t of c) delete api.stage.things()[t.id];
    api.stage.save(); api.stage.render(); api.say('Converter put away'); return 'convert';
  }
  const set = {};
  if (q.kind) { set.ckind = q.kind; const d = DEFAULT[q.kind]; set.from = d[0]; set.to = d[1]; }
  if (Number.isInteger(q.from)) { set.from = q.from; set.to = q.to; set.value = q.value; }
  const mine = cards(api)[0];
  if (mine) { Object.assign(mine, set); api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(mine.id); }
  else api.summon('convert', Object.assign({ ckind: 'length', value: 1, center: true }, set));
  const k = KINDS[set.ckind || (mine && mine.ckind) || 'length'];
  api.say((mine ? 'Your converter' : 'A converter') + ' is on the stage · ' + k.label.toLowerCase() + ' now; pick another kind on the card · it stays after a reload');
  return 'convert';
}

export default {
  name: 'convert',
  examples: [
    'unit converter',
    'convert card',
    'open a converter',
    'temperature converter',
    'cooking converter',
    'give me a converter for 5 miles to km',
    'close the converter'
  ],
  nearMisses: [
    '5 miles in km',
    'convert 3 cups to ml',
    'currency converter',
    'pdf converter',
    'time zone converter',
    'calculator'
  ],
  match(lower, text) { return !!askOf(text || lower); },
  run,
  stageKinds: { convert: { mount } },
};
