/**
 * convert-card skill — persistent interactive unit conversions on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "convert card", "unit converter", "open a conversion card". Leaves one-shot "5 miles to km" to calc.
 * Uses convertUnits from calc.js. Empty surface stays empty (no card until asked).
 */
import { convertUnits } from './calc.js';

const UNITS = {
  length: ['m', 'km', 'cm', 'mm', 'mi', 'yd', 'ft', 'in'],
  mass: ['kg', 'g', 'lb', 'oz'],
  temp: ['c', 'f', 'k'],
};

export function wantsConvertCard(lower) {
  const t = String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:open|show|make|add|give\s+me|bring\s+up)?\s*(?:a\s+|the\s+)?(?:convert(?:er)?\s+card|unit\s+converter|conversion\s+card|persistent\s+convert)(?:\s+please)?$/.test(t);
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing convert-card';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.cssText += ';min-width:220px;padding:12px;background:rgba(20,20,30,.9);border:1px solid rgba(255,255,255,.15);border-radius:12px;color:#fff;font:14px system-ui';
  const val = document.createElement('input'); val.type = 'number'; val.value = th.value || '1'; val.style.cssText = 'width:80px;margin-right:6px';
  const from = document.createElement('select');
  const to = document.createElement('select');
  const all = Object.values(UNITS).flat();
  for (const u of all) {
    from.add(new Option(u, u));
    to.add(new Option(u, u));
  }
  from.value = th.from || 'm';
  to.value = th.to || 'cm';
  const out = document.createElement('div'); out.style.cssText = 'margin-top:8px;font-size:18px;font-weight:500';
  const update = () => {
    const v = parseFloat(val.value) || 0;
    const res = convertUnits(v, from.value, to.value);
    out.textContent = res === null ? 'unknown units' : res.toPrecision(6).replace(/\.?0+$/, '');
    th.value = val.value; th.from = from.value; th.to = to.value; stageApi.save();
  };
  [val, from, to].forEach((e) => e.addEventListener('input', update));
  el.append(val, from, document.createTextNode(' → '), to, out);
  update();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function ensure(stageApi) {
  const sel = stageApi.things()[stageApi.selected()];
  let card = (sel && sel.kind === 'convert' && sel) || Object.values(stageApi.things()).find((t) => t && t.kind === 'convert') || null;
  if (!card) {
    const st = stageApi.stage;
    card = { id: 'conv_' + Math.random().toString(36).slice(2, 9), kind: 'convert',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 110), y: Math.max(40, (st.clientHeight || 600) / 2 - 60),
      value: '1', from: 'm', to: 'cm' };
    stageApi.things()[card.id] = card;
  }
  stageApi.select(card.id);
  return card;
}

function ask(lower, text, stageApi) {
  if (wantsConvertCard(lower)) { ensure(stageApi); stageApi.save(); stageApi.render(); return 'convert-card'; }
  return '';
}

export default {
  name: 'convert-card',
  examples: ['convert card', 'unit converter', 'open a conversion card'],
  nearMisses: ['convert 5 miles to km', 'what is 10 kg in pounds', 'calculator'],
  match(lower) { return wantsConvertCard(lower); },
  async run(text, api) {
    const d = ask(String(text || '').toLowerCase(), text, api.stage);
    return d ? 'convert-card' : 'none';
  },
  stageKinds: { convert: { mount, ensure, ask } },
  suite() {
    return { ok: convertUnits(1, 'm', 'cm') === 100 && convertUnits(32, 'f', 'c') === 0 };
  },
};
