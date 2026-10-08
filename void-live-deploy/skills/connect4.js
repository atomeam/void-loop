/**
 * connect4 skill — Connect Four against Void (skills/connect4-rules.js): "play connect 4", "connect four", "four in a row".
 * Void looks several moves ahead and every disc it drops says why. The upright frame stands in the void in 3D
 * (mini/connect4.js), lifted by skills/lift3d.js with this card beside it; the flat grid here is the fallback.
 */
import * as K from './connect4-rules.js';
import { lift3d } from './lift3d.js';

export function connect4Of(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new|make\s+(?:me\s+)?a)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:connect\s*(?:4|four)|four\s+in\s+a\s+row)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  return null;
}
const timers = new WeakMap();

function mount(th, stageApi) {
  if (!th.state || !th.state.board) th.state = K.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card connect4-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(400px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Connect Four</span><span class="g-sub">you are red</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const frame = document.createElement('div'); frame.className = 'c4-frame';
  frame.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:#1f4fbf;border-radius:10px;padding:6px';
  const cols = [], holes = [];
  for (let c = 0; c < K.C; c++) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = c; b.className = 'c4-col'; b.setAttribute('aria-label', 'drop in column ' + (c + 1));
    b.style.cssText = 'grid-column:' + (c + 1) + ';grid-row:1/7;display:grid;grid-template-rows:repeat(6,1fr);gap:4px;border:0;padding:0;background:none;cursor:pointer';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); if (th.state.turn !== 1 || th.state.over) return; const n = K.drop(th.state, c); if (n !== th.state) { th.state = n; save(); paint(); voidPlays(); } });
    for (let r = 0; r < K.R; r++) { const h = document.createElement('i'); h.style.cssText = 'display:block;aspect-ratio:1;border-radius:50%;background:#0d1a33'; b.appendChild(h); holes[r * K.C + c] = h; }
    frame.appendChild(b); cols.push(b);
  }
  wrap.appendChild(frame);
  const status = document.createElement('div'); status.className = 'g-status c4-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn c4-new'; again.textContent = 'New game';
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(timers.get(th)); th.state = K.create(); save(); paint(); });
  const log = document.createElement('div'); log.className = 'c4-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:110px;overflow:auto;border-top:1px solid rgba(255,255,255,.08);padding-top:4px;margin-top:6px';
  const save = () => stageApi.save && stageApi.save();
  function voidPlays() {
    clearTimeout(timers.get(th));
    if (th.state.over || th.state.turn !== 2) return;
    timers.set(th, setTimeout(() => { const m = K.voidMove(th.state); th.state = K.drop(th.state, m.col, m.why); save(); paint(); }, 600));
  }
  function paint() {
    const s = th.state, line = s.over && s.over !== 'draw' ? K.winLine(s.board, s.over === 'you' ? 1 : 2) || [] : [];
    s.board.forEach((v, i) => { holes[i].style.background = v === 1 ? '#e0303e' : v === 2 ? '#f2c230' : '#0d1a33'; holes[i].style.boxShadow = line.includes(i) ? '0 0 0 3px #fff' : ''; });
    status.textContent = s.over === 'you' ? 'You win! Four in a row' : s.over === 'void' ? 'Void wins this one' : s.over === 'draw' ? 'A draw' : s.turn === 1 ? 'Your move: pick a column' : 'Void is thinking…';
    log.textContent = '';
    for (const l of s.log.slice(-10).reverse()) { const d = document.createElement('div'); d.textContent = l.who + ' ' + l.text; if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; d.appendChild(w); } log.appendChild(d); }
  }
  el.append(wrap, status, again, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays();
  lift3d(th, stageApi, el, { kind: 'connect4', board: frame, title: 'Connect Four', W: 440, H: 380,
    snapshot: () => ({ board: th.state.board.slice(), last: th.state.last, win: th.state.over && th.state.over !== 'draw' ? K.winLine(th.state.board, th.state.over === 'you' ? 1 : 2) : null }) });
}

async function run(text, api) {
  if (!connect4Of(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'connect4');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'connect4'; }
  api.summon('connect4', { state: K.create(), x: Math.max(10, Math.round(innerWidth / 2 - 380)), y: 50 });
  api.say('Connect Four · you are red · tap a column');
  return 'connect4';
}

export default {
  name: 'connect4',
  connect4Of,
  examples: ['play connect 4', 'connect four', "let's play connect four", 'four in a row', 'a game of connect 4', 'make me a connect 4 game'],
  nearMisses: ['who invented connect four', 'connect 4 rules', 'connect four strategy', 'play chess'],
  match(lower, text) { return !!connect4Of(text); },
  run,
  stageKinds: { connect4: { mount } },
};
