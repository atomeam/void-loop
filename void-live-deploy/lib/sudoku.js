/**
 * sudoku: /games/sudoku/'s puzzles, made on the device (owner, 2026-10-26: the games lane, a page per site). A full grid is filled at random from a
 * seed, then numbers are taken away one at a time as long as the puzzle keeps exactly one solution. Easy and medium puzzles are solvable by singles
 * alone (a square where one number fits, or a number with one place in a row, column or box); hard and evil need more and have fewer clues.
 * A grid is 81 numbers, 0 for empty, row by row. Pure (the seed is the only chance).
 *   generate(seed, level) -> { puzzle, solution, clues }   solve(grid) -> grid | null   countSolutions(grid, cap)   hint(grid, solution) -> { i, n, why }
 *   conflicts(grid) -> Set of indexes   LEVELS
 */
export const LEVELS = Object.freeze({ easy: { clues: 40, singles: true }, medium: { clues: 33, singles: true }, hard: { clues: 28, singles: false }, evil: { clues: 22, singles: false } });
const ROW = (i) => Math.floor(i / 9), COL = (i) => i % 9, BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
export const PEERS = Array.from({ length: 81 }, (_, i) => { const s = new Set(); for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j); return [...s]; });
const UNITS = [...Array(9)].flatMap((_, k) => [[...Array(9)].map((__, j) => k * 9 + j), [...Array(9)].map((__, j) => j * 9 + k), [...Array(9)].map((__, j) => (Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3))]);
const UNIT_NAME = (u) => { const k = Math.floor(u / 3), t = u % 3; return t === 0 ? 'row ' + (k + 1) : t === 1 ? 'column ' + (k + 1) : 'box ' + (k + 1); };
const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** the numbers that can go in square i. */
export const candidates = (g, i) => { if (g[i]) return []; const used = new Set(PEERS[i].map((j) => g[j])); return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n)); };
/** how many solutions a grid has, counting no further than `cap`. */
export function countSolutions(grid, cap = 2) {
  const g = grid.slice(); let n = 0;
  const go = () => { let best = -1, bc = null; for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i); if (!c.length) return; if (!bc || c.length < bc.length) { best = i; bc = c; if (c.length === 1) break; } }
    if (best < 0) { n++; return; } for (const v of bc) { g[best] = v; go(); if (n >= cap) break; } g[best] = 0; };
  go(); return n;
}
export function solve(grid, r = null) {
  const g = grid.slice(); let done = false;
  const go = () => { let best = -1, bc = null; for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i); if (!c.length) return; if (!bc || c.length < bc.length) { best = i; bc = c; } }
    if (best < 0) { done = true; return; } for (const v of r ? shuffle(bc.slice(), r) : bc) { g[best] = v; go(); if (done) return; } g[best] = 0; };
  go(); return done ? g : null;
}
/** the next square singles alone can fill: { i, n, why } (a square where one number fits, else a number with one place in a unit), or null. */
export function single(g) {
  for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i); if (c.length === 1) return { i, n: c[0], why: 'only ' + c[0] + ' fits here: its row, column and box already hold every other number' }; }
  for (let u = 0; u < UNITS.length; u++) for (let n = 1; n <= 9; n++) { if (UNITS[u].some((i) => g[i] === n)) continue; const spots = UNITS[u].filter((i) => !g[i] && candidates(g, i).includes(n)); if (spots.length === 1) return { i: spots[0], n, why: 'in ' + UNIT_NAME(u) + ', ' + n + ' can go only here' }; }
  return null;
}
const singlesSolve = (grid) => { const g = grid.slice(); for (;;) { const s = single(g); if (!s) break; g[s.i] = s.n; } return g.every(Boolean); };
/** a puzzle from a seed and a level: { puzzle, solution, clues, level, seed }. Deterministic. */
export function generate(seed = 1, level = 'medium') {
  const L = LEVELS[level] || LEVELS.medium, r = rngOf(seed * 7919 + level.length);
  const solution = solve(Array(81).fill(0), r), puzzle = solution.slice();
  for (const i of shuffle([...Array(81).keys()], r)) {
    if (puzzle.filter(Boolean).length <= L.clues) break;
    const keep = puzzle[i]; puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1 || (L.singles && !singlesSolve(puzzle))) puzzle[i] = keep;
  }
  return { puzzle, solution, clues: puzzle.filter(Boolean).length, level, seed };
}
/** a hint for a grid in play: a wrong number first, else the next single with its reason, else the answer of the square with fewest choices. */
export function hint(g, solution) {
  for (let i = 0; i < 81; i++) if (g[i] && g[i] !== solution[i]) return { i, n: solution[i], why: 'this square is wrong: it should be ' + solution[i], wrong: true };
  const s = single(g); if (s) return s;
  let best = -1, bc = 10; for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i).length; if (c < bc) { bc = c; best = i; } }
  return best < 0 ? null : { i: best, n: solution[best], why: 'no single is left: of the ' + bc + ' numbers that fit here, the answer is ' + solution[best] };
}
/** the squares whose number clashes with a peer's. */
export function conflicts(g) { const out = new Set(); for (let i = 0; i < 81; i++) if (g[i]) for (const j of PEERS[i]) if (g[j] === g[i]) { out.add(i); out.add(j); } return out; }
