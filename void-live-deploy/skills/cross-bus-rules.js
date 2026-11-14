/**
 * cross-bus-rules — Cross the Bus, a lane crossing, in plain JS (no DOM).
 * You and Verse start at the near curb and cross lanes of moving blocks to the far curb. A block sends you home.
 * Verse steps forward only when the next cell is clear, and steps aside when it is not. The first to the far curb wins.
 * Research: domains/void.game-research.md. The crossing mechanic is free; the famous name and its art are not used.
 */
export const id = 'cross-bus', COLS = 9, ROWS = 8, CELL = 28, W = COLS * CELL, H = ROWS * CELL, CAP = 700;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
export function create(seed = 1) {
  const s = { n: (seed >>> 0) || 1, tick: 0, you: { c: 4, r: 7 }, verse: { c: 4, r: 7 }, lanes: [], over: null, why: '', score: { you: 0, void: 0 }, sfx: 0 };
  for (let r = 1; r <= 6; r++) {
    const cells = [];
    for (let i = 0; i < 12; i++) cells.push(rng(s) < 0.34 ? 1 : 0);
    cells[0] = cells[1] = cells[2] = 0;
    s.lanes[r] = { cells, dir: rng(s) < 0.5 ? 1 : -1, every: r % 2 ? 2 : 3 };
  }
  return s;
}
export function blocked(s, r, c) {
  const lane = s.lanes[r];
  if (!lane || c < 0 || c >= COLS) return true;
  const shift = Math.floor(s.tick / lane.every) % lane.cells.length;
  const i = ((c - shift * lane.dir) % lane.cells.length + lane.cells.length) % lane.cells.length;
  return lane.cells[i] === 1;
}
const home = (a) => { a.c = 4; a.r = 7; };
function move(s, who, dir) {
  const a = s[who];
  let c = a.c, r = a.r;
  if (dir === 'up') r--;
  else if (dir === 'down') r = Math.min(ROWS - 1, r + 1);
  else if (dir === 'left') c = Math.max(0, c - 1);
  else if (dir === 'right') c = Math.min(COLS - 1, c + 1);
  else return;
  if (r < 0) return;
  if (r === 0 || r === ROWS - 1 || !blocked(s, r, c)) { a.c = c; a.r = r; if (r === 0) s.score[who === 'you' ? 'you' : 'void'] = s.tick; }
  else { home(a); s.sfx = 1; }
}
/** Verse's step from the state. It will not step onto a block. */
export function policy(s) {
  const a = s.verse;
  const open = (r, c) => r === 0 || r === ROWS - 1 || (c >= 0 && c < COLS && !blocked(s, r, c));
  if (a.r > 0 && open(a.r - 1, a.c)) return { dir: 'up', why: 'the lane ahead is clear' };
  if (open(a.r, a.c + 1) && a.c < COLS - 1) return { dir: 'right', why: 'stepping aside to find a gap' };
  if (open(a.r, a.c - 1) && a.c > 0) return { dir: 'left', why: 'stepping aside to find a gap' };
  return { dir: '', why: 'waiting for a gap in the lane' };
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  const bot = policy(s); s.why = bot.why;
  const youDir = input.auto ? policy({ ...s, verse: s.you }).dir : (input.step ? input.dir : '');
  move(s, 'you', youDir);
  move(s, 'verse', bot.dir);
  if (s.you.r === 0 || s.verse.r === 0) s.over = s.you.r === 0 && s.verse.r === 0 ? 'draw' : s.you.r === 0 ? 'you' : 'void';
  else if (s.tick >= CAP) s.over = s.you.r < s.verse.r ? 'you' : s.verse.r < s.you.r ? 'void' : 'draw';
  return s;
}
export function selfPlay(seed, cap = CAP) {
  const s = create(seed);
  while (!s.over && s.tick < cap) tick(s, { auto: true });
  return { over: s.over, tick: s.tick, score: { ...s.score } };
}
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = c * CELL, y = r * CELL;
    g.fillStyle = r === 0 || r === ROWS - 1 ? '#161226' : '#100e1c';
    g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    if (blocked(s, r, c)) { g.fillStyle = '#e0b15a'; g.fillRect(x + 4, y + 6, CELL - 8, CELL - 12); }
  }
  const dot = (a, color) => { g.fillStyle = color; g.beginPath(); g.arc(a.c * CELL + CELL / 2, a.r * CELL + CELL / 2, 7, 0, 7); g.fill(); };
  dot(s.verse, '#b79bff'); dot(s.you, '#4fe3e3');
}
export const how = 'Cross to the far curb. Arrow keys or the buttons step one cell, and a block in a lane sends you back to the start. Verse crosses the same lanes and only steps onto a clear cell. The first one to the far curb wins. A link can hand a friend the same lanes.';
