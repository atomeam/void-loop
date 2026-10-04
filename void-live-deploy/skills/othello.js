/**
 * othello skill — Othello (Reversi) on the stage, against Void. Same shape as tictactoe: a pure engine and a card.
 * "play othello", "lets play reversi" summons the board; it stays until thrown off.
 * The engine is a flat 64-cell board (0 empty, 1 black = you, 2 white = Void). A move must flip at least one disc,
 * along any of the 8 directions; a side with no legal move passes; the game ends when neither side can move,
 * and the side with more discs wins.
 * Void plays by a position table (corners high, the squares next to corners low) plus the discs it flips.
 */
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
  el.className = 'thing kept-card othello-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:260px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(12,12,12,0.92);text-align:center;cursor:grab;user-select:none';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em';
  head.textContent = 'Othello';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,28px);grid-template-rows:repeat(8,28px);gap:2px;margin:10px auto 6px;width:max-content;background:#0e3b24;padding:3px;border-radius:6px';
  const status = document.createElement('div');
  status.style.cssText = 'font-size:13px;margin:4px 0 6px';
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'new game';
  again.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:3px 12px;cursor:pointer';
  const cells = [];
  let thinking = null;
  for (let i = 0; i < N * N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.setAttribute('aria-label', 'square ' + 'abcdefgh'[i % N] + (Math.floor(i / N) + 1));
    b.style.cssText = 'padding:0;border:0;border-radius:3px;background:#17643d;cursor:pointer;display:flex;align-items:center;justify-content:center';
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
      const m = voidMove(th.state.board, 2);
      if (m >= 0) th.state = resolveMove(th.state, m).nextState;
      paint(); stageApi.save && stageApi.save();
      voidTurn(); // you had no move, so Void goes again
    }, 380);
  }
  function paint() {
    const legal = th.state.status === 'playing' && th.state.turn === 1 ? new Set(legalMoves(th.state.board, 1)) : new Set();
    for (let i = 0; i < N * N; i++) {
      const v = th.state.board[i], c = cells[i];
      c.textContent = '';
      if (v || legal.has(i)) {
        const d = document.createElement('span');
        d.style.cssText = 'width:22px;height:22px;border-radius:50%;' + (v === 1 ? 'background:radial-gradient(circle at 35% 30%,#555,#0a0a0a)' : v === 2 ? 'background:radial-gradient(circle at 35% 30%,#fff,#bdbdbd)' : 'width:8px;height:8px;background:rgba(255,255,255,.28)');
        c.appendChild(d);
      }
      c.style.cursor = legal.has(i) ? 'pointer' : 'default';
      c.setAttribute('aria-label', 'square ' + 'abcdefgh'[i % N] + (Math.floor(i / N) + 1) + ': ' + (v === 1 ? 'black' : v === 2 ? 'white' : legal.has(i) ? 'empty, you can play here' : 'empty'));
    }
    const { black, white } = countDiscs(th.state.board), s = th.state.status;
    status.textContent = (s === 'playing'
      ? (th.state.turn === 1 ? (th.state.passed ? 'Void had no move · ' : '') + 'your move (black)' : 'Void is thinking…')
      : s === 'draw' ? 'a draw' : s === 'black_wins' ? 'you win' : 'Void wins') + ' · ' + black + '–' + white;
  }
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(thinking); thinking = null; th.state = createOthelloState(); paint(); stageApi.save && stageApi.save(); });
  el.appendChild(head); el.appendChild(grid); el.appendChild(status); el.appendChild(again);
  paint();
  voidTurn(); // a board reloaded mid-game on Void's turn picks up where it was
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!othelloOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'othello');
  if (existing) { api.stage.render(); return 'othello'; } // one board at a time
  api.summon('othello', { state: createOthelloState(), x: 60, y: 70 });
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
