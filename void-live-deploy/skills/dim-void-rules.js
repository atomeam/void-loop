/**
 * dim-void-rules — Dim the Void, Verse's lights-out puzzle, in plain JS (no DOM), shared by the card (skills/dim-void.js) and its tests.
 * A grid of lamps, some lit. Pressing a lamp flips it and the four lamps beside it (up, down, left, right). Put every lamp out. Pressing is linear
 * over GF(2), so a board is solved by elimination and a board made by pressing from all-dark is always solvable (domains/void.game-research.md).
 * The rules are the free mechanic of the lights-out genre; the name, the look and the words are Verse's own.
 * Player two is Verse: it solves the same board with the shortest set of presses (the best of every solution elimination finds), plays them one by one
 * beside you, and that count is the par your presses are measured against.
 *   create(seed, n?) -> s      press(s, i) -> s      solve(lights, n) -> [press indexes] | null      botMove(s) -> { i, why } | null
 */
export const N = 5;

const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };

/** the lamps a press at i flips: i and its up, down, left and right neighbours that exist. Pure. */
export function reach(i, n) {
  const x = i % n, y = Math.floor(i / n), out = [i];
  if (x > 0) out.push(i - 1); if (x < n - 1) out.push(i + 1); if (y > 0) out.push(i - n); if (y < n - 1) out.push(i + n);
  return out;
}

/**
 * The shortest set of presses that puts every lamp out, or null if the board cannot be solved. Gaussian elimination over GF(2) on a bitmask per lamp
 * (variables 0..n*n-1, the lamp's own state in the next bit), the null space from the free columns, and the lightest of every combination of it. Pure.
 */
export function solve(lights, n = N) {
  const m = n * n, rows = [];
  for (let i = 0; i < m; i++) rows.push(0);
  for (let j = 0; j < m; j++) for (const i of reach(j, n)) rows[i] |= 1 << j; // pressing j flips lamp i: column j of the matrix
  for (let i = 0; i < m; i++) if (lights[i]) rows[i] |= 1 << m;
  const pivot = []; let r = 0;
  for (let c = 0; c < m && r < m; c++) {
    let p = -1; for (let i = r; i < m; i++) if (rows[i] & (1 << c)) { p = i; break; }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < m; i++) if (i !== r && (rows[i] & (1 << c))) rows[i] ^= rows[r];
    pivot[r] = c; r++;
  }
  for (let i = r; i < m; i++) if (rows[i] & (1 << m)) return null; // 0 = 1: no solution
  const isPivot = new Set(pivot), free = []; for (let c = 0; c < m; c++) if (!isPivot.has(c)) free.push(c);
  const base = new Array(m).fill(0); for (let i = 0; i < r; i++) base[pivot[i]] = (rows[i] >> m) & 1;
  const nulls = free.map((f) => { const v = new Array(m).fill(0); v[f] = 1; for (let i = 0; i < r; i++) if (rows[i] & (1 << f)) v[pivot[i]] ^= 1; return v; });
  let best = null;
  for (let mask = 0; mask < (1 << nulls.length); mask++) {
    const x = base.slice(); nulls.forEach((v, k) => { if (mask & (1 << k)) for (let i = 0; i < m; i++) x[i] ^= v[i]; });
    const w = x.reduce((a, b) => a + b, 0); if (!best || w < best.w) best = { w, x };
  }
  return best.x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
}

/** a board from a seed: all lamps dark, then a seeded handful of presses, so it is solvable; never already dark. */
export function create(seed = 7, n = N) {
  const s = { n, lights: new Array(n * n).fill(0), presses: 0, rng: (seed >>> 0) || 1, over: null, why: '' };
  let guard = 0;
  do {
    s.lights.fill(0);
    const k = 5 + Math.floor(rand(s) * 8);
    for (let t = 0; t < k; t++) for (const i of reach(Math.floor(rand(s) * n * n), n)) s.lights[i] ^= 1;
  } while (!s.lights.some(Boolean) && ++guard < 50);
  s.par = solve(s.lights, n).length;
  return s;
}

/** press a lamp; the game is won when every lamp is out. */
export function press(s, i) {
  if (s.over || !Number.isInteger(i) || i < 0 || i >= s.lights.length) return s;
  for (const j of reach(i, s.n)) s.lights[j] ^= 1;
  s.presses++;
  if (!s.lights.some(Boolean)) s.over = 'win';
  return s;
}

/** Verse's next press: the first of the shortest solution of the board as it stands, with the reason. */
export function botMove(s) {
  if (s.over) return null;
  const sol = solve(s.lights, s.n); if (!sol || !sol.length) return null;
  return { i: sol[0], why: 'press ' + (Math.floor(sol[0] / s.n) + 1) + ',' + ((sol[0] % s.n) + 1) + ': it is one of the ' + sol.length + ' presses that put every lamp out' };
}
export function apply(s, m) { if (m) { press(s, m.i); s.why = m.why; } return s; }

/** a whole board by Verse alone: { over, presses, par }. */
export function selfPlay(seed, n = N) {
  const s = create(seed, n); let k = 0;
  while (!s.over && k++ < n * n * 2) { const m = botMove(s); if (!m) break; apply(s, m); }
  return { over: s.over, presses: s.presses, par: s.par };
}
