/** Stackwell: two wells, original small pieces (a bar of three, a domino, a square, a hook). Never the famous seven. */
export const id = 'stackwell', COLS = 6, ROWS = 12, CELL = 12, W = 6 * 12 * 2 + 16, H = 12 * 12 + 8, CAP = 800;
const SHAPES = [
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1]],
];
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
function spawn(s, seat) {
  const cells = SHAPES[Math.floor(rng(s) * SHAPES.length)].map(([x, y]) => [x, y]);
  s.piece[seat] = { cells, x: 1, y: 0 };
}
export function create(seed = 1) {
  const s = { n: (seed >>> 0) || 1, tick: 0, board: { you: empty(), void: empty() }, piece: {}, lines: { you: 0, void: 0 }, over: null, why: '', score: { you: 0, void: 0 }, sfx: 0, pad: 0 };
  spawn(s, 'you'); spawn(s, 'void');
  return s;
}
function fits(board, piece, x, y) {
  return piece.cells.every(([dx, dy]) => { const c = x + dx, r = y + dy; return c >= 0 && c < COLS && r < ROWS && (r < 0 || !board[r][c]); });
}
function lock(s, seat) {
  const p = s.piece[seat], b = s.board[seat];
  for (const [dx, dy] of p.cells) { const r = p.y + dy, c = p.x + dx; if (r < 0) { s.over = seat === 'you' ? 'void' : 'you'; return; } b[r][c] = 1; }
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) if (b[r].every(Boolean)) { b.splice(r, 1); b.unshift(Array(COLS).fill(0)); cleared++; r++; }
  s.lines[seat] += cleared; s.score[seat] += cleared * 10; if (cleared) s.sfx = 1;
  spawn(s, seat);
}
function fall(s, seat) {
  const p = s.piece[seat];
  if (fits(s.board[seat], p, p.x, p.y + 1)) p.y++;
  else lock(s, seat);
}
function nudge(s, seat, dir) {
  const p = s.piece[seat];
  const x = p.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0);
  if (fits(s.board[seat], p, x, p.y)) p.x = x;
}
function aim(s, seat) {
  const p = s.piece[seat];
  let best = p.x, room = -1;
  for (let x = 0; x < COLS; x++) if (fits(s.board[seat], p, x, 0)) {
    const top = s.board[seat].findIndex((row) => row[x]);
    const space = top < 0 ? ROWS : top;
    if (space > room) { room = space; best = x; }
  }
  return best < p.x ? 'left' : best > p.x ? 'right' : '';
}
export function policy(s) { return { dir: 'left', why: 'stacking everything on the left' }; }
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  s.why = policy(s).why;
  if (s.pad > 0) s.pad--;
  else if (input.left || input.right) { nudge(s, 'you', input.left ? 'left' : 'right'); s.pad = 4; }
  if (input.auto) nudge(s, 'you', aim(s, 'you'));
  nudge(s, 'void', 'left');
  if (s.tick % 8 === 0) { fall(s, 'you'); if (!s.over) fall(s, 'void'); }
  if (!s.over && (s.lines.you + s.lines.void >= 4 || s.tick >= CAP)) s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
function paint(g, board, piece, ox) {
  g.fillStyle = '#12101c'; g.fillRect(ox, 4, COLS * CELL, ROWS * CELL);
  g.fillStyle = '#4fe3e3';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) g.fillRect(ox + c * CELL + 1, 4 + r * CELL + 1, CELL - 2, CELL - 2);
  if (piece) { g.fillStyle = '#b79bff'; for (const [dx, dy] of piece.cells) g.fillRect(ox + (piece.x + dx) * CELL + 1, 4 + (piece.y + dy) * CELL + 1, CELL - 2, CELL - 2); }
}
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  paint(g, s.board.void, s.piece.void, 4);
  paint(g, s.board.you, s.piece.you, COLS * CELL + 12);
}
export const how = 'The right well is yours. Move a piece with the arrows. It falls on its own. Verse fills the left well with the same kinds of piece and aims for the lowest column. Pieces are a short bar, a domino, a square and a hook. A full row clears. The higher line score wins. A link hands a friend the same pieces.';
