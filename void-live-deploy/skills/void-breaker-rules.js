/**
 * void-breaker-rules — Void Breaker, Verse's bounce-and-clear arcade game, in plain JS (no DOM), shared by the card (skills/void-breaker.js) and its tests.
 * One field, two paddles, one ball and a band of bricks between them. You hold the bottom paddle, Verse the top. The ball bounces off the walls, the
 * paddles (the angle follows where it lands) and the bricks; a brick it breaks scores 10 for whoever touched the ball last. Miss the ball and you lose
 * a life, 3 each. The game ends when the bricks are gone (more points wins) or someone is out of lives (the other wins). The mechanic is the free
 * bounce-and-clear mechanic; its look, sounds, layouts and name are Verse's own (domains/void.game-research.md: the original's look is protected).
 * It runs in fixed steps with no clock and no randomness outside the seed, so a game is a seed plus the pointer positions.
 *   create(seed) -> s      tick(s, { x }) -> s      botX(s, seat) -> { x, why }      selfPlay(seed) -> { over, ticks, score }
 */
export const W = 240, H = 320, PW = 44, PH = 6, P1Y = 300, P2Y = 14, R = 4, COLS = 8, ROWS = 4, BW = 30, BH = 10, BY = 130, LIVES = 3, CAP = 30000;

const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function create(seed = 7) {
  const s = { rng: (seed >>> 0) || 1, tick: 0, p1: W / 2, p2: W / 2, ball: null, bricks: [], score: { you: 0, void: 0 }, lives: { you: LIVES, void: LIVES }, over: null, why: '', last: 'you', speed: 2.4 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s.bricks.push({ x: c * BW, y: BY + r * BH, alive: 1 });
  serve(s, rand(s) < 0.5 ? 'you' : 'void');
  return s;
}

/** put the ball in the middle (of the width) heading toward `to` ('you' = down, 'void' = up) at the base speed, at a seeded angle. */
function serve(s, to) {
  const a = (rand(s) - 0.5) * 1.0, v = s.speed = 2.4;
  // from just outside the brick band, on the sender's side, so a serve never starts inside a brick
  s.ball = { x: W / 2, y: to === 'you' ? BY + ROWS * BH + 24 : BY - 24, vx: Math.sin(a) * v, vy: (to === 'you' ? 1 : -1) * Math.cos(a) * v };
  s.last = to === 'you' ? 'void' : 'you';
}

const alive = (s) => s.bricks.filter((b) => b.alive).length;
export const bricksLeft = alive;

function finish(s) {
  if (s.lives.you <= 0) s.over = 'void'; else if (s.lives.void <= 0) s.over = 'you';
  else if (!alive(s)) s.over = s.score.you > s.score.void ? 'you' : s.score.void > s.score.you ? 'void' : 'draw';
}

/** one step of the game. input.x is where your paddle's centre should be (the pointer); Verse's paddle follows botX. */
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++;
  if (Number.isFinite(input.x)) s.p1 = clamp(input.x, PW / 2, W - PW / 2);
  const b = botX(s, 'void'); s.p2 = clamp(s.p2 + clamp(b.x - s.p2, -2.7, 2.7), PW / 2, W - PW / 2); s.why = b.why;
  const speed = Math.hypot(s.ball.vx, s.ball.vy), n = Math.max(1, Math.ceil(speed / 2));
  for (let k = 0; k < n && !s.over; k++) substep(s, 1 / n);
  if (s.tick >= CAP && !s.over) s.over = s.score.you > s.score.void ? 'you' : s.score.void > s.score.you ? 'void' : 'draw';
  return s;
}

function substep(s, f) {
  const B = s.ball; B.x += B.vx * f; B.y += B.vy * f;
  if (B.x < R) { B.x = R; B.vx = Math.abs(B.vx); } else if (B.x > W - R) { B.x = W - R; B.vx = -Math.abs(B.vx); }
  // the paddles: the ball lands on the near face; where it lands bends the bounce (up to about 60 degrees)
  for (const [seat, py, px, down] of [['you', P1Y, s.p1, false], ['void', P2Y, s.p2, true]]) {
    const hitY = down ? (B.vy < 0 && B.y - R <= py + PH && B.y > py - PH) : (B.vy > 0 && B.y + R >= py && B.y < py + PH);
    if (hitY && Math.abs(B.x - px) <= PW / 2 + R) {
      const off = clamp((B.x - px) / (PW / 2), -1, 1), v = Math.min(5.2, Math.hypot(B.vx, B.vy) * 1.02), a = off * 1.05;
      B.vx = Math.sin(a) * v; B.vy = (down ? 1 : -1) * Math.cos(a) * v; B.y = down ? py + PH + R : py - R; s.last = seat;
    }
  }
  // the bricks: break one, bounce off the face the ball came through
  for (const k of s.bricks) {
    if (!k.alive || B.x + R < k.x || B.x - R > k.x + BW || B.y + R < k.y || B.y - R > k.y + BH) continue;
    k.alive = 0; s.score[s.last] += 10;
    const dx = Math.min(B.x + R - k.x, k.x + BW - (B.x - R)), dy = Math.min(B.y + R - k.y, k.y + BH - (B.y - R));
    if (dx < dy) B.vx = -B.vx; else B.vy = -B.vy;
    break;
  }
  // past a paddle: a life goes, and the ball is served to the one who lost it
  if (B.y > H + R) { s.lives.you--; if (s.lives.you > 0) serve(s, 'you'); }
  else if (B.y < -R) { s.lives.void--; if (s.lives.void > 0) serve(s, 'void'); }
  finish(s);
}

/** where a seat's paddle should be: under the ball's landing point when it is coming, near the middle when it is going away. Verse reads only the ball. */
export function botX(s, seat) {
  const B = s.ball, coming = seat === 'void' ? B.vy < 0 : B.vy > 0;
  if (!coming) return { x: W / 2 + (B.x - W / 2) * 0.25, why: 'the ball is going away: back toward the middle' };
  const py = seat === 'void' ? P2Y + PH : P1Y, t = Math.abs((py - B.y) / (B.vy || 1e-6));
  let x = B.x + B.vx * t; // unfold the walls
  const span = W - 2 * R; x = ((x - R) % (2 * span) + 2 * span) % (2 * span); x = R + (x > span ? 2 * span - x : x);
  const wobble = seat === 'void' ? Math.sin(s.tick * 0.05) * 9 : 0; // Verse is not perfect: it aims a little off, so a good angle can beat it
  return { x: x + wobble, why: 'tracking the ball: it lands near ' + Math.round(x) };
}

/** a whole game with both paddles driven by botX (a person's paddle replaced by the same logic with no wobble): { over, ticks, score }. */
export function selfPlay(seed, cap = CAP) {
  const s = create(seed);
  while (!s.over && s.tick < cap) tick(s, { x: botX(s, 'you').x });
  return { over: s.over, ticks: s.tick, score: { ...s.score } };
}
