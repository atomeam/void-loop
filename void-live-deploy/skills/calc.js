/**
 * calc skill — one calculator on the stage: "open a calculator", "calculator 2+5" (worked out on the card), "remove the
 * calculator"; "make the calculator blue" edges it through the page's shared colours. A 3D pocket calculator above it
 * presses out the sum (skills/mini/calculator.js). Moved out of void.html in cleanup step 6. Most sums never reach it: the
 * answer card (showCalc in the page) takes "calculate ...", "what is ...", percents and units first. The page asks `ask`
 * (remove, a sum, open) at the place its calculator code always ran (`askAt`), and `ensure` for "make the calculator blue".
 */

/** a plain sum: + - * / and brackets, no eval. { ok, value } or { ok: false, error }. Pure. */
export function evaluateMath(source) {
  const text = (source || '').trim();
  let index = 0;
  const skip = () => { while (/\s/.test(text[index] || '')) index += 1; };
  const parseNumber = () => {
    skip();
    const start = index;
    let dots = 0, digits = 0;
    while (index < text.length) {
      const ch = text[index];
      if (/\d/.test(ch)) { digits += 1; index += 1; continue; }
      if (ch === '.' && dots === 0) { dots += 1; index += 1; continue; }
      break;
    }
    if (!digits) throw new Error('number expected');
    const value = Number(text.slice(start, index));
    if (!Number.isFinite(value)) throw new Error('invalid number');
    return value;
  };
  let parseExpression;
  const parsePrimary = () => {
    skip();
    if (text[index] === '(') {
      index += 1;
      const value = parseExpression();
      skip();
      if (text[index] !== ')') throw new Error('missing )');
      index += 1;
      return value;
    }
    if (text[index] === '+' || text[index] === '-') {
      const sign = text[index++] === '-' ? -1 : 1;
      return sign * parsePrimary();
    }
    return parseNumber();
  };
  const parseTerm = () => {
    let value = parsePrimary();
    while (true) {
      skip();
      const op = text[index];
      if (op !== '*' && op !== '/') break;
      index += 1;
      const rhs = parsePrimary();
      if (op === '/' && rhs === 0) throw new Error('division by zero');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  };
  parseExpression = () => {
    let value = parseTerm();
    while (true) {
      skip();
      const op = text[index];
      if (op !== '+' && op !== '-') break;
      index += 1;
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };
  try {
    if (!text) throw new Error('empty expression');
    const value = parseExpression();
    skip();
    if (index !== text.length) throw new Error('unexpected character');
    if (!Number.isFinite(value)) throw new Error('non-finite result');
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error.message || 'invalid expression' };
  }
}

const UNIT_CONVERSIONS = {
  length: {
    m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
    km: 1000, kilometer: 1000, kilometers: 1000,
    cm: 0.01, centimeter: 0.01, centimeters: 0.01,
    mm: 0.001, millimeter: 0.001, millimeters: 0.001,
    mi: 1609.344, mile: 1609.344, miles: 1609.344,
    yd: 0.9144, yard: 0.9144, yards: 0.9144,
    ft: 0.3048, foot: 0.3048, feet: 0.3048,
    in: 0.0254, inch: 0.0254, inches: 0.0254,
  },
  mass: {
    kg: 1, kilogram: 1, kilograms: 1,
    g: 0.001, gram: 0.001, grams: 0.001,
    lb: 0.453592, lbs: 0.453592, pound: 0.453592, pounds: 0.453592,
    oz: 0.0283495, ounce: 0.0283495, ounces: 0.0283495,
  },
  temp: { c: 'C', celsius: 'C', f: 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' },
};

/** value in `from` units as `to` units (length, mass, temperature), or null. Pure. */
export function convertUnits(value, from, to) {
  const { length, mass, temp } = UNIT_CONVERSIONS;
  if (length[from] !== undefined && length[to] !== undefined) return (value * length[from]) / length[to];
  if (mass[from] !== undefined && mass[to] !== undefined) return (value * mass[from]) / mass[to];
  if (temp[from] !== undefined && temp[to] !== undefined) {
    let celsius;
    if (temp[from] === 'C') celsius = value;
    else if (temp[from] === 'F') celsius = (value - 32) * 5 / 9;
    else if (temp[from] === 'K') celsius = value - 273.15;
    else return null;
    if (temp[to] === 'C') return celsius;
    if (temp[to] === 'F') return celsius * 9 / 5 + 32;
    if (temp[to] === 'K') return celsius + 273.15;
    return null;
  }
  return null;
}

/** the sum in an ask ("calculate …", "what is …", "calculator …", a bare sum, "15 percent of 240", "5 miles to km"), or
 *  null. Pure. */
export function expressionOf(raw) {
  const text = (raw || '').trim();
  const match = text.match(/^calculate\s+([\s\S]+)$/i) || text.match(/^what\s+is\s+([\s\S]+)$/i) || text.match(/^calc(?:ulator)?\s+([\s\S]+)$/i);
  if (match) return match[1].replace(/[?!]\s*$/, '').trim();
  if (/^[\d\s()+\-*/.%]+$/.test(text) || /^[\d\s()+\-*/.]+%\s*of\s*[\d\s()+\-*/.]+$/i.test(text)) return text;
  if (/(?:what\s+is\s+)?\d+(?:\.\d+)?\s*percent\s+of\s+\d+(?:\.\d+)?/i.test(text)) return text.replace(/^what\s+is\s+/i, '').replace(/percent/gi, '%');
  const conv = text.match(/^(?:convert\s+)?([\d.]+)\s+(\w+)\s+(?:in|to|as)\s+(\w+)$/i);
  if (conv) return `convert(${conv[1]}, "${conv[2]}", "${conv[3]}")`;
  return null;
}

/** work out what expressionOf found: a percent, a conversion, or a plain sum. Pure. */
export function evaluate(raw) {
  const text = (raw || '').trim();
  const percent = text.match(/^([\s\S]+?)\s*%\s*of\s*([\s\S]+)$/i);
  if (percent) {
    const left = evaluateMath(percent[1]), right = evaluateMath(percent[2]);
    if (!left.ok || !right.ok) return { ok: false, error: 'invalid percent expression' };
    const value = (left.value / 100) * right.value;
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: 'non-finite result' };
  }
  const conv = text.match(/^convert\(([\d.]+),\s*"([^"]+)",\s*"([^"]+)"\)$/);
  if (conv) {
    const from = conv[2].toLowerCase(), to = conv[3].toLowerCase(), converted = convertUnits(parseFloat(conv[1]), from, to);
    return converted === null ? { ok: false, error: `unknown units: ${from} to ${to}` } : { ok: true, value: converted };
  }
  return evaluateMath(text);
}

/** a result as the card shows it: 12 significant digits, no -0. Pure. */
export function formatResult(value) {
  if (Object.is(value, -0)) return '0';
  return String(Number(value.toPrecision(12)));
}

export function wantsCreate(lower) {
  if (/\b(remove|delete|get\s+rid|hide|clear)\b/.test(lower) && /\b(calculator|calc)\b/.test(lower)) return false;
  if (/^(a\s+)?calculator(\s+please)?\s*[.!]?\s*$/.test(lower)) return true;
  if (/^calc(\s+please)?\s*[.!]?\s*$/.test(lower)) return true;
  return /\b(make|add|create|show|spawn|put|place|drop|open|start|launch|give\s+me|bring\s+up|pull\s+up)\b.*\b(calculator|calc)\b/.test(lower)
    || /\b(calculator|calc)\b.*\b(please|here|on\s+(the\s+)?(stage|screen|page))\b/.test(lower);
}

export function wantsRemove(lower) {
  return /\b(remove|delete|get\s+rid\s+of|hide|clear)\b.*\b(calculator|calc)\b/.test(lower)
    || /\b(calculator|calc)\b.*\b(away|gone)\b/.test(lower)
    || /^(remove|delete|hide|clear)\s+(the\s+)?(calculator|calc)(\s+please)?\s*[.!]?\s*$/.test(lower);
}

/** the plain asks the skill takes before the page's own parser: only opening one ("calculator", "open a calculator"). Sums
 *  go on to the page, so the answer card keeps "calculate …" and "what is …" as before. Pure. */
export const plainCalc = (lower) => /^(?:please\s+)?(?:(?:open|show|make|add|give\s+me|bring\s+up|pull\s+up)\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:calculator|calc)(?:\s+please)?\s*[.!]?$/.test(lower);

let typed = null; // the sum just asked for: its miniature presses the keys once, then later draws only show the result

/** the five 3D models (skills/mini/calculator.js MODELS, in the same order); a new card gets the next one round-robin (owner, 2026-10-25:
 *  "a cycle of all the existing calculators too for 3d, all with verse branding but also saying which model") */
export const CALC_MODELS = ['SL-200', 'FX-900', 'DT-12', 'RP-11', 'GX-84'];
export const MODEL_KEY = 'a2m.void.calcmodel.v1'; // how many calculators this device has made: the next model is that modulo five
export function nextModel() {
  let n = 0;
  try { n = parseInt(localStorage.getItem(MODEL_KEY) || '0', 10); if (!Number.isFinite(n) || n < 0) n = 0; } catch (_) { n = 0; }
  try { localStorage.setItem(MODEL_KEY, String(n + 1)); } catch (_) {}
  return CALC_MODELS[n % CALC_MODELS.length];
}

const calcs = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'calc');

/** the picked calculator, or the first one, or a new one; it is picked */
export function ensure(stageApi) {
  const sel = stageApi.things()[stageApi.selected()];
  let calc = (sel && sel.kind === 'calc' && sel) || calcs(stageApi)[0] || null;
  if (!calc) {
    const st = stageApi.stage;
    calc = { id: 'calc_' + Math.random().toString(36).slice(2, 9), kind: 'calc',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 130), y: Math.max(40, (st.clientHeight || 600) / 2 - 90), title: '', expression: '', result: '', model: nextModel() };
    stageApi.things()[calc.id] = calc;
  }
  stageApi.select(calc.id);
  return calc;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing calc-card';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) el.style.borderColor = th.color;
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';

  const title = document.createElement('div');
  title.className = 'calc-title';
  title.contentEditable = 'true';
  title.spellcheck = false;
  title.dataset.placeholder = 'Calculator · VERSE ' + (th.model || CALC_MODELS[0]); // which model its 3D one is (cards from before the models are the SL-200)
  title.textContent = th.title || '';
  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; stageApi.save(); });

  const expression = document.createElement('div');
  expression.className = 'calc-expression';
  expression.dataset.placeholder = 'Expression';
  expression.textContent = th.expression || '';

  const result = document.createElement('div');
  result.className = 'calc-result';
  result.dataset.placeholder = 'Result';
  result.textContent = th.result || '';

  el.appendChild(title);
  el.appendChild(expression);
  el.appendChild(result);
  // a 3D pocket calculator whose keys press out the sum, then show the result (skills/mini/calculator.js)
  const calcHost = document.createElement('div'); calcHost.className = 'calc-mini'; calcHost.style.cssText = 'height:150px;margin:-4px -6px 8px';
  el.insertBefore(calcHost, title);
  stageApi.miniature(calcHost, 'calculator', { expression: th.expression || '', result: th.result || '', typed: typed === th.id + '|' + th.expression, model: th.model || CALC_MODELS[0] },
    { key: 'calculator:' + th.id, label: '3D calculator, VERSE ' + (th.model || CALC_MODELS[0]) + (th.result ? ', showing ' + th.result : '') }).catch(() => calcHost.remove());
  stageApi.bindDrag(el, th);
  // the full page (owner, 2026-10-25: "theres no link to /calculator"): the scientific calculator with history and unit conversion, offline
  if (!(typeof location !== 'undefined' && /^\/calculator\//.test(location.pathname))) { const full = document.createElement('p'); full.className = 'calc-full'; full.style.cssText = 'text-align:center;font-size:13px;margin:4px 0 2px'; const a = document.createElement('a'); a.href = '/calculator/' + (th.expression ? '?e=' + encodeURIComponent(th.expression) : ''); a.style.color = 'inherit'; a.textContent = 'The full calculator page: scientific keys, memory, history, units'; a.addEventListener('pointerdown', (e) => e.stopPropagation()); full.appendChild(a); el.appendChild(full); }
  stageApi.stage.appendChild(el);
}

/** remove, a sum, or open, at the place the calculator code ran: what it did ('no calculator' when there is none to
 *  remove, 'calc-invalid' for a sum that cannot be worked out), or '' */
export function ask(lower, text, stageApi) {
  if (wantsRemove(lower)) {
    const sel = stageApi.things()[stageApi.selected()];
    const calc = (sel && sel.kind === 'calc' && sel) || calcs(stageApi)[0];
    if (!calc) return 'no calculator';
    delete stageApi.things()[calc.id];
    if (stageApi.selected() === calc.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'calc-removed';
  }
  const expr = expressionOf(text);
  if (expr !== null) {
    const computed = evaluate(expr);
    if (!computed.ok) return 'calc-invalid';
    const calc = ensure(stageApi);
    calc.expression = expr;
    calc.result = formatResult(computed.value);
    typed = calc.id + '|' + expr; // its miniature plays the key presses once
    stageApi.save(); stageApi.render();
    return 'calc-computed';
  }
  if (wantsCreate(lower)) { ensure(stageApi); stageApi.save(); stageApi.render(); return 'calc'; }
  return '';
}

export default {
  name: 'calc',
  examples: ['open a calculator', 'calculator', 'give me a calc'],
  nearMisses: ['calculate 12 * 3', 'what is 15 percent of 240'],
  match(lower) { return plainCalc(lower); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no calculator' && d !== 'calc-invalid' ? 'calc' : 'none'; },
  // askAt: the page asks this kind's ask at its own place, not in the early loop the counter and shape use
  stageKinds: { calc: { mount, ensure: (stageApi) => ensure(stageApi), ask, askAt: 'calc' } },
};
