/**
 * othello skill — Othello (Reversi) on the stage, against Void. Same shape as tictactoe: a pure engine and a card.
 * "play othello", "lets play reversi" summons the board; it stays until thrown off.
 * The engine is a flat 64-cell board (0 empty, 1 black = you, 2 white = Void). A move must flip at least one disc,
 * along any of the 8 directions; a side with no legal move passes; the game ends when neither side can move,
 * and the side with more discs wins.
 * Void plays by a position table (corners high, the squares next to corners low) plus the discs it flips.
 */
import { lift3d } from './lift3d.js';
const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function createOthelloState() {
  const board = Array(N * N).fill(0);
  board[27] = 2; board[28] = 1; board[35] = 1; board[36] = 2; // d4 white, e4 black, d5 black, e5 white
  return { board, turn: 1, status: 'playing', passed: false };
}

// the discs a move at index i by player p would flip (empty when the move is illegal)
export function flipsFor(board, i, p) {
  if (board[i] !== 0) return [];
  const r0 = Math.floor(i / N), c0 = i % N, o = 3 - p, out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === o) { line.push(r * N + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === p) out.push(...line);
  }
  return out;
}

export function legalMoves(board, p) {
  const out = [];
  for (let i = 0; i < N * N; i++) if (flipsFor(board, i, p).length) out.push(i);
  return out;
}

export function countDiscs(board) {
  let black = 0, white = 0;
  for (const v of board) { if (v === 1) black++; else if (v === 2) white++; }
  return { black, white };
}

// place, flip, then hand the turn over, or pass back if the other side can't move, or end the game
export function resolveMove(state, i) {
  if (state.status !== 'playing') throw new Error('game over');
  const flips = flipsFor(state.board, i, state.turn);
  if (!flips.length) throw new Error(`Illegal move at ${i}`);
  const board = [...state.board];
  board[i] = state.turn;
  for (const f of flips) board[f] = state.turn;
  const other = 3 - state.turn;
  let turn = other, passed = false, status = 'playing';
  if (!legalMoves(board, other).length) {
    if (legalMoves(board, state.turn).length) { turn = state.turn; passed = true; }
    else {
      const { black, white } = countDiscs(board);
      status = black > white ? 'black_wins' : white > black ? 'white_wins' : 'draw';
    }
  }
  return { nextState: { board, turn, status, passed }, flips };
}

const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
// Void's pick: the best position value plus discs flipped, minus the best reply the opponent then has
export function voidMove(board, p = 2) {
  let best = -1, bestScore = -Infinity;
  for (const i of legalMoves(board, p)) {
    const flips = flipsFor(board, i, p), b = [...board];
    b[i] = p; for (const f of flips) b[f] = p;
    const reply = Math.max(0, ...legalMoves(b, 3 - p).map((j) => WEIGHTS[j]));
    const score = WEIGHTS[i] + flips.length - reply;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function othelloOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|make|start|open|summon)?\s*(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:othello|reversi)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  return null;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card othello-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px';
  el.innerHTML = '<div class="g-head"><span class="g-title">Othello</span><span class="g-sub">you are black</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const frame = document.createElement('div'); frame.className = 'oth-frame';
  const grid = document.createElement('div'); grid.className = 'oth-board';
  frame.appendChild(grid); wrap.appendChild(frame);
  const bar = document.createElement('div'); bar.className = 'g-bar';
  const score = document.createElement('div'); score.className = 'oth-score';
  const status = document.createElement('div'); status.className = 'g-status'; status.setAttribute('aria-live', 'polite');
  const again = document.createElement('button');
  again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  bar.append(score, status, again);
  const cells = [];
  let thinking = null;
  for (let i = 0; i < N * N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.className = 'oth-cell';
    b.setAttribute('aria-label', 'square ' + 'abcdefgh'[i % N] + (Math.floor(i / N) + 1));
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (thinking || th.state.turn !== 1) return;
      try { th.state = resolveMove(th.state, i).nextState; } catch (_) { return; } // not a legal square: no-op
      paint(); stageApi.save && stageApi.save();
      voidTurn();
    });
    cells.push(b);
    grid.appendChild(b);
  }
  function voidTurn() {
    if (th.state.status !== 'playing' || th.state.turn !== 2) return;
    thinking = setTimeout(() => {
      thinking = null;
      if (!el.isConnected) return; // the stage redrew: the new card carries on
      const m = voidMove(th.state.board, 2);
      if (m >= 0) th.state = resolveMove(th.state, m).nextState;
      paint(); stageApi.save && stageApi.save();
      voidTurn(); // you had no move, so Void goes again
    }, 520);
  }
  let prev = null;
  function paint() {
    const legal = th.state.status === 'playing' && th.state.turn === 1 ? new Set(legalMoves(th.state.board, 1)) : new Set();
    for (let i = 0; i < N * N; i++) {
      const v = th.state.board[i], c = cells[i];
      c.textContent = '';
      if (v || legal.has(i)) {
        const d = document.createElement('span');
        d.className = v === 1 ? 'oth-disc black' : v === 2 ? 'oth-disc white' : 'oth-hint';
        if (v && prev && prev[i] && prev[i] !== v) d.classList.add('flip');
        if (v && prev && !prev[i]) d.classList.add('drop');
        c.appendChild(d);
      }
      c.classList.toggle('legal', legal.has(i));
    }
    prev = th.state.board.slice();
    const { black, white } = countDiscs(th.state.board), s = th.state.status;
    score.innerHTML = '<span class="oth-chip black"></span>' + black + '<span class="oth-chip white"></span>' + white;
    status.textContent = s === 'playing'
      ? (th.state.turn === 1 ? (th.state.passed ? 'Void had no move · ' : '') + 'Your move' : 'Void is thinking…')
      : s === 'draw' ? 'A draw' : s === 'black_wins' ? 'You win!' : 'Void wins';
  }
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(thinking); thinking = null; th.state = createOthelloState(); prev = null; paint(); stageApi.save && stageApi.save(); });
  el.append(wrap, bar);
  paint();
  voidTurn(); // a board reloaded mid-game on Void's turn picks up where it was
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  // the board stands in the void in 3D (skills/mini/othello.js), the rest of the card beside it; the 2D board stays the fallback
  lift3d(th, stageApi, el, { kind: 'othello', board: grid, title: 'Othello', W: 440, H: 360,
    snapshot: () => ({ board: th.state.board.slice(), legal: [...grid.querySelectorAll('.oth-cell.legal')].map((b) => +b.dataset.i) }) });
}

async function run(text, api) {
  if (!othelloOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'othello');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'othello'; } // one board at a time
  api.summon('othello', { state: createOthelloState(), center: true });
  api.say('Othello · you are black · tap a dotted square to flip Void’s discs');
  return 'othello';
}

export default {
  name: 'othello',
  othelloOf,
  createOthelloState,
  flipsFor,
  legalMoves,
  resolveMove,
  voidMove,
  examples: ['play othello', 'lets play othello', 'othello', 'a game of reversi', 'play reversi against void'],
  nearMisses: ['who invented othello', 'othello by shakespeare', 'othello rules', 'tic tac toe', 'connect 4'],
  match(lower, text) { return !!othelloOf(text); },
  run,
  stageKinds: { othello: { mount } },
};
