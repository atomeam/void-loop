/**
 * tictactoe skill — the first board game as a real skill (countdown's shape, not make's iframe).
 * "lets play tic tac toe" summons an interactive board on the stage; it stays until thrown off.
 * The engine is a flat 9-element board; the canvas maps it to a 3x3 grid of cells.
 * You are X and Void is O: after each tap Void answers with its best move (full minimax, so it never loses).
 * The status line calls the result. New game resets.
 */
export function createTicTacToeState() {
  return {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    status: 'playing', // 'playing', 'X_wins', 'O_wins', 'draw'
  };
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export function resolveMove(state, index) {
  if (state.board[index] !== null || state.status !== 'playing') {
    throw new Error(`Invalid move at index ${index}`);
  }
  const nextBoard = [...state.board];
  nextBoard[index] = state.currentPlayer;
  let nextStatus = 'playing';
  for (const [a, b, c] of WINNING_COMBOS) {
    if (nextBoard[a] && nextBoard[a] === nextBoard[b] && nextBoard[a] === nextBoard[c]) {
      nextStatus = `${state.currentPlayer}_wins`;
      break;
    }
  }
  if (nextStatus === 'playing' && !nextBoard.includes(null)) nextStatus = 'draw';
  return {
    nextState: {
      board: nextBoard,
      currentPlayer: state.currentPlayer === 'X' ? 'O' : 'X',
      status: nextStatus,
    },
    effects: [{ type: 'place', index, player: state.currentPlayer }],
    legalMoves: nextBoard.map((v, i) => (v === null ? i : null)).filter((i) => i !== null),
    status: nextStatus,
  };
}

// Void's move: full minimax over the flat board (9 squares, so it is instant). Wins fast, loses slow; ties go to the lowest index.
export function bestMove(state) {
  const me = state.currentPlayer, other = me === 'X' ? 'O' : 'X';
  const score = (board, player, depth) => {
    for (const [a, b, c] of WINNING_COMBOS) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] === me ? 10 - depth : depth - 10;
    if (!board.includes(null)) return 0;
    let best = player === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = player;
      const v = score(board, player === me ? other : me, depth + 1);
      board[i] = null;
      best = player === me ? Math.max(best, v) : Math.min(best, v);
    }
    return best;
  };
  const board = [...state.board];
  let pick = null, top = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = me;
    const v = score(board, other, 1);
    board[i] = null;
    if (v > top) { top = v; pick = i; }
  }
  return pick;
}

export function tictactoeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|make|start|open|summon)?\s*(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:(?:3d|3-d|three[\s-]?d)\s+)?(?:tic[\s-]*tac[\s-]*toe|noughts\s+and\s+crosses|x'?s?\s+and\s+o'?s?)(?:\s+game)?$/i.test(t)) return { kind: 'game' };
  return null;
}

const X_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M27 27L73 73M73 27L27 73" stroke="#7a1d1c" stroke-width="15" stroke-linecap="round" transform="translate(1.5,3)" opacity=".55"/><path d="M27 27L73 73M73 27L27 73" stroke="url(#tttX)" stroke-width="14" stroke-linecap="round"/><path d="M29 27L71 69M71 27L35 63" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/><defs><linearGradient id="tttX" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5534b"/><stop offset="1" stop-color="#a8231f"/></linearGradient></defs></svg>';
const O_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="51.5" cy="53" r="24" fill="none" stroke="#5b4a2e" stroke-width="13" opacity=".5"/><circle cx="50" cy="50" r="24" fill="none" stroke="url(#tttO)" stroke-width="13"/><path d="M33 40A20 20 0 0 1 52 30" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/><defs><linearGradient id="tttO" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6e9"/><stop offset="1" stop-color="#cdbf9f"/></linearGradient></defs></svg>';

function winLine(board) {
  for (const w of WINNING_COMBOS) { const [a, b, c] = w; if (board[a] && board[a] === board[b] && board[a] === board[c]) return w; }
  return null;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card tictactoe-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px';
  el.innerHTML = '<div class="g-head"><span class="g-title">Tic-tac-toe</span><span class="g-sub">you are X</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const grid = document.createElement('div'); grid.className = 'ttt-board';
  wrap.appendChild(grid);
  const bar = document.createElement('div'); bar.className = 'g-bar';
  const status = document.createElement('div'); status.className = 'g-status'; status.setAttribute('aria-live', 'polite');
  const again = document.createElement('button');
  again.type = 'button'; again.className = 'g-btn'; again.textContent = 'New game';
  bar.append(status, again);
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.className = 'ttt-cell';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (th.state.currentPlayer !== 'X') return; // Void is answering
      try {
        th.state = resolveMove(th.state, i).nextState;
        paint();
      } catch (_) { return; /* occupied cell or finished game: no-op */ }
      const was = th.state;
      if (was.status === 'playing') setTimeout(() => {
        if (th.state !== was) return; // new game or board gone in the meantime
        const m = bestMove(was);
        if (m !== null) { th.state = resolveMove(was, m).nextState; paint(); stageApi.save && stageApi.save(); }
      }, 420);
    });
    cells.push(b);
    grid.appendChild(b);
  }
  const shown = Array(9).fill(null);
  function paint() {
    const line = winLine(th.state.board);
    for (let i = 0; i < 9; i++) {
      const v = th.state.board[i];
      if (shown[i] !== v) { cells[i].innerHTML = v === 'X' ? X_SVG : v === 'O' ? O_SVG : ''; cells[i].classList.toggle('placed', !!v); shown[i] = v; }
      cells[i].disabled = v !== null || th.state.status !== 'playing' || th.state.currentPlayer !== 'X';
      cells[i].classList.toggle('win', !!(line && line.includes(i)));
      cells[i].setAttribute('aria-label', 'row ' + (Math.floor(i / 3) + 1) + ', column ' + (i % 3 + 1) + ': ' + (v || 'empty'));
    }
    const s = th.state.status;
    status.textContent = s === 'playing' ? (th.state.currentPlayer === 'X' ? 'Your move' : 'Void is thinking…') : s === 'draw' ? 'A draw. Void never loses.' : s === 'X_wins' ? 'You win!' : 'Void wins this one.';
  }
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); th.state = createTicTacToeState(); paint(); stageApi.save && stageApi.save(); });
  el.append(wrap, bar);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!tictactoeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'tictactoe');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'tictactoe'; } // one board at a time
  api.summon('tictactoe', { state: createTicTacToeState(), center: true });
  api.say('tic-tac-toe · you are X · tap a square');
  return 'tictactoe';
}

export default {
  name: 'tictactoe',
  tictactoeOf,
  createTicTacToeState,
  resolveMove,
  bestMove,
  examples: ['lets play tic tac toe', 'tic tac toe', 'play tic tac toe', 'a game of tic tac toe', 'noughts and crosses', 'play 3d tic tac toe'],
  nearMisses: ['who invented tic tac toe', 'tic tac toe rules', 'connect 4', 'what is connect 4'],
  match(lower, text) { return !!tictactoeOf(text); },
  run,
  stageKinds: { tictactoe: { mount } },
};
