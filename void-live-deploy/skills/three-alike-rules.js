/** Three Alike: swap two neighbours. Three or more of a kind clear. Verse takes the swap that clears the least. */
export const id = 'three-alike', N = 6, CELL = 26, W = 6 * 26, H = 6 * 26, CAP = 40;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
export function create(seed = 1) {
  const s = { n: (seed >>> 0) || 1, tick: 0, grid: [], cursor: 0, turns: 0, over: null, why: '', score: { you: 0, void: 0 }, sfx: 0 };
  for (let i = 0; i < N * N; i++) s.grid.push(1 + Math.floor(rng(s) * 4));
  return s;
}
function clears(g) {
  const hit = new Set();
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 2; c++) {
    const i = r * N + c; if (g[i] && g[i] === g[i + 1] && g[i] === g[i + 2]) { hit.add(i); hit.add(i + 1); hit.add(i + 2); }
  }
  for (let c = 0; c < N; c++) for (let r = 0; r < N - 2; r++) {
    const i = r * N + c; if (g[i] && g[i] === g[i + N] && g[i] === g[i + 2 * N]) { hit.add(i); hit.add(i + N); hit.add(i + 2 * N); }
  }
  return [...hit];
}
function refill(s) {
  for (let c = 0; c < N; c++) {
    const col = [];
    for (let r = N - 1; r >= 0; r--) if (s.grid[r * N + c]) col.push(s.grid[r * N + c]);
    for (let r = N - 1; r >= 0; r--) s.grid[r * N + c] = col[N - 1 - r] || (1 + Math.floor(rng(s) * 4));
  }
}
function resolve(s, who) {
  let n = 0;
  for (let k = 0; k < 3; k++) {
    const hit = clears(s.grid); if (!hit.length) break;
    n += hit.length; for (const i of hit) s.grid[i] = 0; refill(s); s.sfx = 1;
  }
  s.score[who] += n;
}
function swap(g, a, b) { const t = g[a]; g[a] = g[b]; g[b] = t; }
function neighbours(i) {
  const r = Math.floor(i / N), c = i % N, o = [];
  if (c + 1 < N) o.push(i + 1); if (r + 1 < N) o.push(i + N); if (c > 0) o.push(i - 1); if (r > 0) o.push(i - N);
  return o;
}
function best(s, want) {
  let pick = null, score = want === 'most' ? -1 : 99;
  for (let i = 0; i < N * N; i++) for (const j of neighbours(i)) if (j > i) {
    swap(s.grid, i, j); const n = clears(s.grid).length; swap(s.grid, i, j);
    if (want === 'most' ? n > score : n < score) { score = n; pick = [i, j]; }
  }
  return pick;
}
function play(s, pair, who) { if (!pair) return; swap(s.grid, pair[0], pair[1]); resolve(s, who); }
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  let acted = false;
  if (input.auto) { play(s, best(s, 'most'), 'you'); s.turns++; acted = true; }
  else if (input.step && input.dir) {
    const d = { left: -1, right: 1, up: -N, down: N }[input.dir] || 0;
    const next = s.cursor + d;
    const straight = next >= 0 && next < N * N && Math.abs((s.cursor % N) - (next % N)) + Math.abs(Math.floor(s.cursor / N) - Math.floor(next / N)) === 1;
    if (straight) { swap(s.grid, s.cursor, next); resolve(s, 'you'); s.cursor = next; s.turns++; acted = true; }
  }
  if (acted) { play(s, best(s, 'least'), 'void'); s.why = 'taking the swap that clears the least'; }
  if (s.turns >= 6) s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
const INK = ['#12101c', '#4fe3e3', '#b79bff', '#e0b15a', '#f4f1ea'];
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N;
    g.fillStyle = INK[s.grid[i]] || INK[1]; g.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
    if (i === s.cursor) { g.strokeStyle = '#f4f1ea'; g.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); }
  }
}
export const how = 'Move onto a neighbour with the arrows to swap the two cells. Three alike in a line clear and the column drops. Verse answers with the swap that clears the least. After six of your swaps, the higher score wins. A link hands a friend the same board.';
