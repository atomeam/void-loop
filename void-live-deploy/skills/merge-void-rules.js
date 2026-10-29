/**
 * merge-void-rules — Merge Verse, Verse's sliding-merge puzzle, in plain JS (no DOM), shared by the card (skills/merge-void.js) and its tests.
 * A 4x4 grid of cards. Slide every card one way; two cards of equal value that meet fuse into one of double value (each card fuses at most once per
 * slide), and after a slide that moved anything a new card of 2 (nine times in ten) or 4 appears in a free cell. Reach TARGET to win; with no slide
 * that changes the grid, you are stuck. The rules are the free mechanic of the sliding-merge genre (domains/void.game-research.md); the name, the
 * target, the cards' look and the words are Verse's own.
 * Player two is Verse: it plays the same seed beside you with a one-move lookahead (empty cells, fusions, the big card kept in a corner) and says why.
 *   create(seed) -> s      move(s, dir) -> s      canMove(s) -> bool      botMove(s) -> { dir, why }      selfPlay(seed) -> { over, score, best, moves }
 */
export const N = 4, TARGET = 1024, DIRS = ['left', 'right', 'up', 'down'];

const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };

function spawn(s) {
  const free = []; for (let i = 0; i < N * N; i++) if (!s.grid[i]) free.push(i);
  if (!free.length) return;
  s.grid[free[Math.floor(rand(s) * free.length)]] = rand(s) < 0.9 ? 2 : 4;
}
export function create(seed = 7) {
  const s = { grid: new Array(N * N).fill(0), score: 0, moves: 0, rng: (seed >>> 0) || 1, over: null, why: '' };
  spawn(s); spawn(s); return s;
}

/** one line slid toward its start: { line, gained, moved, fused }. Each card fuses at most once. Pure. */
export function slideLine(line) {
  const cards = line.filter((v) => v), out = []; let gained = 0, fused = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i] === cards[i + 1]) { const v = cards[i] * 2; out.push(v); gained += v; fused++; i++; } else out.push(cards[i]);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained, moved: out.some((v, i) => v !== line[i]), fused };
}
const lineIdx = (dir, k) => { const r = []; for (let j = 0; j < N; j++) r.push(dir === 'left' ? k * N + j : dir === 'right' ? k * N + (N - 1 - j) : dir === 'up' ? j * N + k : (N - 1 - j) * N + k); return r; };

/** the grid after a slide, without a new card: { grid, gained, moved, fused }. Pure. */
export function slide(grid, dir) {
  const out = grid.slice(); let gained = 0, moved = false, fused = 0;
  for (let k = 0; k < N; k++) {
    const idx = lineIdx(dir, k), r = slideLine(idx.map((i) => grid[i]));
    idx.forEach((i, j) => { out[i] = r.line[j]; }); gained += r.gained; fused += r.fused; if (r.moved) moved = true;
  }
  return { grid: out, gained, moved, fused };
}
export const canMove = (s) => DIRS.some((d) => slide(s.grid, d).moved);
export const best = (s) => Math.max(...s.grid);

/** slide; if anything moved, score it, add a card and check the end. A slide that changes nothing is not a move and adds nothing. */
export function move(s, dir) {
  if (s.over || !DIRS.includes(dir)) return s;
  const r = slide(s.grid, dir); if (!r.moved) return s;
  s.grid = r.grid; s.score += r.gained; s.moves++; spawn(s);
  if (best(s) >= TARGET) s.over = 'win'; else if (!canMove(s)) s.over = 'stuck';
  return s;
}

const corner = (g) => { const m = Math.max(...g); return [0, N - 1, N * (N - 1), N * N - 1].some((i) => g[i] === m); };
/** Verse's pick: a one-move lookahead on what it can see. */
export function botMove(s) {
  if (s.over) return null;
  let pick = null;
  for (const d of DIRS) {
    const r = slide(s.grid, d); if (!r.moved) continue;
    const empty = r.grid.filter((v) => !v).length, big = Math.max(...r.grid);
    let rough = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) rough += Math.abs(Math.log2(r.grid[y * N + x] || 1) - Math.log2(r.grid[y * N + x + 1] || 1));
    const score = r.gained * 1.0 + empty * 12 + (corner(r.grid) ? big * 0.6 : 0) - rough * 4 + r.fused * 6;
    if (!pick || score > pick.score) pick = { dir: d, score, empty, fused: r.fused, corner: corner(r.grid) };
  }
  if (!pick) return null;
  const why = pick.fused ? 'slide ' + pick.dir + ': it fuses ' + pick.fused + ' pair' + (pick.fused === 1 ? '' : 's') + (pick.corner ? ' and keeps the big card in a corner' : '') : 'slide ' + pick.dir + ': no fusion, but it keeps ' + pick.empty + ' cells free';
  return { dir: pick.dir, why };
}
export function apply(s, m) { if (m) { move(s, m.dir); s.why = m.why; } return s; }

/** a whole game by Verse alone, for tests and the self-play arena. */
export function selfPlay(seed, cap = 4000) {
  const s = create(seed); let k = 0;
  while (!s.over && k++ < cap) { const m = botMove(s); if (!m) break; apply(s, m); }
  return { over: s.over, score: s.score, best: best(s), moves: s.moves };
}
