/** Null Waves: a block of plain rectangles steps down. Verse drops a request toward your column. */
export const id = 'null-waves', COLS = 6, ROWS = 2, CELL = 22, W = 220, H = 240, CAP = 2400;
export function create(seed = 1) {
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push(1);
  return { tick: 0, cells, ox: 16, oy: 28, dir: 1, you: 3, bullet: null, drop: null, over: null, why: '', score: { you: 0, void: 0 }, sfx: 0, cool: 0, pad: 0, n: (seed >>> 0) || 1 };
}
const colX = (s, c) => s.ox + c * (CELL + 4) + CELL / 2;
const rowY = (s, r) => s.oy + r * (CELL + 6) + CELL / 2;
export function policy(s) {
  if (s.drop) return { drop: -1, why: 'a request is already falling' };
  let best = -1, dist = 99;
  for (let c = 0; c < COLS; c++) for (let r = ROWS - 1; r >= 0; r--) if (s.cells[r * COLS + c] && Math.abs(c - s.you) < dist) { best = c; dist = Math.abs(c - s.you); }
  return { drop: best, why: best < 0 ? 'the wave is gone' : 'dropping toward your column' };
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0; s.cool = Math.max(0, s.cool - 1);
  if (s.pad > 0) s.pad--;
  else if (!input.auto && (input.left || input.right)) { if (input.left) s.you = Math.max(0, s.you - 1); if (input.right) s.you = Math.min(COLS - 1, s.you + 1); s.pad = 5; }
  if (input.auto) {
    let best = s.you, dist = 99;
    for (let c = 0; c < COLS; c++) {
      if (s.drop && c === s.drop.c) continue;
      for (let r = 0; r < ROWS; r++) if (s.cells[r * COLS + c] && Math.abs(c - s.you) < dist) { best = c; dist = Math.abs(c - s.you); }
    }
    if (s.drop && s.you === s.drop.c) best = s.you <= 0 ? 1 : s.you - 1;
    if (best > s.you) s.you++; else if (best < s.you) s.you--;
    if (s.drop && s.you === s.drop.c) s.you = Math.max(0, Math.min(COLS - 1, s.you + (s.drop.c === 0 ? 1 : -1)));
  }
  if ((input.fire || input.auto) && !s.bullet && s.cool === 0) { s.bullet = { c: s.you, y: H - 28 }; s.cool = 6; s.sfx = 1; }
  if (s.tick % 28 === 0) { const edge = s.dir > 0 ? s.ox + COLS * (CELL + 4) > W - 8 : s.ox < 8; if (edge) { s.dir *= -1; s.oy += 4; } else s.ox += s.dir * 6; }
  if (s.bullet) {
    s.bullet.y -= 5;
    for (let r = 0; r < ROWS && s.bullet; r++) for (let c = 0; c < COLS && s.bullet; c++) if (s.cells[r * COLS + c] && Math.abs(colX(s, c) - colX(s, s.bullet.c)) < CELL && Math.abs(rowY(s, r) - s.bullet.y) < CELL) {
      s.cells[r * COLS + c] = 0; s.score.you += 10; s.bullet = null; s.sfx = 1;
    }
    if (s.bullet && s.bullet.y < 0) s.bullet = null;
  }
  const bot = policy(s); s.why = bot.why;
  if (!s.drop && bot.drop >= 0 && s.tick % 70 === 0) for (let r = ROWS - 1; r >= 0; r--) if (s.cells[r * COLS + bot.drop]) { s.drop = { c: bot.drop, y: rowY(s, r) + 8 }; break; }
  if (s.drop) {
    s.drop.y += 1.5;
    if (s.drop.y > H - 24 && s.drop.c === s.you) s.over = 'void';
    else if (s.drop.y > H) s.drop = null;
  }
  if (s.oy + ROWS * (CELL + 6) > H - 36) s.over = 'void';
  if (!s.over && s.cells.every((c) => !c)) { s.over = 'you'; s.score.you += 50; }
  if (!s.over && s.tick >= CAP) s.over = s.score.you > 0 ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true, fire: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H); g.fillStyle = '#b79bff';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s.cells[r * COLS + c]) g.fillRect(colX(s, c) - CELL / 2, rowY(s, r) - 8, CELL, 14);
  if (s.drop) { g.fillStyle = '#e0b15a'; g.fillRect(colX(s, s.drop.c) - 3, s.drop.y, 6, 8); }
  if (s.bullet) { g.fillStyle = '#f4f1ea'; g.fillRect(colX(s, s.bullet.c) - 1, s.bullet.y, 2, 8); }
  g.fillStyle = '#4fe3e3'; g.fillRect(colX(s, s.you) - 12, H - 22, 24, 6);
}
export const how = 'Move with the arrows and press space to fire at the rectangles. Verse drops one request at a time toward your column. Clear the block before a request lands on you. A link hands a friend the same wave.';
