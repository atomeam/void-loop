/**
 * chess skill — a real wooden chess set on the stage (skills/mini/chess.js), played against Void.
 * "play chess", "chess", "lets play chess" summons it; it stays until thrown off. You are white; tap a piece, then a square.
 * The rules live in skills/chess-rules.js (castling, en passant, promotion, check, mate, stalemate, draws); Void searches
 * in a Web Worker (skills/chess-worker.js) so the pieces keep moving smoothly while it thinks.
 * Where WebGL can't run, the same game shows as a flat board of buttons, so the card always works.
 */
import * as R from './chess-rules.js';

export function chessOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|i'd like to|wanna|want to)\s+)?(?:play|start|open|summon|begin|new|set up|setup)?\s*(?:me\s+|us\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:new\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:3d\s+)?chess(?:\s+(?:game|board|set|match))?(?:\s+(?:with|against|vs\.?)\s+(?:me|void|you|the computer))?$/.test(t)) return { kind: 'game', fresh: /\bnew\b/.test(t) };
  return null;
}

const GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const STATUS = { checkmate: (s) => (s.turn === 'w' ? 'Checkmate · Void wins' : 'Checkmate · you win'), stalemate: () => 'Stalemate · a draw', 'draw-50': () => 'Draw · fifty quiet moves', 'draw-material': () => 'Draw · not enough to mate', 'draw-repetition': () => 'Draw · the same position three times' };
const thinking = new Map(); // th.id -> pending search, so a re-render never starts a second one
let worker = null, seq = 0;
function think(s) {
  return new Promise((res) => {
    const opts = { depth: 5, ms: 1100 };
    try {
      if (!worker) worker = new Worker(new URL('./chess-worker.js', import.meta.url), { type: 'module' });
      const id = ++seq;
      const on = (e) => { if (e.data.id !== id) return; worker.removeEventListener('message', on); res(e.data.m); };
      worker.addEventListener('message', on);
      worker.postMessage({ id, s, opts });
    } catch (_) { setTimeout(() => res(R.bestMove(s, { depth: 4, ms: 700 })), 30); } // no module workers: think on the page
  });
}
const freshState = () => ({ s: R.create(), moves: [], sel: -1 });
const btnCss = 'font:inherit;font-size:12px;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:3px 12px;cursor:pointer';

function mount(th, stageApi) {
  if (!th.state || !th.state.s) th.state = freshState();
  const phone = Math.min(innerWidth, innerHeight) < 560;
  const W = phone ? Math.min(innerWidth - 20, 420) : 560, H = Math.round(W * 0.78);
  const el = document.createElement('div');
  el.className = 'thing kept-card chess-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;padding:10px;border:1px solid var(--line);border-radius:16px;background:rgba(12,12,13,0.94);text-align:center;cursor:grab;user-select:none;box-shadow:0 18px 50px rgba(0,0,0,.45)';
  // a desktop board stands on the stage itself (no frame, no table rectangle); the controls are a slim strip under it, and
  // the strip is what you drag. Phones keep the framed card (a free board beside the screen edge would run off it).
  const free = !phone;
  if (free) el.classList.add('free-board'); // the stage's shared card look (background, border, padding) stays off
  if (free) el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:2px 0 8px';
  head.textContent = 'Chess · you are white';
  const view = document.createElement('div');
  view.className = 'chess-view';
  view.style.cssText = free ? 'position:relative;width:100%;height:' + Math.round(H * 0.86) + 'px' : 'position:relative;width:100%;height:' + H + 'px;border-radius:11px;overflow:hidden;background:#0c0c0d';
  const status = document.createElement('div');
  status.className = 'chess-status';
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'font-size:13px;margin:8px 0 2px;min-height:18px';
  const moves = document.createElement('div');
  moves.style.cssText = 'color:var(--muted);font-size:11px;min-height:15px;white-space:nowrap;overflow:hidden';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px';
  const again = document.createElement('button'); again.type = 'button'; again.textContent = 'new game'; again.style.cssText = btnCss;
  const back = document.createElement('button'); back.type = 'button'; back.textContent = 'take back'; back.style.cssText = btnCss;
  bar.append(back, again);
  const picker = document.createElement('div'); // promotion: choose the piece
  picker.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,.45);z-index:2';
  view.appendChild(picker);
  for (const x of [view, again, back, picker]) x.addEventListener('pointerdown', (e) => e.stopPropagation());

  let mini = null, flat = null;
  const st = () => th.state;
  const save = () => stageApi.save && stageApi.save();
  function targetsOf(sq) { return sq < 0 ? [] : R.legalMoves(st().s).filter((m) => m.from === sq); }
  function data() {
    const s = st().s, chk = R.inCheck(s) ? s.board.indexOf(s.turn === 'w' ? 'K' : 'k') : -1;
    const seen = new Set();
    const targets = targetsOf(st().sel).filter((m) => (seen.has(m.to) ? false : seen.add(m.to))).map((m) => ({ to: m.to, capture: !!m.captured }));
    return { free, board: s.board, last: s.last || null, selected: st().sel, targets, check: chk, onSquare };
  }
  function paint() {
    const s = st().s, code = R.status(s), busy = thinking.has(th.id);
    status.textContent = STATUS[code] ? STATUS[code](s) : busy ? 'Void is thinking…' : s.turn === 'w' ? (code === 'check' ? 'Check · your move' : 'Your move') : 'Void to move';
    const list = st().moves; let txt = '';
    for (let i = 0; i < list.length; i += 2) txt += (i / 2 + 1) + '. ' + list[i] + (list[i + 1] ? ' ' + list[i + 1] : '') + '  ';
    txt = txt.trim(); moves.title = txt;
    moves.textContent = txt.length > (phone ? 44 : 70) ? '… ' + txt.slice(-(phone ? 44 : 70)).replace(/^\S*\s/, '') : txt; // the latest moves, cut at a word
    back.disabled = !list.length; back.style.opacity = list.length ? '1' : '.4';
    if (mini) mini.update(data()); else if (flat) flat();
  }
  function doMove(m) {
    const before = st().s; const label = R.moveLabel(before, m);
    st().hist = (st().hist || []).concat([before]).slice(-60); // take back needs the positions before
    st().s = R.play(before, m); st().moves.push(label); st().sel = -1;
    save(); paint();
  }
  function voidTurn() {
    const s = st().s;
    if (s.turn !== 'b' || R.isOver(R.status(s)) || thinking.has(th.id)) return;
    const started = Date.now();
    const p = think(s).then((m) => new Promise((res) => setTimeout(() => res(m), Math.max(0, 650 - (Date.now() - started))))).then((m) => {
      thinking.delete(th.id);
      if (st().s !== s || !m) { paint(); return; } // the game changed while Void thought
      doMove(m);
      if (!el.isConnected) stageApi.render(); // the card re-rendered while Void thought: show the move on the live card
    });
    thinking.set(th.id, p); paint();
  }
  function onSquare(sq0, cands = [sq0]) {
    const s = st().s;
    if (s.turn !== 'w' || thinking.has(th.id) || R.isOver(R.status(s))) return;
    // along the tap's ray, prefer a square you can move to, then one of your pieces that can move
    const tos = new Set(targetsOf(st().sel).map((m) => m.to)), mine = new Set(R.legalMoves(s).map((m) => m.from));
    const sq = cands.find((q) => tos.has(q)) ?? cands.find((q) => mine.has(q) && q !== st().sel) ?? sq0;
    const hit = targetsOf(st().sel).filter((m) => m.to === sq);
    if (hit.length) {
      if (hit.length > 1 && hit[0].promo) return askPromo(hit);
      doMove(hit[0]); voidTurn(); return;
    }
    const p = s.board[sq];
    st().sel = p && p === p.toUpperCase() && sq !== st().sel && targetsOf(sq).length ? sq : -1;
    paint();
  }
  function askPromo(choices) {
    picker.textContent = ''; picker.style.display = 'flex';
    for (const t of ['Q', 'R', 'B', 'N']) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = GLYPH[t]; b.setAttribute('aria-label', 'promote to ' + { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' }[t]);
      b.style.cssText = 'font-size:34px;width:56px;height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(20,16,12,.9);color:#f3e6cf;cursor:pointer';
      b.addEventListener('click', (e) => { e.stopPropagation(); picker.style.display = 'none'; doMove(choices.find((m) => m.promo === t)); voidTurn(); });
      picker.appendChild(b);
    }
  }
  function flatBoard() { // the same game as buttons, for browsers without WebGL
    const grid = document.createElement('div');
    grid.className = 'chess-flat';
    const cell = Math.floor(Math.min(W - 24, H - 8) / 8);
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,' + cell + 'px);margin:4px auto;width:max-content;border:6px solid #6b4a2e;border-radius:6px';
    const cells = [];
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
      const sq = r * 8 + f, b = document.createElement('button'); b.type = 'button'; b.dataset.sq = sq;
      b.style.cssText = 'width:' + cell + 'px;height:' + cell + 'px;padding:0;border:0;font-size:' + Math.round(cell * 0.72) + 'px;line-height:1;cursor:pointer;background:' + ((r + f) % 2 ? '#e9d3ad' : '#9c6b43');
      b.addEventListener('click', (e) => { e.stopPropagation(); onSquare(sq); }); cells[sq] = b; grid.appendChild(b);
    }
    view.appendChild(grid);
    return () => {
      const d = data(), tg = new Set(d.targets.map((t) => t.to));
      cells.forEach((b, sq) => { const p = d.board[sq]; b.textContent = p ? GLYPH[p] : ''; b.style.color = p && p === p.toUpperCase() ? '#fffaf0' : '#1b120b';
        b.style.textShadow = p && p === p.toUpperCase() ? '0 0 2px #000,0 1px 2px #000' : '0 0 1px #fff8';
        b.style.boxShadow = sq === d.selected ? 'inset 0 0 0 3px #ffd36b' : tg.has(sq) ? 'inset 0 0 0 3px #9fe08a' : d.last && (sq === d.last.from || sq === d.last.to) ? 'inset 0 0 0 99px rgba(232,176,74,.35)' : sq === d.check ? 'inset 0 0 0 99px rgba(255,59,47,.45)' : 'none';
        b.setAttribute('aria-label', R.sqName(sq) + (p ? ' ' + GLYPH[p] : '')); });
    };
  }
  again.addEventListener('click', (e) => { e.stopPropagation(); thinking.delete(th.id); th.state = freshState(); picker.style.display = 'none'; save(); paint(); });
  back.addEventListener('click', (e) => { e.stopPropagation(); const h = st().hist || []; if (!h.length) return; thinking.delete(th.id);
    // undo your move and Void's reply together, so it is your turn again
    let n = st().s.turn === 'w' && h.length >= 2 ? 2 : 1; st().s = h[h.length - n]; st().hist = h.slice(0, h.length - n); st().moves = st().moves.slice(0, -n); st().sel = -1; save(); paint(); voidTurn(); });

  if (free) {
    const strip = document.createElement('div');
    strip.className = 'chess-strip';
    strip.style.cssText = 'display:inline-flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:-10px;padding:7px 10px 7px 16px;border:1px solid var(--line);border-radius:14px;background:rgba(12,12,13,0.86);backdrop-filter:blur(8px);cursor:grab;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92%';
    head.style.padding = '0'; status.style.margin = '0'; bar.style.marginTop = '0';
    strip.append(head, status, moves, bar);
    el.append(view, strip);
  } else el.append(head, view, status, moves, bar);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  paint();
  const fallback = () => { if (flat) return; flat = flatBoard(); paint(); };
  if (stageApi.miniature) {
    stageApi.miniature(view, 'chess', data(), { key: 'chess:' + th.id, label: '3D chess board: tap a piece, then a square; drag to look around', maxPolar: 1.22, minPolar: 0.15 })
      .then((h) => { mini = h; paint(); }).catch((e) => { console.warn('[chess] 3D unavailable, flat board', e); fallback(); });
  } else fallback();
  voidTurn(); // a reloaded board on Void's turn picks up where it was
}

async function run(text, api) {
  const q = chessOf(text);
  if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'chess');
  if (existing) { if (q.fresh) existing.state = freshState(); api.stage.render(); return 'chess'; } // one board at a time
  const phone = Math.min(innerWidth, innerHeight) < 560, w = phone ? Math.min(innerWidth - 20, 420) : 560;
  api.summon('chess', { state: freshState(), x: Math.max(10, Math.round((innerWidth - w) / 2)), y: phone ? 56 : 48 });
  api.say('Chess · you are white · tap a piece, then a square · drag to look around');
  return 'chess';
}

export default {
  name: 'chess',
  chessOf,
  examples: ['play chess', 'chess', 'lets play chess', 'a game of chess', 'play chess against void', 'new chess game', 'start a chess game', '3d chess'],
  nearMisses: ['who invented chess', 'chess rules', 'chess openings', 'magnus carlsen', 'play checkers', 'chess.com'],
  match(lower, text) { return !!chessOf(text); },
  run,
  stageKinds: { chess: { mount } },
};
