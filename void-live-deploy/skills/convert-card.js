/**
 * convert-card skill — persistent interactive unit conversions on the stage.
 * "convert card", "unit converter", "open a converter". A card stays on the stage with inputs for value and units;
 * the result updates live and persists. Empty surface stays empty.
 * Uses the same length/mass/temp conversions as calc.
 */
const UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  mass: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 },
  temp: { C: 'C', F: 'F', K: 'K' },
};

export function convert(value, from, to) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = from.toLowerCase(), t = to.toLowerCase();
  if (UNITS.length[f] !== undefined && UNITS.length[t] !== undefined) return (n * UNITS.length[f]) / UNITS.length[t];
  if (UNITS.mass[f] !== undefined && UNITS.mass[t] !== undefined) return (n * UNITS.mass[f]) / UNITS.mass[t];
  if (UNITS.temp[f] !== undefined && UNITS.temp[t] !== undefined) {
    let c;
    if (UNITS.temp[f] === 'C') c = n;
    else if (UNITS.temp[f] === 'F') c = (n - 32) * 5 / 9;
    else if (UNITS.temp[f] === 'K') c = n - 273.15;
    else return null;
    if (UNITS.temp[t] === 'C') return c;
    if (UNITS.temp[t] === 'F') return c * 9 / 5 + 32;
    if (UNITS.temp[t] === 'K') return c + 273.15;
  }
  return null;
}

export function wantsConvertCard(lower) {
  return /^(?:(?:open|show|make|add|give\s+me|bring\s+up)\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:convert(?:er)?\s+card|unit\s+converter|persistent\s+converter|converter\s+card)(?:\s+please)?\s*[.!?]?$/.test(lower);
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing convert-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;padding:12px;background:#1a1a1e;border:1px solid #444;border-radius:12px;min-width:220px;color:#eee;font:14px system-ui';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';

  const title = document.createElement('div');
  title.textContent = 'Unit converter';
  title.style.cssText = 'font-weight:600;margin-bottom:8px';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';

  const input = document.createElement('input');
  input.type = 'number';
  input.value = th.value || '1';
  input.style.cssText = 'width:70px;padding:4px;background:#111;border:1px solid #555;color:#fff;border-radius:6px';
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('input', () => { th.value = input.value; update(); stageApi.save(); });

  const fromSel = document.createElement('select');
  fromSel.style.cssText = 'padding:4px;background:#111;border:1px solid #555;color:#fff;border-radius:6px';
  const toSel = fromSel.cloneNode();
  const opts = ['m','km','cm','mm','mi','yd','ft','in','kg','g','lb','oz','C','F','K'];
  for (const u of opts) {
    const o = document.createElement('option'); o.value = u; o.textContent = u;
    fromSel.appendChild(o.cloneNode(true)); toSel.appendChild(o);
  }
  fromSel.value = th.from || 'm';
  toSel.value = th.to || 'ft';
  fromSel.addEventListener('change', () => { th.from = fromSel.value; update(); stageApi.save(); });
  toSel.addEventListener('change', () => { th.to = toSel.value; update(); stageApi.save(); });
  fromSel.addEventListener('pointerdown', (e) => e.stopPropagation());
  toSel.addEventListener('pointerdown', (e) => e.stopPropagation());

  const result = document.createElement('div');
  result.style.cssText = 'margin-top:8px;font-variant-numeric:tabular-nums';

  function update() {
    const v = convert(th.value || input.value, th.from || fromSel.value, th.to || toSel.value);
    result.textContent = v === null ? '—' : Number(v.toPrecision(8));
    th.result = result.textContent;
  }
  update();

  row.append(input, fromSel, document.createTextNode(' to '), toSel);
  el.append(title, row, result);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function ensure(stageApi) {
  const things = stageApi.things();
  const sel = things[stageApi.selected()];
  let c = (sel && sel.kind === 'convert-card' && sel) || Object.values(things).find((t) => t && t.kind === 'convert-card') || null;
  if (!c) {
    const st = stageApi.stage;
    c = { id: 'convert_' + Math.random().toString(36).slice(2, 9), kind: 'convert-card',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 120), y: Math.max(40, (st.clientHeight || 600) / 2 - 60),
      value: '1', from: 'm', to: 'ft' };
    things[c.id] = c;
  }
  stageApi.select(c.id);
  return c;
}

function ask(lower, text, stageApi) {
  if (wantsConvertCard(lower)) { ensure(stageApi); stageApi.save(); stageApi.render(); return 'convert-card'; }
  return '';
}

export default {
  name: 'convert-card',
  examples: ['convert card', 'unit converter', 'open a converter', 'persistent converter'],
  nearMisses: ['convert 5 miles to km', 'what is 10 kg in pounds', 'calculator'],
  match(lower) { return wantsConvertCard(lower); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d ? 'convert-card' : 'none'; },
  stageKinds: { 'convert-card': { mount, ensure, ask, askAt: 'convert-card' } },
  suite() {
    if (!wantsConvertCard('convert card')) return { ok: false, got: 'match' };
    if (wantsConvertCard('convert 5 miles to km')) return { ok: false, got: 'near' };
    const r = convert(5, 'mi', 'km');
    if (Math.abs(r - 8.04672) > 0.001) return { ok: false, got: r };
    return { ok: true };
  },
};
