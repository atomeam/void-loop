/**
 * busy-blocks skill — "busy blocks: standup 9-9:30, lunch 12-1, review 2:30-4" sketches one day as a bar of when you are
 * taken and a line of when you are free (the gaps, the longest one, clashes marked). "add busy block 5-6pm gym" adds one, the
 * x on a block takes it off, "clear busy blocks" removes the card. No calendar is read or synced: it is a sketch of the words
 * you type, kept with the stage in this browser, nothing sent anywhere. Asked for by the owner (2026-10-18, item 34).
 * Bare hours 1 to 6 mean the afternoon, 7 to 12 as written, so "12-1" is lunch; say am/pm or use 24 hours to mean otherwise.
 */
import { addThing, cardEl, keepOut, firstOf } from '../lib/stage-pack.js';
import { blockIntent, parseBlocks, summary, clashes, MAX_BLOCKS, clockText, lengthText } from '../lib/day-blocks.js';

const COLORS = ['#8fb4ff', '#78dc96', '#ffd166', '#c9a0ff', '#ff9f6b', '#6bdcd0'];
const clean = (th) => { th.blocks = (Array.isArray(th.blocks) ? th.blocks : []).filter((b) => b && Number.isFinite(+b.start) && Number.isFinite(+b.end) && +b.end > +b.start).map((b) => ({ label: String(b.label || 'busy').slice(0, 40), start: +b.start, end: +b.end })).slice(0, MAX_BLOCKS); return th.blocks; };

function mount(th, stageApi) {
  const blocks = clean(th), S = summary(blocks), span = S.win.end - S.win.start;
  const el = cardEl(th, stageApi, 'busy-blocks');
  el.style.width = 'min(92vw,460px)';
  const rerender = (focus) => { stageApi.save(); stageApi.render(); if (focus) setTimeout(() => { const i = stageApi.stage.querySelector('.busy-blocks .bb-add'); if (i) i.focus(); }, 0); };
  const head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px';
  const t = document.createElement('b'); t.textContent = 'Busy blocks';
  const sum = document.createElement('span'); sum.className = 'bb-sum'; sum.style.cssText = 'font-size:12px;opacity:.75';
  sum.textContent = blocks.length ? lengthText(S.busy) + ' busy · ' + lengthText(S.free) + ' free' + (S.clashes ? ' · ' + S.clashes + ' clash' + (S.clashes === 1 ? '' : 'es') : '') : 'nothing yet';
  head.append(t, sum); el.appendChild(head);
  const bar = document.createElement('div'); bar.className = 'bb-bar'; bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', 'a day from ' + clockText(S.win.start) + ' to ' + clockText(S.win.end) + ' with ' + blocks.length + ' busy blocks');
  bar.style.cssText = 'position:relative;height:34px;border-radius:8px;background:rgba(120,220,150,.14);border:1px solid rgba(255,255,255,.16);overflow:hidden';
  const clashing = new Set(clashes(blocks).flat());
  blocks.forEach((b, i) => {
    const d = document.createElement('div'); d.className = 'bb-block'; d.dataset.i = String(i); if (clashing.has(i)) d.dataset.clash = '1';
    d.title = b.label + ' · ' + clockText(b.start) + ' to ' + clockText(b.end);
    d.style.cssText = 'position:absolute;top:2px;bottom:2px;border-radius:5px;opacity:.9;left:' + ((b.start - S.win.start) / span * 100).toFixed(2) + '%;width:' + ((b.end - b.start) / span * 100).toFixed(2) + '%;background:' + COLORS[i % COLORS.length] + (clashing.has(i) ? ';outline:2px solid #ff6b6b' : '');
    bar.appendChild(d);
  });
  el.appendChild(bar);
  const ticks = document.createElement('div'); ticks.style.cssText = 'position:relative;height:14px;font-size:10px;opacity:.65;margin-bottom:6px';
  for (let m = Math.ceil(S.win.start / 120) * 120; m <= S.win.end; m += 120) { const s = document.createElement('span'); s.textContent = clockText(m).replace(':00', ''); s.style.cssText = 'position:absolute;transform:translateX(-50%);left:' + ((m - S.win.start) / span * 100).toFixed(2) + '%'; ticks.appendChild(s); }
  el.appendChild(ticks);
  const list = document.createElement('div');
  blocks.forEach((b, i) => {
    const r = document.createElement('div'); r.className = 'bb-row'; r.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0';
    const dot = document.createElement('span'); dot.style.cssText = 'width:9px;height:9px;border-radius:50%;flex:none;background:' + COLORS[i % COLORS.length];
    const lab = document.createElement('span'); lab.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere'; lab.textContent = b.label + ' · ' + clockText(b.start) + ' to ' + clockText(b.end) + ' (' + lengthText(b.end - b.start) + ')';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'remove ' + b.label); x.style.cssText = 'all:unset;cursor:pointer;opacity:.6;padding:0 4px;font-size:16px';
    x.addEventListener('click', (e) => { e.stopPropagation(); th.blocks.splice(i, 1); rerender(); });
    r.append(dot, lab, keepOut(x)); list.appendChild(r);
  });
  el.appendChild(list);
  const free = document.createElement('div'); free.className = 'bb-free'; free.style.cssText = 'margin-top:6px;font-size:13px;color:#9fe3b4';
  free.textContent = blocks.length ? (S.gaps.length ? 'Free: ' + S.gaps.map((g) => clockText(g.start) + ' to ' + clockText(g.end) + ' (' + lengthText(g.end - g.start) + ')').join(' · ') + (S.longest ? ' · longest ' + lengthText(S.longest.end - S.longest.start) : '') : 'No free time in this window.') : 'Type blocks below, like "standup 9-9:30".';
  el.appendChild(free);
  const form = document.createElement('form'); form.style.cssText = 'display:flex;gap:6px;margin-top:8px';
  const inp = document.createElement('input'); inp.className = 'bb-add'; inp.type = 'text'; inp.maxLength = 120; inp.placeholder = 'gym 5-6pm'; inp.setAttribute('aria-label', 'add a busy block');
  inp.style.cssText = 'flex:1;min-width:0;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.25);color:#e8e8e8;font:13px system-ui';
  const go = document.createElement('button'); go.type = 'submit'; go.textContent = 'Add'; go.style.cssText = 'padding:5px 12px;border-radius:8px;border:1px solid rgba(143,180,255,.5);background:rgba(143,180,255,.2);color:#e8e8e8;cursor:pointer';
  form.append(keepOut(inp), keepOut(go));
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); const add = parseBlocks(inp.value); if (!add.length) { inp.setAttribute('aria-invalid', 'true'); return; } th.blocks.push(...add); th.blocks.length = Math.min(th.blocks.length, MAX_BLOCKS); rerender(true); });
  el.appendChild(form);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: what happened, or '' */
export function ask(lower, text, stageApi) {
  const it = blockIntent(text);
  if (!it) return '';
  if (it.act === 'clear') {
    const th = firstOf(stageApi, 'busyblocks');
    if (!th) return 'no busy blocks';
    delete stageApi.things()[th.id]; if (stageApi.selected() === th.id) stageApi.select(null);
    stageApi.save(); stageApi.render(); return 'busy-blocks-removed';
  }
  const th = firstOf(stageApi, 'busyblocks') || addThing(stageApi, 'busyblocks', { blocks: [] });
  clean(th); th.blocks.push(...it.blocks); th.blocks.length = Math.min(th.blocks.length, MAX_BLOCKS);
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'busy-blocks';
}

export default {
  name: 'busy-blocks',
  examples: ['busy blocks: standup 9-9:30, lunch 12-1, review 2:30-4', 'busy blocks', 'add busy block 5-6pm gym', 'sketch my day'],
  nearMisses: ['what are busy hours at the gym', 'busy day tomorrow ideas', 'block my calendar for friday', 'add milk to my list', 'how long is a meeting from 9 to 10'],
  blockIntent,
  match(lower, text) { return !!blockIntent(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'busy-blocks' : 'none'; },
  stageKinds: { busyblocks: { mount, ensure: (stageApi) => firstOf(stageApi, 'busyblocks') || addThing(stageApi, 'busyblocks', { blocks: [] }), ask } },
};
