/**
 * counter skill — the tally counter on the stage: "make a counter", "count up (by 3)", "decrement the counter",
 * "set the counter to 10", "reset the counter", "remove the counter"; while it is picked, a bare "up", "down" or "reset".
 * There is only ever one. It moved out of void.html in cleanup step 6 (one shape for skills). Its stage kind carries:
 *   mount   draws it;  ensure  the one counter (the page's "make the counter big" finds it through this);
 *   alter   the size words;  ask  its asks, answered at the same point in the page's built-in order as before the move
 *           (so a bare "reset" still goes to a timer first); match/run answer them before the skills have loaded.
 */

/** what an ask wants of the counter: 'create' | 'up' | 'down' | 'set' | 'reset' | 'remove' | null. Pure.
 *  ctx: { picked: the picked thing is a counter, has: a counter is on the stage, timer: a timer is on the stage } */
export function counterIntent(lower, ctx = {}) {
  const l = String(lower || '').trim();
  const word = /\bcounter\b/.test(l);
  // only a plain "make/add/show a counter": "make the counter big" or "make the counter blue" is the page's shared targeting
  if (/^(?:please\s+)?(?:(?:make|add|create|show|spawn|put|place|drop|give)\s+(?:me\s+)?(?:a|an|another|new|the|my)?\s*)?(?:(?:a|an)\s+)?(?:new\s+)?(?:tally\s+)?counter(?:\s+(?:please|here|on\s+(?:the\s+)?(?:stage|screen|page)))?\s*[.!]?$/.test(l)) return 'create';
  if (word) {
    if (/\b(count\s+up|increment|increase|go\s+up|plus\s+one|add\s+one)\b/.test(l)) return 'up';
    if (/\b(count\s+down|decrement|decrease|go\s+down|minus\s+one)\b/.test(l)) return 'down';
    if (/\b(set|put|change)\b.*\bcounter\b.*\bto\s+(-?\d+)\b/.test(l)) return 'set';
    if (/\b(reset|zero|back\s+to\s+zero)\b/.test(l)) return 'reset';
  }
  if (/^count\s+up(\s+by\s+(-?\d+))?\s*[.!]?\s*$/.test(l)) return 'up';
  if (/^count\s+down(\s+by\s+(-?\d+))?\s*[.!]?\s*$/.test(l)) return 'down';
  if (ctx.picked && /^(up|plus)\s*[.!]?\s*$/.test(l)) return 'up';
  if (ctx.picked && /^(down|minus)\s*[.!]?\s*$/.test(l)) return 'down';
  if (ctx.picked && /^(reset|zero|clear\s+it)\s*[.!]?\s*$/.test(l)) return 'reset';
  if (!ctx.timer && ctx.has && /^(reset|zero|clear\s+it)\s*[.!]?\s*$/.test(l)) return 'reset';
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear|cancel)\b.*\bcounter\b/.test(l)) return 'remove';
  if (/\bcounter\b.*\b(away|gone)\b/.test(l)) return 'remove';
  if (ctx.picked && /^(remove|delete|get\s+rid\s+of|hide|clear|cancel)\s+(it|this)\s*[.!]?\s*$/.test(l)) return 'remove';
  return null;
}

/** how far "count up by 3" goes (1 by default). Pure. */
export const deltaOf = (text) => { const m = /(?:by|plus|minus)\s+(-?\d+)/i.exec(text || ''); return m ? parseInt(m[1], 10) : 1; };
/** the number in "set the counter to 10" (null when none). Pure. */
export const setTo = (text) => { const m = /(?:to|at|equals?|is)\s+(-?\d+)/i.exec(text || ''); return m ? parseInt(m[1], 10) : null; };

/** "make the counter big": the size words on its number. Changes th; true when something changed. */
export function alter(th, lower) {
  let ok = false;
  if (/\b(bigger|larger|increase|grow|enlarge)\b/.test(lower)) { th.size = Math.min(200, (th.size || 26) + 16); ok = true; }
  if (/\b(smaller|tinier|decrease|shrink)\b/.test(lower)) { th.size = Math.max(10, (th.size || 26) - 16); ok = true; }
  if (/\b(huge|giant|enormous|massive)\b/.test(lower)) { th.size = 56; ok = true; }
  if (/\b(tiny|mini|petite)\b/.test(lower)) { th.size = 14; ok = true; }
  if (/\b(big|large)\b/.test(lower) && !/\bbigger\b|\blarger\b/.test(lower)) { th.size = Math.max(th.size || 26, 40); ok = true; }
  if (/\b(small|little)\b/.test(lower) && !/\bsmaller\b/.test(lower)) { th.size = Math.min(th.size || 26, 18); ok = true; }
  return ok;
}

const counterOf = (stageApi) => Object.values(stageApi.things()).find((t) => t && t.kind === 'counter') || null;

/** the one counter, put up in the middle of the stage when there is none; it becomes the picked thing */
export function ensure(stageApi) {
  const things = stageApi.things();
  let c = counterOf(stageApi);
  if (!c) {
    const st = stageApi.stage;
    c = { id: 'counter-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'counter',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 60), y: Math.max(40, (st.clientHeight || 600) / 2 - 40), value: 0 };
    things[c.id] = c;
    stageApi.select(c.id);
  }
  return c;
}

function mount(th, stageApi) {
  const { save, render } = stageApi;
  const el = document.createElement('div');
  el.className = 'thing counter';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const chip = (text, label, d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'counter-chip'; b.textContent = text; b.setAttribute('aria-label', label);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => { th.value = (th.value || 0) + d; save(); render(); });
    return b;
  };
  const value = document.createElement('span');
  value.className = 'counter-value';
  value.textContent = String(th.value || 0);
  if (th.color) value.style.color = th.color;
  if (th.size) value.style.fontSize = th.size + 'px';
  const label = document.createElement('span');
  label.className = 'counter-label';
  label.textContent = 'counter';
  el.append(chip('−', 'decrement counter', -1), value, chip('+', 'increment counter', 1), label);
  // the 3D tally counter beside it (skills/mini/counter.js): its wheels roll to the value, and pressing its plunger counts one up
  if (stageApi.miniature) stageApi.miniature(el, 'counter', { value: th.value || 0, onPress: () => { th.value = (th.value || 0) + 1; save(); render(); } }, { key: th.id, place: 'beside', width: 120, height: 140, label: '3D tally counter' }).catch(() => {});
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the ask on the stage as it is now: what it did ('counter', 'counter-up', ...), or '' when it is not the counter's */
export function ask(lower, text, stageApi) {
  const things = stageApi.things(), all = Object.values(things), picked = things[stageApi.selected()];
  const act = counterIntent(lower, { picked: !!picked && picked.kind === 'counter', has: all.some((t) => t && t.kind === 'counter'), timer: all.some((t) => t && t.kind === 'timer') });
  if (!act) return '';
  if (act === 'remove') {
    const c = picked && picked.kind === 'counter' ? picked : counterOf(stageApi);
    if (!c) return '';
    delete things[c.id];
    if (stageApi.selected() === c.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'counter-removed';
  }
  const c = ensure(stageApi);
  if (act === 'up') c.value = (c.value || 0) + deltaOf(text);
  else if (act === 'down') c.value = (c.value || 0) - deltaOf(text);
  else if (act === 'set') { const n = setTo(text); c.value = n === null ? 0 : n; }
  else if (act === 'reset') c.value = 0;
  stageApi.select(c.id);
  stageApi.save(); stageApi.render();
  return act === 'create' ? 'counter' : 'counter-' + act;
}

export default {
  name: 'counter',
  counterIntent,
  examples: ['make a counter', 'count up', 'set the counter to 10', 'reset the counter'],
  nearMisses: ['count the words in this', 'countdown 5 minutes', 'how many days until christmas'],
  // match sees no stage: only asks that name the counter, or "count up/down"; the bare "up", "down" and "reset" need the
  // picked counter and are answered by the stage kind's ask hook at the page's built-in step
  match(lower) { return !!counterIntent(lower, {}); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'counter' : 'none'; },
  stageKinds: { counter: { mount, ensure, alter, ask } },
};
