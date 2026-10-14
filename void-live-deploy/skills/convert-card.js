/**
 * convert-card skill — a persistent interactive unit conversion card on the stage.
 * "convert card", "unit converter", "add a conversion card".
 * Empty surface stays empty: only mounts when asked.
 * Reuses pure convert logic; card shows inputs for value, from, to, and live result.
 */
export const UNITS = {
  length: { m: 1, meter: 1, meters: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254 },
  mass: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 },
  temp: { c: 'C', f: 'F', k: 'K' },
};

export function convert(value, from, to) {
  const f = String(from || '').toLowerCase(), t = String(to || '').toLowerCase();
  const { length, mass, temp } = UNITS;
  if (length[f] !== undefined && length[t] !== undefined) return (value * length[f]) / length[t];
  if (mass[f] !== undefined && mass[t] !== undefined) return (value * mass[f]) / mass[t];
  if (temp[f] !== undefined && temp[t] !== undefined) {
    let c = temp[f] === 'C' ? value : temp[f] === 'F' ? (value - 32) * 5 / 9 : value - 273.15;
    return temp[t] === 'C' ? c : temp[t] === 'F' ? c * 9 / 5 + 32 : c + 273.15;
  }
  return null;
}

export function wantsCard(lower) {
  return /^(?:(?:add|make|open|show|give\s+me|bring\s+up)\s+(?:a\s+|the\s+)?)?(?:convert(?:er)?\s+card|unit\s+convert(?:er|ion)\s+card|conversion\s+card)(?:\s+please)?$/i.test(String(lower || '').trim());
}

const cards = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'convert-card');

export function ensure(stageApi) {
  let card = cards(stageApi)[0];
  if (!card) {
    const st = stageApi.stage;
    card = {
      id: 'convert_' + Math.random().toString(36).slice(2, 9),
      kind: 'convert-card',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 140),
      y: Math.max(40, (st.clientHeight || 600) / 2 - 100),
      value: '1', from: 'm', to: 'ft', result: ''
    };
    stageApi.things()[card.id] = card;
  }
  stageApi.select(card.id);
  return card;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing convert-card';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.cssText += ';background:#1a1a22;border:1px solid #444;border-radius:12px;padding:12px;width:260px;color:#eee;font:14px system-ui';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.3)';

  el.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Unit converter</div>'
    + '<input type="number" class="cc-val" value="' + (th.value || '1') + '" style="width:60px;margin-right:6px">'
    + '<input class="cc-from" value="' + (th.from || 'm') + '" style="width:50px;margin-right:6px" placeholder="from">'
    + '→ <input class="cc-to" value="' + (th.to || 'ft') + '" style="width:50px" placeholder="to">'
    + '<div class="cc-res" style="margin-top:8px;font-size:18px;min-height:24px">' + (th.result || '') + '</div>';

  const val = el.querySelector('.cc-val'), fr = el.querySelector('.cc-from'), to = el.querySelector('.cc-to'), res = el.querySelector('.cc-res');
  const upd = () => {
    const v = parseFloat(val.value), f = fr.value.trim(), t = to.value.trim();
    th.value = val.value; th.from = f; th.to = t;
    const r = convert(v, f, t);
    th.result = r == null ? 'unknown units' : (Math.round(r * 10000) / 10000).toString();
    res.textContent = th.result;
    stageApi.save();
  };
  [val, fr, to].forEach(i => i.addEventListener('input', upd));
  upd();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  if (wantsCard(lower)) {
    ensure(stageApi);
    stageApi.save(); stageApi.render();
    return 'convert-card';
  }
  return '';
}

export default {
  name: 'convert-card',
  examples: ['convert card', 'unit converter card', 'add a conversion card'],
  nearMisses: ['convert 5 miles to km', 'what is 10 kg in pounds', 'calculator'],
  match(lower) { return wantsCard(lower); },
  async run(text, api) {
    const d = ask(String(text || '').toLowerCase(), text, api.stage);
    return d ? 'convert-card' : 'none';
  },
  stageKinds: { 'convert-card': { mount, ensure, ask, askAt: 'convert-card' } },
  suite() {
    const r = convert(1, 'm', 'ft');
    return { ok: r > 3.2 && r < 3.3, got: r };
  }
};
