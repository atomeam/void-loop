/**
 * void-breaker-rules — Verse Breaker, Verse's bounce-and-clear arcade game, in plain JS (no DOM), shared by the card (skills/void-breaker.js) and its tests.
 * One field, two paddles, two balls and a band of bricks between them. You hold the bottom paddle, Verse the top. Each round starts with two balls
 * at once: your cyan ball serves upward from your paddle and Verse's violet ball serves downward from theirs, aimed into the symmetric central brick
 * layout. A ball bounces off the walls, paddles (angle follows where it lands) and bricks; a brick it breaks scores 10 for whoever touched that ball
 * last (returning the other side's ball into the wall steals the points). Miss a ball past your paddle and you lose a life, 3 each; that ball re-serves
 * from your side while the other stays in play if lives remain. The game ends when the bricks are gone (more points wins) or someone is out of lives
 * (the other wins). The mechanic is the free bounce-and-clear mechanic; its look, sounds, layouts and name are Verse's own (domains/void.game-research.md).
 * It runs in fixed steps with no clock and no randomness outside the seed, so a game is a seed plus the pointer positions.
 *   create(seed) -> s      tick(s, { x }) -> s      botX(s, seat) -> { x, why }      selfPlay(seed) -> { over, ticks, score }
 */
export const W = 240, H = 320, PW = 44, PH = 6, P1Y = 300, P2Y = 14, R = 4, COLS = 8, ROWS = 4, BW = 30, BH = 10, BY = 130, LIVES = 3, CAP = 30000;

const rand = (s) => { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function create(seed = 7) {
  const s = { rng: (seed >>> 0) || 1, tick: 0, p1: W / 2, p2: W / 2, balls: [], bricks: [], score: { you: 0, void: 0 }, lives: { you: LIVES, void: LIVES }, over: null, why: '', speed: 2.4 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s.bricks.push({ x: c * BW, y: BY + r * BH, alive: 1 });
  serveBall(s, 'you'); // cyan: serves upward from player's side
  serveBall(s, 'void'); // violet: serves downward from Verse's side
  // compat: some callers may expect a single ball reference
  s.ball = s.balls[0] || null;
  return s;
}

/** create/replace a ball serving toward the bricks from `seat`'s side ('you' = upward from bottom, 'void' = downward from top). */
function serveBall(s, seat, idx = null) {
  const a = (rand(s) - 0.5) * 0.8, v = s.speed = 2.4;
  const up = seat === 'you';
  const y = up ? BY + ROWS * BH + 24 : BY - 24;
  const vy = up ? -Math.cos(a) * v : Math.cos(a) * v;
  const ball = { x: W / 2, y, vx: Math.sin(a) * v, vy, last: seat, home: seat };
  if (idx != null && s.balls[idx]) s.balls[idx] = ball;
  else {
    const i = s.balls.findIndex((b) => b && b.home === seat);
    if (i >= 0) s.balls[i] = ball; else s.balls.push(ball);
  }
  s.ball = s.balls[0] || ball;
}

const alive = (s) => s.bricks.filter((b) => b.alive).length;
export const bricksLeft = alive;

function finish(s) {
  if (s.lives.you <= 0) s.over = 'void'; else if (s.lives.void <= 0) s.over = 'you';
  else if (!alive(s)) s.over = s.score.you > s.score.void ? 'you' : s.score.void > s.score.you ? 'void' : 'tie';
}

/** one step of the game. input.x is where your paddle's centre should be (the pointer); Verse's paddle follows botX. */
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++;
  if (Number.isFinite(input.x)) s.p1 = clamp(input.x, PW / 2, W - PW / 2);
  const b = botX(s, 'void'); s.p2 = clamp(s.p2 + clamp(b.x - s.p2, -2.7, 2.7), PW / 2, W - PW / 2); s.why = b.why;
  const maxSpeed = Math.max(0, ...s.balls.map((B) => Math.hypot(B.vx, B.vy)));
  const n = Math.max(1, Math.ceil(maxSpeed / 2));
  for (let k = 0; k < n && !s.over; k++) substep(s, 1 / n);
  if (s.tick >= CAP && !s.over) s.over = s.score.you > s.score.void ? 'you' : s.score.void > s.score.you ? 'void' : 'tie';
  return s;
}

function substep(s, f) {
  for (const B of s.balls) {
    if (!B) continue;
    B.x += B.vx * f; B.y += B.vy * f;
    if (B.x < R) { B.x = R; B.vx = Math.abs(B.vx); } else if (B.x > W - R) { B.x = W - R; B.vx = -Math.abs(B.vx); }
    // the paddles: the ball lands on the near face; where it lands bends the bounce (up to about 60 degrees)
    for (const [seat, py, px, down] of [['you', P1Y, s.p1, false], ['void', P2Y, s.p2, true]]) {
      const hitY = down ? (B.vy < 0 && B.y - R <= py + PH && B.y > py - PH) : (B.vy > 0 && B.y + R >= py && B.y < py + PH);
      if (hitY && Math.abs(B.x - px) <= PW / 2 + R) {
        const off = clamp((B.x - px) / (PW / 2), -1, 1), v = Math.min(5.2, Math.hypot(B.vx, B.vy) * 1.02), a = off * 1.05;
        B.vx = Math.sin(a) * v; B.vy = (down ? 1 : -1) * Math.cos(a) * v; B.y = down ? py + PH + R : py - R; B.last = seat;
      }
    }
    // the bricks: break one, bounce off the face the ball came through; points go to whoever last hit this ball
    for (const k of s.bricks) {
      if (!k.alive || B.x + R < k.x || B.x - R > k.x + BW || B.y + R < k.y || B.y - R > k.y + BH) continue;
      k.alive = 0; s.score[B.last || B.home] += 10;
      const dx = Math.min(B.x + R - k.x, k.x + BW - (B.x - R)), dy = Math.min(B.y + R - k.y, k.y + BH - (B.y - R));
      if (dx < dy) B.vx = -B.vx; else B.vy = -B.vy;
      break;
    }
  }
  // past a paddle: that side loses a life and that ball re-serves from that side while the other stays in play
  for (let i = 0; i < s.balls.length; i++) {
    const B = s.balls[i]; if (!B) continue;
    if (B.y > H + R) {
      s.lives.you--;
      if (s.lives.you > 0) serveBall(s, 'you', i); else { B.y = H + R; B.vy = 0; B.vx = 0; }
    } else if (B.y < -R) {
      s.lives.void--;
      if (s.lives.void > 0) serveBall(s, 'void', i); else { B.y = -R; B.vy = 0; B.vx = 0; }
    }
  }
  s.ball = s.balls[0] || null;
  finish(s);
}

/** where a seat's paddle should be: track the most relevant incoming ball, else stay near middle. Verse reads only ball positions/velocities. */
export function botX(s, seat) {
  const py = seat === 'void' ? P2Y + PH : P1Y;
  const candidates = s.balls.map((B) => {
    const coming = seat === 'void' ? B.vy < 0 : B.vy > 0;
    if (!coming) return null;
    const t = Math.abs((py - B.y) / (B.vy || 1e-6));
    let x = B.x + B.vx * t;
    const span = W - 2 * R; x = ((x - R) % (2 * span) + 2 * span) % (2 * span); x = R + (x > span ? 2 * span - x : x);
    return { x, t };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  if (!candidates.length) {
    const B = s.balls[0] || { x: W / 2 };
    return { x: W / 2 + (B.x - W / 2) * 0.25, why: 'the ball is going away: back toward the middle' };
  }
  const x = candidates[0].x;
  const wobble = seat === 'void' ? Math.sin(s.tick * 0.05) * 7 : 0; // Verse is not perfect: it aims a little off, so a good angle can beat it
  return { x: x + wobble, why: 'tracking the ball: it lands near ' + Math.round(x) };
}

/** a whole game with both paddles driven by botX (a person's paddle replaced by the same logic with no wobble): { over, ticks, score }. */
export function selfPlay(seed, cap = CAP) {
  const s = create(seed);
  while (!s.over && s.tick < cap) tick(s, { x: botX(s, 'you').x });
  return { over: s.over, ticks: s.tick, score: { ...s.score } };
}
