/**
 * convert skill - a unit converter that stays on the stage (asked by Verse, daily 2026-10-14 ask-20261014-1820-2:
 * "a 'convert-card' skill that outputs a persistent, interactive UI element for unit conversions on the stage").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "unit converter", "open a converter", "temperature converter", "cooking converter", "a converter for 5 miles to km".
 * Copied from the best: Google's unit converter (a kind picker, two linked fields that convert both ways, a swap) and
 * one notch past it: every other unit of the kind listed under the pair, and the card is a stage thing, so its kind,
 * units and number are saved and survive a reload. One-off asks ("5 miles in km") still go to the page's answer card;
 * this card is for when you keep converting. Factors: NIST SP 811 (exact where defined: inch 2.54 cm, pound 0.45359237 kg,
 * US gallon 231 in³). Pure maths is in `toBase`/`fromBase`/`convert` (tested in tools/test_void.mjs, "convert card").
 */
import { KINDS, DEFAULT, pairOf, toBase, fromBase, convert, fmt, askOf } from '../lib/convert-math.js'; // the pure maths and ask-reading live in the lib
export { KINDS, pairOf, toBase, fromBase, convert, fmt, askOf };

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
  // the full page of the same tool, every unit and the history (owner, 2026-10-25: "why are you not linking the cards to the pages?")
  const full = stop(document.createElement('a')); full.className = 'vc-page'; full.href = '/convert/'; full.textContent = 'Open the full Unit converter page →'; full.style.cssText = 'display:inline-block;margin:8px 0 2px;font-size:13px;font-weight:600';
  el.append(head, pick, A.row, swap, B.row, all, src, full);

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
