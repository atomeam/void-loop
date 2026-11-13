/** Push Packets: slide one packet onto its mark. Verse tugs the same pusher the wrong way and usually jams. */
export const id = 'push-packets', CELL = 28, W = 6 * 28, H = 4 * 28, CAP = 80;
const LEVELS = [
  ['######', '#@$. #', '#    #', '######'],
  ['######', '#@ $.#', '#    #', '######'],
  ['######', '#@   #', '# $ .#', '######'],
];
const SOLVE = ['r', 'rr', 'drr'];
export function create(seed = 1) {
  const level = ((seed >>> 0) || 1) % LEVELS.length;
  const grid = LEVELS[level].map((row) => row.split(''));
  let you = { r: 1, c: 1 }, box = { r: 1, c: 2 }, goal = { r: 1, c: 3 };
  grid.forEach((row, r) => row.forEach((ch, c) => {
    if (ch === '@') { you = { r, c }; grid[r][c] = ' '; }
    if (ch === '$') { box = { r, c }; grid[r][c] = ' '; }
    if (ch === '.') { goal = { r, c }; grid[r][c] = ' '; }
  }));
  return { tick: 0, level, grid, you, box, goal, plan: 0, over: null, why: 'watching the packet', score: { you: 0, void: 0 }, sfx: 0 };
}
const D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1], u: [-1, 0], d: [1, 0], l: [0, -1], r: [0, 1] };
function move(s, who, dir) {
  const d = D[dir]; if (!d) return;
  const nr = s.you.r + d[0], nc = s.you.c + d[1];
  if (s.grid[nr]?.[nc] !== ' ') return;
  if (nr === s.box.r && nc === s.box.c) {
    const br = nr + d[0], bc = nc + d[1];
    if (s.grid[br]?.[bc] !== ' ') return;
    s.box = { r: br, c: bc }; s.sfx = 1;
  }
  s.you = { r: nr, c: nc };
  if (s.box.r === s.goal.r && s.box.c === s.goal.c) { s.over = who === 'you' ? 'you' : 'void'; s.score[who === 'you' ? 'you' : 'void'] = 1; }
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  if (input.auto) { move(s, 'you', SOLVE[s.level][s.plan++] || ''); s.why = 'the short way is yours'; }
  else if (input.step) { move(s, 'you', input.dir); s.why = 'your push'; }
  if (!s.over && s.tick % 4 === 0) move(s, 'void', 'left');
  if (!s.over && s.tick >= CAP) s.over = 'draw';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  s.grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === '#') { g.fillStyle = '#2a2148'; g.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1); } }));
  g.fillStyle = '#3a2a18'; g.fillRect(s.goal.c * CELL + 8, s.goal.r * CELL + 8, CELL - 16, CELL - 16);
  g.fillStyle = '#e0b15a'; g.fillRect(s.box.c * CELL + 5, s.box.r * CELL + 5, CELL - 10, CELL - 10);
  g.fillStyle = '#4fe3e3'; g.beginPath(); g.arc(s.you.c * CELL + CELL / 2, s.you.r * CELL + CELL / 2, 8, 0, 7); g.fill();
}
export const how = 'Step with the arrows. You push the packet one square and cannot pull it, and a wall stops you both. Verse tugs left and often jams the packet. Park it on the dark mark. A link hands a friend the same room.';
