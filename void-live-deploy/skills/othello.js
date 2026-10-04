/**
 * othello engine — reversible disc-flipping logic for 8x8 board
 * Used by the make skill's Othello game and exposed for suite checks
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Examples: "play othello", "reversi", "start othello game"
 * Near misses: "what is othello", "how to play reversi", "othello rules"
 */

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function ix(r, c) { return r * 8 + c; }
function rc(i) { return [Math.floor(i / 8), i % 8]; }
function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

/** Return indices of opponent discs that would flip if player plays at pos */
export function flips(board, pos, player) {
  const opp = player === 1 ? 2 : 1;
  const out = [];
  const r0 = Math.floor(pos / 8), c0 = pos % 8;
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr, c = c0 + dc;
    const path = [];
    while (inside(r, c)) {
      const idx = ix(r, c);
      if (board[idx] === opp) path.push(idx);
      else if (board[idx] === player && path.length) { out.push(...path); break; }
      else break;
      r += dr; c += dc;
    }
  }
  return out;
}

/** Return all valid move indices for player */
export function validMoves(board, player) {
  const v = [];
  for (let i = 0; i < 64; i++) if (!board[i] && flips(board, i, player).length) v.push(i);
  return v;
}

/** Count discs: [black, white] */
export function count(board) {
  let bl = 0, wh = 0;
  for (const v of board) { if (v === 1) bl++; else if (v === 2) wh++; }
  return [bl, wh];
}

/** Initial board state */
export function initialBoard() {
  const b = new Array(64).fill(0);
  b[27] = b[36] = 2; // white
  b[28] = b[35] = 1; // black
  return b;
}

/** Simple greedy AI: pick move that maximizes immediate disc count */
export function aiMove(board) {
  const moves = validMoves(board, 2);
  if (!moves.length) return -1;
  let best = -1, bestScore = -1e9;
  for (const m of moves) {
    const bb = board.slice();
    bb[m] = 2;
    flips(bb, m, 2).forEach(j => bb[j] = 2);
    const sc = count(bb)[1];
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}

/** Check if game is over (no valid moves for either player) */
export function isGameOver(board) {
  return !validMoves(board, 1).length && !validMoves(board, 2).length;
}

/** Result string for end of game */
export function result(board) {
  const [bl, wh] = count(board);
  if (bl > wh) return { winner: 1, text: `you win! ${bl}-${wh}` };
  if (wh > bl) return { winner: 2, text: `Void wins ${wh}-${bl}` };
  return { winner: 0, text: `draw ${bl}-${wh}` };
}

export function othelloOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:play\s+)?(?:othello|reversi)$/.test(t)) return { kind: 'game', id: 'othello', label: 'Othello' };
  if (/^(?:lets?\s+play\s+|can\s+we\s+play\s+|i\s+want\s+to\s+play\s+)(?:othello|reversi)$/.test(t)) return { kind: 'game', id: 'othello', label: 'Othello' };
  return null;
}

export default {
  name: 'othello',
  examples: ['play othello', 'reversi', 'start othello game', 'lets play othello'],
  nearMisses: ['what is othello', 'how to play reversi', 'othello rules', 'othello strategy', 'reversi tips'],
  match(lower, text) { return !!othelloOf(text); },
  run(text, api) {
    const q = othelloOf(text);
    if (!q) return 'none';
    const { showPage, esc } = api;
    const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.label) + '</h2><div class="sub">Engine only — UI rendered by make skill</div>'; });
    return 'othello';
  }
};