/**
 * tictactoe skill — the first board game as a real skill (countdown's shape, not make's iframe).
 * "lets play tic tac toe" summons an interactive board on the stage; it stays until thrown off.
 * The engine is a flat 9-element board; the canvas maps it to a 3x3 grid of cells.
 * Hot seat: X and O alternate by tap; the status line calls the result. New game resets.
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

export function tictactoeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|make|start|open|summon)?\s*(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:tic[\s-]*tac[\s-]*toe|noughts\s+and\s+crosses|x'?s?\s+and\s+o'?s?)(?:\s+game)?$/i.test(t)) return { kind: 'game' };
  return null;
}

const BOARD_CSS = 'display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:4px;margin:10px auto 6px;width:max-content';

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card tictactoe-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:180px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(12,12,12,0.92);text-align:center;cursor:grab;user-select:none';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em';
  head.textContent = 'Tic-tac-toe';
  const status = document.createElement('div');
  status.style.cssText = 'font-size:13px;margin-top:6px';
  const grid = document.createElement('div');
  grid.style.cssText = BOARD_CSS;
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'new game';
  again.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:3px 12px;cursor:pointer';
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.style.cssText = 'font:20px ui-monospace,monospace;color:inherit;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:8px;cursor:pointer';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        th.state = resolveMove(th.state, i).nextState;
        paint();
      } catch (_) { /* occupied cell or finished game: no-op */ }
    });
    cells.push(b);
    grid.appendChild(b);
  }
  function paint() {
    for (let i = 0; i < 9; i++) { cells[i].textContent = th.state.board[i] || ''; cells[i].disabled = th.state.board[i] !== null || th.state.status !== 'playing';
      cells[i].setAttribute('aria-label', 'row ' + (Math.floor(i / 3) + 1) + ', column ' + (i % 3 + 1) + ': ' + (th.state.board[i] || 'empty')); }
    status.textContent = th.state.status === 'playing' ? th.state.currentPlayer + "'s move" : th.state.status === 'draw' ? 'draw' : th.state.status.replace('_', ' ');
  }
  again.addEventListener('pointerdown', (e) => e.stopPropagation());
  again.addEventListener('click', (e) => { e.stopPropagation(); th.state = createTicTacToeState(); paint(); });
  el.appendChild(head); el.appendChild(grid); el.appendChild(status); el.appendChild(again);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!tictactoeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'tictactoe');
  if (existing) { api.stage.render(); return 'tictactoe'; } // one board at a time
  api.summon('tictactoe', { state: createTicTacToeState(), x: 60, y: 70 });
  api.say('tic-tac-toe · X starts · tap a square');
  return 'tictactoe';
}

export default {
  name: 'tictactoe',
  tictactoeOf,
  createTicTacToeState,
  resolveMove,
  examples: ['lets play tic tac toe', 'tic tac toe', 'play tic tac toe', 'a game of tic tac toe', 'noughts and crosses'],
  nearMisses: ['who invented tic tac toe', 'tic tac toe rules', 'connect 4', 'what is connect 4'],
  match(lower, text) { return !!tictactoeOf(text); },
  run,
  stageKinds: { tictactoe: { mount } },
};
