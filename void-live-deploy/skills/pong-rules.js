/**
 * pong-rules — Void Pong in plain JS (no DOM), shared by the card (skills/pong.js) and its tests.
 * A table tennis classic (the 1972 game's mechanics; name and look are Verse's own). You are the left paddle; Verse plays
 * the right one: it reads the ball's path off the walls and moves there at a capped speed with a small aim error, so it
 * is beatable. First to 7 wins. Units: the court is W x H, the ball moves in units per second.
 *   create() -> state    step(s, dt, input?) -> s (mutates)    voidAim(s) -> y    predictY(s) -> y
 */
export const W = 400, H = 260, PAD_H = 46, PAD_W = 8, BALL = 7, WIN = 7, VOID_SPEED = 230, YOU_SPEED = 320;
export function create(seed = 1) {
  const s = { you: { y: H / 2, score: 0 }, void: { y: H / 2, score: 0 }, ball: null, over: null, serve: 1, rng: seed >>> 0 || 1, rally: 0, lastWhy: '' };
  serve(s); return s;
}
const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };
export function serve(s) {
  const a = (rand(s) - 0.5) * 0.9, sp = 210;
  s.ball = { x: W / 2, y: H / 2, vx: Math.cos(a) * sp * s.serve, vy: Math.sin(a) * sp }; s.rally = 0; s.aimErr = 0;
}
/** Where the ball will cross Verse's paddle line, bouncing off the top and bottom walls. */
export function predictY(s) {
  const b = s.ball; if (b.vx <= 0) return H / 2;
  const t = (W - PAD_W - BALL / 2 - b.x) / b.vx; let y = b.y + b.vy * t;
  const lo = BALL / 2, hi = H - BALL / 2, span = hi - lo; y -= lo; y = ((y % (2 * span)) + 2 * span) % (2 * span); if (y > span) y = 2 * span - y;
  return y + lo;
}
export function voidAim(s) { return s.ball.vx > 0 ? predictY(s) + (s.aimErr || 0) : H / 2 + (s.ball.y - H / 2) * 0.3; }
const clampPad = (y) => Math.max(PAD_H / 2, Math.min(H - PAD_H / 2, y));
/** input: { y } (pointer: move toward y) or { dir: -1|0|1 } (keys). */
export function step(s, dt, input = {}) {
  if (s.over) return s;
  dt = Math.min(dt, 0.05);
  if (typeof input.y === 'number') { const d = input.y - s.you.y; s.you.y = clampPad(s.you.y + Math.sign(d) * Math.min(Math.abs(d), YOU_SPEED * 1.6 * dt)); }
  else if (input.dir) s.you.y = clampPad(s.you.y + input.dir * YOU_SPEED * dt);
  const aim = voidAim(s), d = aim - s.void.y; s.void.y = clampPad(s.void.y + Math.sign(d) * Math.min(Math.abs(d), VOID_SPEED * dt));
  const b = s.ball; b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.y < BALL / 2) { b.y = BALL - b.y; b.vy = Math.abs(b.vy); }
  if (b.y > H - BALL / 2) { b.y = 2 * (H - BALL / 2) - b.y; b.vy = -Math.abs(b.vy); }
  const hit = (pad, x, dir) => {
    if (Math.abs(b.y - pad.y) > PAD_H / 2 + BALL / 2) return false;
    const off = (b.y - pad.y) / (PAD_H / 2), sp = Math.min(520, Math.hypot(b.vx, b.vy) * 1.05);
    const a = off * 0.9; b.vx = Math.cos(a) * sp * dir; b.vy = Math.sin(a) * sp; b.x = x; s.rally++;
    return true;
  };
  if (b.vx < 0 && b.x <= PAD_W + BALL / 2) { if (!hit(s.you, PAD_W + BALL / 2, 1)) return point(s, 'void'); s.aimErr = (rand(s) - 0.5) * PAD_H * Math.min(1.6, 0.5 + s.rally * 0.08); }
  if (b.vx > 0 && b.x >= W - PAD_W - BALL / 2) { if (!hit(s.void, W - PAD_W - BALL / 2, -1)) return point(s, 'you'); s.lastWhy = 'read the bounce off the wall and met it'; }
  return s;
}
function point(s, who) {
  s[who].score++; s.lastWhy = who === 'you' ? 'the ball got past Verse: too fast after a ' + s.rally + '-hit rally' : 'Verse angled it past you';
  if (s[who].score >= WIN) { s.over = who; return s; }
  s.serve = who === 'you' ? 1 : -1; serve(s); return s;
}
