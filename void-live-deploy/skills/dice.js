/**
 * dice skill — a dice roller that stays on the stage (new idea: roll dice that stay on the stage).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "dice roller", "roll dice", "open a dice", "2d6 roller".
 * Persistent stage card: pick number of dice and sides, roll, see the results and total; survives a reload.
 * Empty surface stays empty: a bare "dice" or "roll" is not enough without the context.
 */
export function askOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:close|remove|delete|hide|clear|get\s+rid\s+of)\s+(?:the\s+|my\s+)?(?:dice\s+)?(?:roller|dice\s+card)(?:\s+please)?$/.test(t)) return { close: true };
  const m = t.match(/^(?:please\s+)?(?:(?:open|show|make|add|give|put|bring\s+up|pull\s+up|start|i\s+(?:need|want))\s+(?:me\s+)?(?:up\s+)?)?(?:a\s+|an\s+|the\s+|my\s+)?(?:dice\s+roller|dice\s+card|roller\s+for\s+dice|d\s*&\s*d\s+dice)(?:\s+(?:card|tool))?(?:\s+(?:for|with)\s+(\d+)\s*d\s*(\d+))?(?:\s+(?:here|on\s+(?:the\s+)?(?:stage|screen|page)))?(?:\s+please)?$/);
  if (!m) return /^(?:roll\s+dice|dice\s+roller)$/.test(t) ? { open: true } : null;
  const q = { open: true };
  if (m[1] && m[2]) { q.count = +m[1]; q.sides = +m[2]; }
  return q;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card dice-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(280px, calc(100vw - 20px))';
  const FIELD = 'background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:6px 8px;font:inherit;color-scheme:dark;';
  const stop = (n) => { n.addEventListener('pointerdown', (e) => e.stopPropagation()); n.addEventListener('keydown', (e) => e.stopPropagation()); return n; };
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Dice</span><span class="g-sub">stays here · roll again</span>';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin:8px 0';
  const count = stop(document.createElement('input')); count.type = 'number'; count.min = '1'; count.max = '20'; count.value = th.count || 2; count.className = 'dice-count'; count.setAttribute('aria-label', 'Number of dice'); count.style.cssText = FIELD + 'width:70px';
  const d = document.createElement('span'); d.textContent = 'd'; d.style.cssText = 'align-self:center';
  const sides = stop(document.createElement('select')); sides.className = 'dice-sides'; sides.setAttribute('aria-label', 'Sides'); sides.style.cssText = FIELD + 'flex:1';
  [4, 6, 8, 10, 12, 20, 100].forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = s; sides.appendChild(o); });
  sides.value = String(th.sides || 6);
  row.append(count, d, sides);
  const btn = stop(document.createElement('button')); btn.type = 'button'; btn.className = 'g-btn dice-roll'; btn.textContent = 'Roll';
  const out = document.createElement('div'); out.className = 'dice-out g-sub'; out.setAttribute('aria-live', 'polite'); out.style.cssText = 'margin-top:8px;min-height:1.4em;white-space:pre-line';
  el.append(head, row, btn, out);
  const roll = () => {
    const n = Math.max(1, Math.min(20, +count.value || 1)), s = +sides.value || 6;
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
    const total = rolls.reduce((a, b) => a + b, 0);
    out.textContent = rolls.join(' + ') + (n > 1 ? ' = ' + total : '');
    th.count = n; th.sides = s; stageApi.save();
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); roll(); });
  count.addEventListener('change', () => { th.count = +count.value; stageApi.save(); });
  sides.addEventListener('change', () => { th.sides = +sides.value; stageApi.save(); });
  if (th.last) out.textContent = th.last;
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

const cards = (api) => Object.values(api.stage.things()).filter((t) => t && t.kind === 'dice');

function run(text, api) {
  const q = askOf(text);
  if (!q) return 'none';
  if (q.close) {
    const c = cards(api);
    if (!c.length) { api.say('There is no dice roller on the stage · ask "dice roller" to open one'); return 'dice'; }
    for (const t of c) delete api.stage.things()[t.id];
    api.stage.save(); api.stage.render(); api.say('Dice roller put away'); return 'dice';
  }
  const set = {};
  if (q.count) set.count = q.count;
  if (q.sides) set.sides = q.sides;
  const mine = cards(api)[0];
  if (mine) { Object.assign(mine, set); api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(mine.id); }
  else api.summon('dice', Object.assign({ count: 2, sides: 6, center: true }, set));
  api.say((mine ? 'Your dice roller' : 'A dice roller') + ' is on the stage · it stays after a reload');
  return 'dice';
}

export default {
  name: 'dice',
  examples: [
    'dice roller',
    'roll dice',
    'open a dice roller',
    '2d6 roller',
    'close the dice roller',
  ],
  nearMisses: [
    'dice',
    'roll',
    'what are the odds',
    'random number',
    'coin flip',
  ],
  match(lower, text) { return !!askOf(text || lower); },
  run,
  stageKinds: { dice: { mount } },
};
