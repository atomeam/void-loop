/**
 * null-sweep-rules — Null Sweep, Verse's mine-clearing puzzle, in plain JS (no DOM), shared by the card (skills/null-sweep.js) and its tests.
 * A grid hides bad commits. Open a cell: a number says how many of its eight neighbours are bad commits; open one and you lose. Flag the ones you
 * know. Clear every safe cell to win. Your first open is always safe (a bad commit under it moves to the first free cell). The rules are the classic
 * mine-clearing rules (mechanics are free: domains/void.board-game-law.md); the name, the words and the look are Verse's own.
 * Player two is Verse: it plays the same seed beside you with a plain logic solver (a number with no bad neighbours left opens the rest, a number
 * with exactly as many hidden neighbours as it needs flags them all) and guesses the safest cell only when logic runs out; each move says why.
 *   create(seed, w?, h?, mines?) -> s      open(s, i) -> s      flag(s, i) -> s      botMove(s) -> { kind, i, why } | null      apply(s, move) -> s
 */
export const W = 9, H = 9, MINES = 10;

const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };

/** a fresh board from a seed: the bad commits are placed now (so two boards with one seed are the same board), nothing is open. */
export function create(seed = 7, w = W, h = H, mines = MINES) {
  const n = w * h, s = { w, h, mines: Math.max(1, Math.min(mines, n - 10)), rng: (seed >>> 0) || 1, mine: new Array(n).fill(0), open: new Array(n).fill(0), flag: new Array(n).fill(0), started: false, over: null, moves: 0, why: '' };
  let placed = 0; while (placed < s.mines) { const i = Math.floor(rand(s) * n); if (!s.mine[i]) { s.mine[i] = 1; placed++; } }
  return s;
}

export const at = (s, x, y) => y * s.w + x;
/** the (up to eight) neighbouring cell indexes. */
export function around(s, i) {
  const x = i % s.w, y = Math.floor(i / s.w), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < s.w && b < s.h) out.push(b * s.w + a); }
  return out;
}
/** how many bad commits touch a cell. */
export const count = (s, i) => around(s, i).reduce((n, j) => n + s.mine[j], 0);

/** the first open is safe: a bad commit under it (or its ring, so the first open is a clearing) moves to the first free cell outside it. */
function safeStart(s, i) {
  const ring = new Set([i, ...around(s, i)]);
  for (const j of ring) {
    if (!s.mine[j]) continue;
    let to = -1; for (let k = 0; k < s.mine.length; k++) if (!s.mine[k] && !ring.has(k)) { to = k; break; }
    if (to >= 0) { s.mine[j] = 0; s.mine[to] = 1; }
  }
}

/** open a cell (and, on a zero, everything the zero uncovers). Opening a flag or an open cell does nothing. */
export function open(s, i) {
  if (s.over || !Number.isInteger(i) || i < 0 || i >= s.mine.length || s.open[i] || s.flag[i]) return s;
  if (!s.started) { s.started = true; safeStart(s, i); }
  s.moves++;
  if (s.mine[i]) { s.open[i] = 1; s.over = 'boom'; s.hit = i; return s; }
  const q = [i];
  while (q.length) {
    const j = q.pop(); if (s.open[j] || s.flag[j] || s.mine[j]) continue;
    s.open[j] = 1;
    if (count(s, j) === 0) for (const k of around(s, j)) if (!s.open[k]) q.push(k);
  }
  if (cleared(s)) s.over = 'win';
  return s;
}
/** flag or unflag a closed cell. */
export function flag(s, i) { if (s.over || !Number.isInteger(i) || i < 0 || i >= s.mine.length || s.open[i]) return s; s.flag[i] = s.flag[i] ? 0 : 1; return s; }
/** the number of cells left to open, and the flags still to place. */
export const safeLeft = (s) => s.mine.length - s.mines - s.open.reduce((a, b) => a + b, 0) + (s.over === 'boom' ? 1 : 0);
export const cleared = (s) => s.open.reduce((a, b) => a + b, 0) === s.mine.length - s.mines;
export const flagsLeft = (s) => s.mines - s.flag.reduce((a, b) => a + b, 0);

/**
 * Verse's next move on a board it can see (the numbers and its own flags only; it never reads s.mine before the board is over).
 * 1. a number whose flags already equal it opens its other closed neighbours; 2. a number whose closed neighbours equal what it still needs flags them;
 * 3. else the closed cell with the lowest chance of a bad commit (the worst number touching it, or the board's density for a cell touching none).
 */
export function botMove(s) {
  if (s.over) return null;
  const n = s.mine.length;
  if (!s.started) return { kind: 'open', i: at(s, Math.floor(s.w / 2), Math.floor(s.h / 2)), why: 'the first open is always safe: the middle' };
  let closed = 0; const chance = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (!s.open[i] && !s.flag[i]) closed++;
  for (let i = 0; i < n; i++) {
    if (!s.open[i]) continue;
    const num = count(s, i), nb = around(s, i), hid = nb.filter((j) => !s.open[j] && !s.flag[j]), fl = nb.filter((j) => s.flag[j]).length, need = num - fl;
    if (!hid.length) continue;
    if (need === 0) return { kind: 'open', i: hid[0], why: 'a ' + num + ' with ' + num + ' flag' + (num === 1 ? '' : 's') + ' beside it: the rest are safe' };
    if (need === hid.length) return { kind: 'flag', i: hid[0], why: 'a ' + num + ' with only ' + hid.length + ' closed cell' + (hid.length === 1 ? '' : 's') + ' to give: they are all bad commits' };
    for (const j of hid) chance[j] = Math.max(chance[j], need / hid.length);
  }
  const left = Math.max(0, s.mines - s.flag.reduce((a, b) => a + b, 0)), density = closed ? left / closed : 1;
  let best = -1, bestP = 2;
  for (let i = 0; i < n; i++) {
    if (s.open[i] || s.flag[i]) continue;
    const p = chance[i] >= 0 ? chance[i] : density;
    if (p < bestP - 1e-9) { bestP = p; best = i; }
  }
  return best < 0 ? null : { kind: 'open', i: best, why: 'no sure move: the safest guess, about ' + Math.round(bestP * 100) + '% a bad commit' };
}
/** play a move from botMove (or a person) on a board. */
export function apply(s, m) { if (!m) return s; if (m.kind === 'flag') flag(s, m.i); else open(s, m.i); s.why = m.why || ''; return s; }

/** a whole game by Verse alone, for tests and for the self-play arena: returns { over, moves }. */
export function selfPlay(seed, w = W, h = H, mines = MINES, cap = 400) {
  const s = create(seed, w, h, mines); let k = 0;
  while (!s.over && k++ < cap) { const m = botMove(s); if (!m) break; apply(s, m); }
  return { over: s.over, moves: s.moves };
}
