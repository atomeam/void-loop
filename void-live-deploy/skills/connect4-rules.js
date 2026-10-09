/**
 * connect4-rules — Connect Four in plain JS (no DOM, no three.js), shared by the card (skills/connect4.js), its 3D frame
 * and the tests. On Adam's list as the game of forced sequences and tactical prediction: Void looks several moves ahead
 * (alpha-beta) and every disc it drops says why: a win now, a block of your four, a threat it is building, or the best
 * line it found. Board: 6 rows x 7 columns, cell = row * 7 + col, row 0 at the top. You are red (1), Void is yellow (2).
 *   create() -> state      drop(s, col) -> s      voidMove(s) -> { col, why }      winLine(board, p) -> [cells] | null
 */
export const R = 6, C = 7;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const ORDER = [3, 2, 4, 1, 5, 0, 6];

export function create() { return { board: Array(R * C).fill(0), turn: 1, over: null, last: -1, log: [] }; }
export const rowFor = (board, col) => { for (let r = R - 1; r >= 0; r--) if (!board[r * C + col]) return r; return -1; };
export function winLine(board, p) {
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (board[r * C + c] !== p) continue;
    for (const [dr, dc] of DIRS) {
      const cells = [0, 1, 2, 3].map((n) => [r + dr * n, c + dc * n]);
      if (cells.every(([rr, cc]) => rr >= 0 && rr < R && cc >= 0 && cc < C && board[rr * C + cc] === p)) return cells.map(([rr, cc]) => rr * C + cc);
    }
  }
  return null;
}
const full = (board) => board.slice(0, C).every(Boolean);

export function drop(s0, col, why) {
  if (s0.over || !(col >= 0 && col < C)) return s0;
  const r = rowFor(s0.board, col);
  if (r < 0) return s0;
  const s = { ...s0, board: s0.board.slice(), log: s0.log.slice(-80) }, p = s.turn;
  s.board[r * C + col] = p; s.last = r * C + col;
  s.log.push({ who: p === 1 ? 'You' : 'Void', text: 'dropped in column ' + (col + 1), ...(why ? { why } : {}) });
  if (winLine(s.board, p)) s.over = p === 1 ? 'you' : 'void';
  else if (full(s.board)) s.over = 'draw';
  else s.turn = 3 - p;
  return s;
}

// a position's value for Void: open lines of two and three, the centre column
function score(b) {
  let s = 0;
  for (let r = 0; r < R; r++) s += b[r * C + 3] === 2 ? 3 : b[r * C + 3] === 1 ? -3 : 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of DIRS) {
    let v = 0, y = 0, e = 0, ok = true;
    for (let n = 0; n < 4; n++) { const rr = r + dr * n, cc = c + dc * n; if (rr < 0 || rr >= R || cc < 0 || cc >= C) { ok = false; break; } const x = b[rr * C + cc]; if (x === 2) v++; else if (x === 1) y++; else e++; }
    if (!ok) continue;
    if (v === 3 && e === 1) s += 6; else if (v === 2 && e === 2) s += 2;
    if (y === 3 && e === 1) s -= 8; else if (y === 2 && e === 2) s -= 2;
  }
  return s;
}
function search(b, depth, a, z, maxi) {
  if (winLine(b, 2)) return 100000 + depth;
  if (winLine(b, 1)) return -100000 - depth;
  if (!depth || full(b)) return score(b);
  let best = maxi ? -1e9 : 1e9;
  for (const c of ORDER) {
    const r = rowFor(b, c); if (r < 0) continue;
    b[r * C + c] = maxi ? 2 : 1;
    const v = search(b, depth - 1, a, z, !maxi);
    b[r * C + c] = 0;
    if (maxi) { best = Math.max(best, v); a = Math.max(a, v); } else { best = Math.min(best, v); z = Math.min(z, v); }
    if (a >= z) break;
  }
  return best;
}
// Void's choice and why. The why is checked in this order: win now, block your four, then what the look-ahead found.
export function voidMove(s, depth = 6) {
  const b = s.board.slice(), cols = ORDER.filter((c) => rowFor(b, c) >= 0);
  const tryDrop = (c, p) => { const r = rowFor(b, c); b[r * C + c] = p; const w = !!winLine(b, p); b[r * C + c] = 0; return w; };
  const win = cols.find((c) => tryDrop(c, 2));
  if (win != null) return { col: win, why: 'it makes four in a row' };
  const block = cols.find((c) => tryDrop(c, 1));
  if (block != null) return { col: block, why: 'you would make four in column ' + (block + 1) + ' next' };
  let best = cols[0], bestV = -1e9;
  for (const c of cols) { const r = rowFor(b, c); b[r * C + c] = 2; const v = search(b, depth - 1, -1e9, 1e9, false); b[r * C + c] = 0; if (v > bestV) { bestV = v; best = c; } }
  const why = bestV >= 100000 ? 'it found a forced win from here, whatever you play' : bestV <= -100000 ? 'every column loses against best play; this one holds out longest'
    : (() => { const r = rowFor(b, best); b[r * C + best] = 2; const threat = cols.some((c) => rowFor(b, c) >= 0 && tryDrop(c, 2)); b[r * C + best] = 0; return threat ? 'it sets up a three that threatens four' : 'it looked ' + depth + ' moves ahead and this keeps the best position'; })();
  return { col: best, why };
}
