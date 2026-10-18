/**
 * snake-rules — Void Snake in plain JS (no DOM), shared by the card (skills/snake.js) and its tests.
 * Two snakes on one grid: you (green) and Verse (violet). Eat orbs to grow; hitting a wall, yourself or the other snake ends
 * you. Verse searches (breadth-first) for the nearest orb it can reach first and only takes a path that leaves it room to
 * move (a flood fill of what is left); with no safe path it takes the roomiest move. Most length when someone crashes wins.
 *   create(seed?) -> s    turn(s, dir) -> s    tick(s) -> s (mutates)    voidDir(s) -> { dir, why }
 */
export const N = 20, START = 4;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const key = (x, y) => y * N + x;
const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };
export function create(seed = 7) {
  const s = { rng: seed >>> 0 || 1, you: { body: [], dir: 'right', alive: true, grow: 0 }, void: { body: [], dir: 'left', alive: true, grow: 0 }, food: null, over: null, ticks: 0, why: '' };
  for (let i = 0; i < START; i++) { s.you.body.push([4 - i, 4]); s.void.body.push([N - 5 + i, N - 5]); }
  placeFood(s); return s;
}
const occupied = (s) => { const o = new Set(); for (const p of [s.you, s.void]) if (p.alive) for (const [x, y] of p.body) o.add(key(x, y)); return o; };
export function placeFood(s) {
  const o = occupied(s); const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!o.has(key(x, y))) free.push([x, y]);
  s.food = free.length ? free[Math.floor(rand(s) * free.length)] : null;
}
export function turn(s, dir) { if (DIRS[dir] && dir !== OPP[s.you.dir]) s.you.next = dir; return s; }
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
function room(s, from, blocked) {
  const seen = new Set([key(...from)]), q = [from]; let n = 0;
  while (q.length && n < 200) { const [x, y] = q.shift(); n++; for (const [dx, dy] of Object.values(DIRS)) { const a = x + dx, b = y + dy, k = key(a, b); if (inside(a, b) && !blocked.has(k) && !seen.has(k)) { seen.add(k); q.push([a, b]); } } }
  return n;
}
export function voidDir(s) {
  const me = s.void, [hx, hy] = me.body[0], blocked = occupied(s);
  const tail = me.body[me.body.length - 1]; if (!me.grow) blocked.delete(key(...tail));
  const yh = s.you.alive ? s.you.body[0] : null;
  const opts = Object.keys(DIRS).filter((d) => d !== OPP[me.dir]).map((d) => { const [dx, dy] = DIRS[d]; return { d, p: [hx + dx, hy + dy] }; })
    .filter(({ p }) => inside(...p) && !blocked.has(key(...p)));
  if (!opts.length) return { dir: me.dir, why: 'boxed in' };
  const need = me.body.length;
  // breadth-first from each first step to the orb, keeping only steps that leave room
  if (s.food) {
    let best = null;
    for (const o of opts) {
      const b2 = new Set(blocked); b2.add(key(...o.p)); const r = room(s, o.p, b2);
      if (r < need) continue;
      const dist = bfs(o.p, s.food, blocked);
      if (dist < 0) continue;
      const theirs = yh ? Math.abs(yh[0] - s.food[0]) + Math.abs(yh[1] - s.food[1]) : 99;
      const score = dist + (theirs < dist ? 6 : 0);
      if (!best || score < best.score) best = { ...o, score, dist, theirs };
    }
    if (best) return { dir: best.d, why: best.theirs < best.dist ? 'heading for the orb, though you are closer' : 'shortest safe path to the orb (' + (best.dist + 1) + ' moves)' };
  }
  let roomiest = null;
  for (const o of opts) { const b2 = new Set(blocked); b2.add(key(...o.p)); const r = room(s, o.p, b2); if (!roomiest || r > roomiest.r) roomiest = { ...o, r }; }
  return { dir: roomiest.d, why: 'no safe path to the orb: keeping the most room (' + roomiest.r + ' cells)' };
}
function bfs(from, to, blocked) {
  const seen = new Set([key(...from)]); let q = [from], d = 0;
  while (q.length) { const nq = []; for (const [x, y] of q) { if (x === to[0] && y === to[1]) return d; for (const [dx, dy] of Object.values(DIRS)) { const a = x + dx, b = y + dy, k = key(a, b); if (inside(a, b) && !blocked.has(k) && !seen.has(k)) { seen.add(k); nq.push([a, b]); } } } q = nq; d++; }
  return -1;
}
export function tick(s) {
  if (s.over) return s;
  s.ticks++;
  if (s.you.next) { s.you.dir = s.you.next; s.you.next = null; }
  if (s.void.alive) { const v = voidDir(s); s.void.dir = v.dir; s.why = v.why; }
  const heads = {};
  for (const w of ['you', 'void']) { const p = s[w]; if (!p.alive) continue; const [dx, dy] = DIRS[p.dir]; heads[w] = [p.body[0][0] + dx, p.body[0][1] + dy]; }
  const o = new Set(); for (const w of ['you', 'void']) { const p = s[w]; if (!p.alive) continue; const n = p.grow ? p.body.length : p.body.length - 1; for (let i = 0; i < n; i++) o.add(key(...p.body[i])); }
  const dead = {};
  for (const w of Object.keys(heads)) { const h = heads[w]; if (!inside(...h) || o.has(key(...h))) dead[w] = true; }
  if (heads.you && heads.void && key(...heads.you) === key(...heads.void)) { dead.you = dead.void = true; }
  for (const w of Object.keys(heads)) {
    const p = s[w]; if (dead[w]) { p.alive = false; continue; }
    p.body.unshift(heads[w]); if (p.grow) p.grow--; else p.body.pop();
    if (s.food && heads[w][0] === s.food[0] && heads[w][1] === s.food[1]) { p.grow += 2; placeFood(s); }
  }
  if (!s.you.alive || !s.void.alive) {
    const a = s.you.alive ? s.you.body.length + 100 : s.you.body.length, b = s.void.alive ? s.void.body.length + 100 : s.void.body.length;
    s.over = !s.you.alive && !s.void.alive ? (s.you.body.length > s.void.body.length ? 'you' : s.you.body.length < s.void.body.length ? 'void' : 'draw') : a > b ? 'you' : 'void';
  }
  return s;
}
