/**
 * sorry skill — Sorry!, the card-driven race home, against 1-3 computer players (asked by Adam, 2026-10-09).
 * The rules live in skills/sorry-rules.js (tested in tools/sorry.test.mjs); this is the card: the board, the draw pile,
 * your moves and the bots. The board stands in the void in 3D through skills/mini/aggravation.js (the same wooden
 * board, with pawns), the rest of the card beside it; the 2D board stays the fallback.
 * "sorry", "play sorry", "sorry!", "a game of sorry".
 */
import { lift3d } from './lift3d.js';
import { COLORS, HEX, TRACK, SIDE, PAWNS, SAFE, SLIDES, startExit, safeEntry, createState, draw, movesFor, play, pass, botMove } from './sorry-rules.js';

export function sorryOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can\s+we|i\s+want\s+to)\s+)?(?:play|start|open)\s+(?:a\s+)?(?:game\s+of\s+)?sorry!?(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|you|the\s+computer|bots?))?!?$|^sorry!?\s+(?:board\s+)?game$|^(?:a\s+)?game\s+of\s+sorry!?$/.test(t);
}

// ---- board geometry: a 16 x 16 grid, the track on its edge (SVG units, centre 0,0; 22.5 a square) ----
const N = 16, CELL = 22.5, O = -180;
const cellXY = (cx, cy) => [O + (cx + 0.5) * CELL, O + (cy + 0.5) * CELL];
const IN = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // inward from each side
function trackCell(i) {
  const side = Math.floor(i / SIDE), k = i % SIDE;
  return side === 0 ? [N - 1 - k, N - 1] : side === 1 ? [0, N - 1 - k] : side === 2 ? [k, 0] : [N - 1, k];
}
export function squareXY(p, c) {
  if (typeof p === 'number') return cellXY(...trackCell(p));
  const [ex, ey] = trackCell(safeEntry(c)), [dx, dy] = IN[c];
  if (p === 'H') return cellXY(ex + dx * 6.6, ey + dy * 6.6);
  const k = Number(String(p).slice(1)) + 1; return cellXY(ex + dx * k, ey + dy * k);
}
function startCentre(c) { const [sx, sy] = trackCell(startExit(c)), [dx, dy] = IN[c]; return cellXY(sx + dx * 2.3, sy + dy * 2.3); }
export function pawnXY(c, m, p) {
  if (p === 'S') { const [x, y] = startCentre(c), o = 8; return [x + (m % 2 ? o : -o), y + (m < 2 ? -o : o)]; }
  if (p === 'H') { const [x, y] = squareXY('H', c), o = 7; return [x + (m % 2 ? o : -o), y + (m < 2 ? -o : o)]; }
  return squareXY(p, c);
}
const r1 = (v) => Math.round(v * 10) / 10;
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const key = (p) => JSON.stringify(p);

function boardSvg() {
  const s = svgEl('svg', { viewBox: '-200 -200 400 400', class: 'so-board', role: 'img', 'aria-label': 'Sorry! board' });
  const defs = svgEl('defs', {}, s);
  defs.innerHTML = '<linearGradient id="soBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ede0"/><stop offset="1" stop-color="#e3d6bf"/></linearGradient>'
    + '<filter id="soShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.2" flood-color="#000" flood-opacity=".5"/></filter>'
    + COLORS.map((c) => '<radialGradient id="soP_' + c + '" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".25" stop-color="' + HEX[c] + '"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>').join('');
  svgEl('rect', { x: -198, y: -198, width: 396, height: 396, rx: 14, fill: '#2d2a26' }, s);
  svgEl('rect', { x: -192, y: -192, width: 384, height: 384, rx: 10, fill: 'url(#soBg)' }, s);
  // the track squares, a slim gap between them
  for (let i = 0; i < TRACK; i++) { const [x, y] = cellXY(...trackCell(i)); svgEl('rect', { x: r1(x - CELL / 2 + 0.8), y: r1(y - CELL / 2 + 0.8), width: CELL - 1.6, height: CELL - 1.6, rx: 2.5, fill: '#fbf7ef', stroke: 'rgba(0,0,0,.28)', 'stroke-width': 0.8, 'data-sq': i }, s); }
  // slides: a band in the side's colour from a triangle to a disc
  for (const sl of SLIDES) {
    const col = HEX[COLORS[sl.side]], [x1, y1] = cellXY(...trackCell(sl.from)), [x2, y2] = cellXY(...trackCell(sl.to));
    svgEl('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: col, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: '.85' }, s);
    svgEl('circle', { cx: r1(x2), cy: r1(y2), r: 6.5, fill: col }, s);
    const ang = Math.atan2(y2 - y1, x2 - x1), tri = [[9, 0], [-5, 6.5], [-5, -6.5]].map(([a, b]) => [x1 + a * Math.cos(ang) - b * Math.sin(ang), y1 + a * Math.sin(ang) + b * Math.cos(ang)]);
    svgEl('path', { d: 'M' + tri.map((p) => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z', fill: col }, s);
  }
  COLORS.forEach((col, c) => {
    // the Safety Zone: five squares in from the safety entry, then Home
    for (let k = 0; k < SAFE; k++) { const [x, y] = squareXY('z' + k, c); svgEl('rect', { x: r1(x - CELL / 2 + 0.8), y: r1(y - CELL / 2 + 0.8), width: CELL - 1.6, height: CELL - 1.6, rx: 2.5, fill: HEX[col], opacity: '.55', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 0.8 }, s); }
    const [hx, hy] = squareXY('H', c); svgEl('circle', { cx: r1(hx), cy: r1(hy), r: 21, fill: '#fff', stroke: HEX[col], 'stroke-width': 3 }, s);
    svgEl('text', { x: r1(hx), y: r1(hy + 3.5), 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: HEX[col], 'font-family': 'system-ui, sans-serif' }, s).textContent = 'HOME';
    const [sx, sy] = startCentre(c); svgEl('circle', { cx: r1(sx), cy: r1(sy), r: 19, fill: '#fff', stroke: HEX[col], 'stroke-width': 3 }, s);
    svgEl('text', { x: r1(sx), y: r1(sy - 21.5), 'text-anchor': 'middle', 'font-size': 7, 'font-weight': 700, fill: HEX[col], 'font-family': 'system-ui, sans-serif' }, s).textContent = 'START';
  });
  // the middle: the name, in the style of the box
  svgEl('text', { x: 0, y: 10, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 800, fill: '#c8202c', 'font-family': 'Georgia, serif', 'font-style': 'italic', transform: 'rotate(-28)' }, s).textContent = 'Sorry!';
  svgEl('g', { class: 'so-targets' }, s);
  svgEl('g', { class: 'so-pawns' }, s);
  return s;
}

const CARD_TEXT = { 1: 'Leave Start, or move 1', 2: 'Leave Start, or move 2 · draw again', 3: 'Move 3', 4: 'Move back 4', 5: 'Move 5', 7: 'Move 7, or split it between two pawns', 8: 'Move 8', 10: 'Move 10, or back 1', 11: 'Move 11, or swap with a rival', 12: 'Move 12', sorry: 'Sorry! From Start, take a rival’s square' };
const timers = new WeakMap(), painters = new WeakMap();
// the draw pile looks like the box's own deck: a red back with the logo face down, a cream face that flips over when you
// draw, and Draw glowing while it is the move to make (Adam: "capture the nostalgia of the physical board")
const SO_CSS = '.so-card{position:relative;transform-style:preserve-3d;transition:box-shadow .2s}'
  + '.so-card.back{background:repeating-linear-gradient(135deg,#b8141f 0 6px,#c8202c 6px 12px)!important;color:#fff8e7!important;border-color:#fff8e7!important;font:italic 800 13px Georgia,serif!important;box-shadow:0 2px 0 #8e0f18,0 4px 0 #6f0b12,0 6px 10px rgba(0,0,0,.45)!important}'
  + '.so-card.flip{animation:so-flip .42s cubic-bezier(.2,.7,.2,1)}'
  + '@keyframes so-flip{0%{transform:rotateY(90deg) translateY(-6px) scale(1.06)}60%{transform:rotateY(-8deg) scale(1.04)}100%{transform:none}}'
  + '.so-draw.ready{box-shadow:0 0 0 0 rgba(255,214,120,.7);animation:so-ready 1.6s ease-out infinite;background:#ffe2a1!important;color:#2a1c06!important}'
  + '@keyframes so-ready{0%{box-shadow:0 0 0 0 rgba(255,214,120,.65)}80%,100%{box-shadow:0 0 0 12px rgba(255,214,120,0)}}'
  + '@media (prefers-reduced-motion: reduce){.so-card.flip,.so-draw.ready{animation:none}}';
function soStyle() { if (typeof document === 'undefined' || document.getElementById('sorry-style')) return; const st = document.createElement('style'); st.id = 'sorry-style'; st.textContent = SO_CSS; document.head.appendChild(st); }
function later(th, fn, ms) { clearTimeout(timers.get(th)); timers.set(th, setTimeout(() => { timers.delete(th); fn(); }, ms)); }
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = createState();
  soStyle();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card sorry-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(452px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Sorry!</span><span class="g-sub"></span></div>';
  const sub = el.querySelector('.g-sub');
  const board = boardSvg();
  const wrap = document.createElement('div'); wrap.className = 'g-board so-wrap'; wrap.appendChild(board);
  const bar = document.createElement('div'); bar.className = 'g-bar';
  const card = document.createElement('div'); card.className = 'so-card'; card.setAttribute('aria-hidden', 'true');
  card.style.cssText = 'min-width:44px;height:58px;border-radius:7px;background:#fff;color:#c8202c;display:flex;align-items:center;justify-content:center;font:800 20px Georgia,serif;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #c8202c';
  const status = document.createElement('div'); status.className = 'g-status'; status.setAttribute('aria-live', 'polite');
  const drawBtn = document.createElement('button'); drawBtn.type = 'button'; drawBtn.className = 'g-btn g-primary so-draw'; drawBtn.textContent = 'Draw';
  bar.append(card, status, drawBtn);
  const foot = document.createElement('div'); foot.className = 'g-foot';
  const opp = document.createElement('div'); opp.className = 'g-seg'; opp.setAttribute('role', 'group'); opp.setAttribute('aria-label', 'computer players');
  opp.innerHTML = '<span>vs</span>' + [1, 2, 3].map((n) => '<button type="button" data-opp="' + n + '">' + n + ' bot' + (n > 1 ? 's' : '') + '</button>').join('');
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  foot.append(opp, again);
  const rules = document.createElement('div'); rules.className = 'g-rules';
  rules.textContent = 'Draw a card and move. Only a 1 or 2 leaves Start; a 2 draws again. 4 goes back, 10 goes 10 or back 1, 7 can be split between two pawns, 11 can swap with a rival, and Sorry! sends a rival home from your Start. Land on someone and they go back to Start. Stop on another colour’s triangle and you slide, sweeping everyone off it. Exact count Home.';
  el.append(wrap, bar, foot, rules);
  for (const b of el.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-pick], [data-to]')) e.stopPropagation(); });

  let picked = null;
  const humanTurn = () => th.state.winner == null && th.state.turn === th.state.human;
  const myMoves = () => (humanTurn() && th.state.card != null ? movesFor(th.state) : []);
  function commit(next) { th.state = next; picked = null; stageApi.save && stageApi.save(); const fn = painters.get(th); if (fn) fn(); schedule(); }
  function paint() {
    const s = th.state, moves = myMoves();
    const g = board.querySelector('.so-pawns'), tg = board.querySelector('.so-targets');
    const have = new Map([...g.children].map((n) => [n.dataset.k, n]));
    s.seats.forEach((c) => s.pawns[c].forEach((p, m) => {
      const k = c + ':' + m; let n = have.get(k);
      if (!n) {
        n = svgEl('g', { 'data-k': k, class: 'so-pawn' }, g);
        svgEl('circle', { r: 7.4, fill: 'url(#soP_' + COLORS[c] + ')', filter: 'url(#soShadow)' }, n);
        svgEl('circle', { r: 3.2, cy: -2.2, fill: 'rgba(255,255,255,.35)' }, n);
        svgEl('circle', { r: 10.5, class: 'ag-ring', fill: 'none' }, n);
      }
      have.delete(k);
      const [x, y] = pawnXY(c, m, p);
      n.style.transform = 'translate(' + r1(x) + 'px,' + r1(y) + 'px)';
      n.style.transition = reduced() ? 'none' : 'transform .35s ease';
      const can = c === s.human && moves.some((mv) => mv.pawn === m);
      n.classList.toggle('can', can); n.classList.toggle('picked', can && picked === m);
      if (can) { n.setAttribute('data-pick', m); n.setAttribute('role', 'button'); n.setAttribute('aria-label', 'your pawn ' + (m + 1)); } else { n.removeAttribute('data-pick'); n.removeAttribute('role'); }
      n.classList.toggle('last', !!(s.last && s.last.color === c && s.last.pawn === m));
    }));
    for (const n of have.values()) n.remove();
    tg.innerHTML = '';
    const show = picked != null ? moves.filter((mv) => mv.pawn === picked) : [];
    show.forEach((mv, i) => { const [x, y] = mv.to === 'H' ? pawnXY(s.human, mv.pawn, 'H') : squareXY(mv.to, s.human); const t = svgEl('circle', { cx: r1(x), cy: r1(y), r: 9.5, class: 'ag-target', 'data-to': String(i) }, tg); t.setAttribute('role', 'button'); t.setAttribute('aria-label', (mv.kind === 'split' ? 'split: ' + mv.split + ' here' : mv.kind) + ' to ' + key(mv.to)); });
    // face down (the deck's back) until a card is drawn; a newly drawn card flips over
    const face = s.card == null ? '' : s.card === 'sorry' ? 'Sorry!' : String(s.card);
    if (face !== card.dataset.face) {
      card.dataset.face = face;
      card.textContent = face || 'Sorry!';
      card.classList.toggle('back', !face);
      card.style.fontSize = face === 'Sorry!' ? '13px' : '';
      if (face && !reduced()) { card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip'); }
    }
    drawBtn.disabled = !humanTurn() || s.card != null;
    drawBtn.classList.toggle('ready', !drawBtn.disabled);
    sub.textContent = s.seats.length - 1 + ' computer player' + (s.seats.length > 2 ? 's' : '');
    for (const b of opp.querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset.opp) === s.seats.length - 1);
    const who = (c) => (c === s.human ? 'you' : COLORS[c]);
    status.innerHTML = '';
    const dot = document.createElement('span'); dot.className = 'g-dot'; dot.style.background = HEX[COLORS[s.winner != null ? s.winner : s.turn]]; status.appendChild(dot);
    let line;
    if (s.winner != null) line = s.winner === s.human ? 'You win! All four home.' : COLORS[s.winner] + ' wins this one.';
    else if (humanTurn()) {
      const bumpedMe = s.last && s.last.bumped && s.last.bumped.includes(s.human) && s.last.color !== s.human;
      line = s.card == null ? (bumpedMe ? 'Sorry! ' + COLORS[s.last.color] + ' sent you back · ' : '') + 'Your draw'
        : s.split ? 'Now move another pawn ' + s.split.rest
        : moves.length ? CARD_TEXT[s.card] + (picked != null ? ' · pick a glowing square' : ' · pick a pawn') : CARD_TEXT[s.card] + ' · no move, the card is lost';
    } else line = who(s.turn)[0].toUpperCase() + who(s.turn).slice(1) + (s.card != null ? ' drew ' + (s.card === 'sorry' ? 'Sorry!' : s.card) : ' is drawing…');
    status.appendChild(document.createTextNode(line));
  }
  painters.set(th, paint);
  function schedule() {
    const s = th.state; if (s.winner != null) return;
    const slow = reduced() ? 0.5 : 1;
    if (s.turn !== s.human) {
      if (s.card == null) later(th, () => commit(draw(th.state)), 560 * slow);
      else later(th, () => { const st = th.state, mv = botMove(st); commit(mv ? play(st, mv) : pass(st)); }, 680 * slow);
    } else if (s.card != null && !movesFor(s).length) later(th, () => commit(pass(th.state)), 1300 * slow);
  }
  drawBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!humanTurn() || th.state.card != null) return;
    commit(draw(th.state));
    const moves = myMoves(); if (moves.length && new Set(moves.map((m) => m.pawn)).size === 1) { picked = moves[0].pawn; paint(); }
  });
  board.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target.closest('[data-to]'), pk = e.target.closest('[data-pick]');
    const moves = myMoves(); if (!moves.length) return;
    if (t && picked != null) { const mv = moves.filter((m) => m.pawn === picked)[Number(t.getAttribute('data-to'))]; if (mv) commit(play(th.state, mv)); return; }
    if (pk) {
      const m = Number(pk.getAttribute('data-pick')), mine = moves.filter((mv) => mv.pawn === m);
      if (mine.length === 1) commit(play(th.state, mine[0])); else { picked = m; paint(); }
    }
  });
  opp.addEventListener('click', (e) => { const b = e.target.closest('[data-opp]'); if (!b) return; e.stopPropagation(); commit(createState({ opponents: Number(b.dataset.opp) })); });
  again.addEventListener('click', (e) => { e.stopPropagation(); commit(createState({ opponents: th.state.seats.length - 1 })); });
  paint();
  schedule();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  // in 3D: the same wooden board as Aggravation (skills/mini/aggravation.js) with this board on top and pawns standing on it
  let still = null;
  lift3d(th, stageApi, el, { kind: 'aggravation', board, title: 'Sorry!', W: 460, H: 400, label: '3D Sorry! board: tap a pawn to play; drag to look around', snapshot: () => {
    if (!still) {
      const copy = board.cloneNode(true);
      for (const n of copy.querySelectorAll('.so-pawns > *, .so-targets > *')) n.remove();
      copy.setAttribute('xmlns', NS); copy.setAttribute('width', '400'); copy.setAttribute('height', '400');
      still = new XMLSerializer().serializeToString(copy);
    }
    const xy = (n) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(n.style.transform || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
    return {
      svg: still, piece: 'pawn',
      marbles: [...board.querySelectorAll('.so-pawn')].map((n) => { const [x, y] = xy(n); return { sel: '[data-k="' + n.dataset.k + '"]', x, y, color: HEX[COLORS[+n.dataset.k.split(':')[0]]], can: n.classList.contains('can'), picked: n.classList.contains('picked'), last: n.classList.contains('last') }; }),
      targets: [...board.querySelectorAll('.ag-target')].map((n, i) => ({ sel: '.so-targets > :nth-child(' + (i + 1) + ')', x: +n.getAttribute('cx'), y: +n.getAttribute('cy') })),
    };
  } });
}

async function run(text, api) {
  if (!sorryOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'sorry');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'sorry'; }
  api.summon('sorry', { state: createState(), center: true });
  api.say('Sorry! · you are red · draw a 1 or 2 to leave Start');
  return 'sorry';
}

export default {
  name: 'sorry',
  sorryOf,
  examples: ['play sorry', 'sorry board game', "let's play sorry", 'a game of sorry', 'play sorry!'],
  nearMisses: ['sorry', 'sorry about that', 'i am sorry', 'sorry i was late', 'say sorry', 'play aggravation'],
  match(lower, text) { return sorryOf(text); },
  run,
  stageKinds: { sorry: { mount } },
};
