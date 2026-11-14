/** Packet Maze: collect packets in a walled grid. Verse moves half as often and hunts the nearest packet. */
export const id = 'packet-maze', N = 11, CELL = 18, W = 11 * 18, H = 11 * 18, CAP = 500;
const wall = (r, c) => r === 0 || c === 0 || r === 10 || c === 10 || (c === 5 && r % 2 === 0);
export function create(seed = 1) {
  const pk = [];
  for (let r = 1; r < 10; r++) for (let c = 1; c < 10; c++) if (!wall(r, c) && !(r === 9 && c === 1) && !(r === 9 && c === 9)) pk.push(r * N + c);
  return { tick: 0, you: { r: 9, c: 1 }, verse: { r: 9, c: 9 }, pk, over: null, why: '', score: { you: 0, void: 0 }, sfx: 0, n: (seed >>> 0) || 1 };
}
const open = (r, c) => r >= 0 && c >= 0 && r < 11 && c < 11 && !wall(r, c);
function step(s, who, dir) {
  const a = s[who]; let r = a.r, c = a.c;
  if (dir === 'up') r--; else if (dir === 'down') r++; else if (dir === 'left') c--; else if (dir === 'right') c++; else return;
  if (!open(r, c)) return;
  a.r = r; a.c = c;
  const k = s.pk.indexOf(r * N + c);
  if (k >= 0) { s.pk.splice(k, 1); s.score[who === 'you' ? 'you' : 'void']++; s.sfx = 1; }
}
export function policy(s, who) {
  const a = s[who];
  let best = null, bd = 99;
  for (const p of s.pk) { const r = Math.floor(p / N), c = p % N, d = Math.abs(r - a.r) + Math.abs(c - a.c); if (d < bd) { bd = d; best = { r, c }; } }
  if (!best) return { dir: '', why: 'the packets are gone' };
  const opts = [['up', -1, 0], ['down', 1, 0], ['left', 0, -1], ['right', 0, 1]];
  let pick = '', pd = 99;
  for (const [dir, dr, dc] of opts) if (open(a.r + dr, a.c + dc)) { const d = Math.abs(best.r - (a.r + dr)) + Math.abs(best.c - (a.c + dc)); if (d < pd) { pd = d; pick = dir; } }
  return { dir: pick, why: 'heading for the nearest packet' };
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  const you = input.auto ? policy(s, 'you').dir : (input.step ? input.dir : '');
  step(s, 'you', you);
  if (s.tick % 2 === 0) { const b = policy(s, 'verse'); s.why = b.why; step(s, 'verse', b.dir); }
  if (!s.pk.length || s.tick >= CAP) s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (wall(r, c)) { g.fillStyle = '#2a2148'; g.fillRect(c * CELL, r * CELL, CELL, CELL); }
  }
  g.fillStyle = '#e0b15a';
  for (const p of s.pk) g.fillRect((p % N) * CELL + 7, Math.floor(p / N) * CELL + 7, 4, 4);
  const dot = (a, color) => { g.fillStyle = color; g.beginPath(); g.arc(a.c * CELL + CELL / 2, a.r * CELL + CELL / 2, 6, 0, 7); g.fill(); };
  dot(s.verse, '#b79bff'); dot(s.you, '#4fe3e3');
}
export const how = 'Step through the maze with the arrows and take the packets. Verse hunts them too, but only moves on every other step. Whoever holds more when the maze is empty wins. A link hands a friend the same maze.';
