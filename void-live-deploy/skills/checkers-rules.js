/**
 * checkers-rules — American checkers (English draughts) in plain JS, shared by the checkers card and its tests.
 * Squares 0..63 = row * 8 + col, row 0 nearest you. Only dark squares ((row + col) even) are used.
 * Pieces: 'd' your man (dark, moves up), 'D' your king, 'l' Void's man (light, moves down), 'L' Void's king.
 *   create() / fromRows(rows, turn) / legalMoves(s) -> [{ from, path: [sq...], captures: [sq...], crown }]
 *   play(s, move | [from, to, to...]) -> new position   status(s) -> 'playing' | 'dark-wins' | 'light-wins' | 'draw'
 *   bestMove(s, { depth, ms }) -> move
 * Rules: dark moves first; men move diagonally forward, kings one square in any diagonal direction; a capture is forced
 * when one exists; a capturing piece keeps jumping while it can (any full sequence may be chosen); a man that reaches
 * the far row is crowned and its move ends there; a side with no move loses; 40 moves each without a capture or a man's
 * move is a draw.
 */
export const DARK = 'd', LIGHT = 'l';
const own = (p, side) => !!p && p.toLowerCase() === side;
const isKing = (p) => p === 'D' || p === 'L';
export const playable = (sq) => (((sq >> 3) + (sq & 7)) & 1) === 0;
export function create() {
  const board = Array(64).fill(null);
  for (let sq = 0; sq < 64; sq++) if (playable(sq)) { const r = sq >> 3; if (r <= 2) board[sq] = 'd'; else if (r >= 5) board[sq] = 'l'; }
  return { board, turn: DARK, quiet: 0 };
}
/** A position from 8 strings, top row (row 7) first: '.' empty, d D l L. */
export function fromRows(rows, turn = DARK) {
  const board = Array(64).fill(null);
  rows.forEach((row, i) => { const r = 7 - i; [...row].forEach((ch, c) => { if ('dDlL'.includes(ch)) board[r * 8 + c] = ch; }); });
  return { board, turn, quiet: 0 };
}
const dirsFor = (p) => (isKing(p) ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : p === 'd' ? [[1, 1], [1, -1]] : [[-1, 1], [-1, -1]]);
const crownRow = (p) => (p === 'd' ? 7 : p === 'l' ? 0 : -1);
function jumpsFrom(board, sq, p, path, caps, out) {
  const r = sq >> 3, c = sq & 7, them = p.toLowerCase() === 'd' ? 'l' : 'd'; let found = false;
  for (const [dr, dc] of dirsFor(p)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
    const mid = mr * 8 + mc, land = lr * 8 + lc;
    if (!own(board[mid], them) || board[land] || caps.includes(mid)) continue;
    found = true;
    const crowned = !isKing(p) && lr === crownRow(p);
    if (crowned) { out.push({ path: path.concat(land), captures: caps.concat(mid), crown: true }); continue; } // crowning ends the move
    const b2 = board.slice(); b2[sq] = null; b2[land] = p;
    jumpsFrom(b2, land, p, path.concat(land), caps.concat(mid), out);
  }
  if (!found && caps.length) out.push({ path, captures: caps, crown: false });
}
export function legalMoves(s) {
  const jumps = [], steps = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq]; if (!own(p, s.turn)) continue;
    const js = []; jumpsFrom(s.board, sq, p, [], [], js); for (const j of js) jumps.push({ from: sq, ...j });
    if (jumps.length) continue;
    const r = sq >> 3, c = sq & 7;
    for (const [dr, dc] of dirsFor(p)) { const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const to = rr * 8 + cc;
      if (!s.board[to]) steps.push({ from: sq, path: [to], captures: [], crown: !isKing(p) && rr === crownRow(p) }); }
  }
  return jumps.length ? jumps : steps;
}
export function apply(s, m) {
  const b = s.board.slice(), p = b[m.from], to = m.path[m.path.length - 1];
  b[m.from] = null; for (const c of m.captures) b[c] = null; b[to] = m.crown ? p.toUpperCase() : p;
  return { board: b, turn: s.turn === DARK ? LIGHT : DARK, quiet: m.captures.length || !isKing(p) ? 0 : s.quiet + 1, last: m };
}
/** Play a move object, or squares [from, landing, landing...] as the visitor tapped them. Throws if illegal. */
export function play(s, mv) {
  const ms = legalMoves(s);
  const m = Array.isArray(mv) ? ms.find((x) => x.from === mv[0] && x.path.length === mv.length - 1 && x.path.every((q, i) => q === mv[i + 1]))
    : ms.find((x) => x.from === mv.from && x.path.join() === mv.path.join());
  if (!m) throw new Error('illegal move');
  return apply(s, m);
}
export function status(s) {
  if (!legalMoves(s).length) return s.turn === DARK ? 'light-wins' : 'dark-wins';
  if (s.quiet >= 80) return 'draw';
  return 'playing';
}
export const count = (s) => { const n = { d: 0, D: 0, l: 0, L: 0 }; for (const p of s.board) if (p) n[p]++; return n; };

function evaluate(s) { // from the side to move
  let v = 0;
  for (let sq = 0; sq < 64; sq++) { const p = s.board[sq]; if (!p) continue; const r = sq >> 3, c = sq & 7;
    let x = isKing(p) ? 165 : 100 + (p === 'd' ? r : 7 - r) * 4; // men gain as they advance
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) x += 6; // the centre
    if (!isKing(p) && ((p === 'd' && r === 0) || (p === 'l' && r === 7))) x += 8; // the back row guards the crown
    v += p.toLowerCase() === 'd' ? x : -x; }
  return s.turn === DARK ? v : -v;
}
export function bestMove(s, { depth = 7, ms = 600, rng = Math.random } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  const out = () => { if ((++nodes & 511) === 0 && Date.now() - t0 > ms) stop = true; return stop; };
  function nega(p, d, a, b, ply) {
    if (out()) return 0;
    const ms2 = legalMoves(p); if (!ms2.length) return -10000 + ply;
    if (d <= 0 && !ms2[0].captures.length) return evaluate(p); // keep searching while captures are forced
    if (d <= -6) return evaluate(p);
    for (const m of ms2) { const v = -nega(apply(p, m), d - 1, -b, -a, ply + 1); if (stop) return 0; if (v >= b) return b; if (v > a) a = v; }
    return a;
  }
  const root = legalMoves(s); if (!root.length) return null;
  let best = root[0];
  for (let d = 1; d <= depth && !stop; d++) {
    let bv = -Infinity, bm = null, ties = [];
    for (const m of root) { const v = -nega(apply(s, m), d - 1, -Infinity, -bv + 1, 1); if (stop) break; if (v > bv) { bv = v; bm = m; ties = [m]; } else if (v === bv) ties.push(m); }
    if (!stop && bm) { best = ties.length > 1 && d === depth ? ties[Math.floor(rng() * ties.length)] : bm; root.splice(root.indexOf(bm), 1); root.unshift(bm); }
  }
  return best;
}
