/**
 * connect4 skill — Connect Four against Verse (skills/connect4-rules.js): "play connect 4", "connect four", "four in a row".
 * Verse looks several moves ahead and every disc it drops says why. The upright frame stands in the void in 3D
 * (mini/connect4.js), lifted by skills/lift3d.js with this card beside it; the flat grid here is the fallback.
 */
import { loadLater } from '../lib/load-later.js';

// the rules engine, the 3D lift, the level and the arena line
// load with the first game, not with the routing order (lib/load-later.js, owner 2026-10-30)
let K, lift3d, levelPick, showArena, rulesLine;
export const ready = loadLater(() => Promise.all([
  import('./connect4-rules.js'), import('./lift3d.js'), import('./game-level.js'), import('../lib/arena-say.js'), import('./game-rules-line.js'),
]).then(([k, l, g, a, r]) => { K = k; ({ lift3d } = l); ({ levelPick } = g); ({ showArena } = a); ({ rulesLine } = r); }));

export function connect4Of(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:how (?:good|strong|well) (?:are you|is (?:verse|void)|do you play)|are you (?:any )?good|what(?:'s| is) your (?:rating|elo|level))\s+(?:at|in)\s+(?:connect\s*(?:4|four)|four\s+in\s+a\s+row)$/.test(t)
    || /^what(?:'s| is) your (?:connect\s*(?:4|four)|four\s+in\s+a\s+row) (?:rating|elo|level)$/.test(t)) return { kind: 'rating' };
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new|make\s+(?:me\s+)?a)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:connect\s*(?:4|four)|four\s+in\s+a\s+row)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|(?:verse|void)|you))?$/.test(t)) return { kind: 'game' };
  return null;
}
const timers = new WeakMap();

function mount(th, stageApi) {
  if (!th.state || !th.state.board) th.state = K.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card connect4-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(400px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Four in a Row</span><span class="g-sub">you are red</span></div>';
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
  // the move log: the latest move and its reason up front, the earlier ones folded under it (a thin dark scrollbar when open)
  const log = document.createElement('div'); log.className = 'c4-log'; log.style.cssText = 'border-top:1px solid rgba(255,255,255,.08);padding-top:6px;margin-top:6px';
  const latest = document.createElement('div'); latest.className = 'c4-latest'; latest.style.cssText = 'font-size:13px;line-height:1.4;color:var(--ink,#ddd)';
  const earlier = document.createElement('details'); earlier.className = 'c4-earlier'; earlier.style.cssText = 'margin-top:4px;font-size:11.5px;color:var(--muted,#8a8a8a)';
  const sum = document.createElement('summary'); sum.style.cssText = 'cursor:pointer;list-style-position:inside';
  sum.addEventListener('pointerdown', (e) => e.stopPropagation());
  const past = document.createElement('div'); past.className = 'c4-past';
  past.style.cssText = 'max-height:96px;overflow-y:auto;padding:2px 6px 6px 0;margin-top:2px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;overscroll-behavior:contain';
  earlier.append(sum, past); log.append(latest, earlier);
  if (!document.getElementById('c4-style')) { const st = document.createElement('style'); st.id = 'c4-style'; st.textContent = '.c4-past::-webkit-scrollbar{width:6px}.c4-past::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:6px}.c4-past::-webkit-scrollbar-track{background:transparent}.c4-past::-webkit-scrollbar-button{display:none}'; document.head.appendChild(st); }
  const save = () => stageApi.save && stageApi.save();
  function voidPlays() {
    clearTimeout(timers.get(th));
    if (th.state.over || th.state.turn !== 2) return;
    timers.set(th, setTimeout(() => { const best = K.voidMove(th.state), m = levelPick(best, [0, 1, 2, 3, 4, 5, 6].filter((c) => K.rowFor(th.state.board, c) >= 0).map((col) => ({ col, why: 'an easy-level move' }))); th.state = K.drop(th.state, m.col, m.why); save(); paint(); }, 600));
  }
  function paint() {
    const s = th.state, line = s.over && s.over !== 'draw' ? K.winLine(s.board, s.over === 'you' ? 1 : 2) || [] : [];
    s.board.forEach((v, i) => { holes[i].style.background = v === 1 ? '#e0303e' : v === 2 ? '#f2c230' : '#0d1a33'; holes[i].style.boxShadow = line.includes(i) ? '0 0 0 3px #fff' : ''; });
    status.textContent = s.over === 'you' ? 'You win! Four in a row' : s.over === 'void' ? 'Verse wins this one' : s.over === 'draw' ? 'A draw' : s.turn === 1 ? 'Your move: pick a column' : 'Verse is thinking…';
    const entry = (l) => { const d = document.createElement('div'); d.textContent = l.who + ' ' + l.text; if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; d.appendChild(w); } return d; };
    const moves = s.log.slice(-10).reverse();
    latest.textContent = ''; past.textContent = '';
    if (moves[0]) latest.appendChild(entry(moves[0]));
    for (const l of moves.slice(1)) past.appendChild(entry(l));
    earlier.style.display = moves.length > 1 ? '' : 'none';
    sum.textContent = 'Earlier moves (' + (moves.length - 1) + ')';
  }
  el.append(wrap, status, again, log, rulesLine('drop a disc in a column; the first to line up four across, down or diagonally wins. You are red.'));
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays();
  lift3d(th, stageApi, el, { kind: 'connect4', board: frame, title: 'Four in a Row', W: 440, H: 380,
    snapshot: () => ({ board: th.state.board.slice(), last: th.state.last, win: th.state.over && th.state.over !== 'draw' ? K.winLine(th.state.board, th.state.over === 'you' ? 1 : 2) : null }) });
}

async function run(text, api) {
  const ask = connect4Of(text);
  if (!ask) return 'none';
  await ready();
  if (ask.kind === 'rating') { // the record the self-play arena wrote (tools/arena.mjs, frontier #5), fetched from this site
    showArena(api, '/arena.json', 'connect4');
    return 'connect4';
  }
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'connect4');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'connect4'; }
  api.summon('connect4', { state: K.create(), x: Math.max(10, Math.round(innerWidth / 2 - 380)), y: 50 });
  api.say('Four in a Row (plays like Connect Four) · you are red · tap a column');
  return 'connect4';
}

export default {
  name: 'connect4',
  connect4Of,
  examples: ['play connect 4', 'connect four', "let's play connect four", 'four in a row', 'a game of connect 4', 'make me a connect 4 game'],
  nearMisses: ['who invented connect four', 'connect 4 rules', 'connect four strategy', 'play chess'],
  match(lower, text) { return !!connect4Of(text); },
  run,
  ready,
  stageKinds: { connect4: { mount: ready.mount(mount) } },
};
