/** Debris Field: two ships, square chunks, no spinning ship and no splitting rocks. Verse holds the top. */
export const id = 'debris-field', W = 240, H = 200, CAP = 900, LIVES = 3;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function create(seed = 1) {
  const s = { n: (seed >>> 0) || 1, tick: 0, x: [W / 2, W / 2], shots: [], chunks: [], lives: { you: LIVES, void: LIVES }, cool: [0, 0], over: null, why: '', score: { you: 0, void: 0 }, sfx: 0 };
  for (let i = 0; i < 5; i++) s.chunks.push({ x: 24 + rng(s) * (W - 48), y: 56 + rng(s) * 80, vx: (rng(s) - 0.5) * 1.3, vy: (rng(s) - 0.5) * 1, s: 12, on: 1 });
  return s;
}
function fire(s, seat) {
  const i = seat === 'you' ? 0 : 1;
  if (s.cool[i] > 0 || s.lives[seat] <= 0) return;
  s.shots.push({ x: s.x[i], y: i ? 22 : H - 22, vy: i ? 3.2 : -3.2, seat, on: 1 });
  s.cool[i] = 14; s.sfx = 1;
}
export function policy(s) {
  let best = null;
  for (const c of s.chunks) if (c.on && (!best || Math.abs(c.x - s.x[1]) < Math.abs(best.x - s.x[1]))) best = c;
  if (!best) return { x: W / 2, fire: false, why: 'the field is clear' };
  return { x: best.x, fire: Math.abs(best.x - s.x[1]) < 18, why: 'lining up on the nearest chunk' };
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  const bot = policy(s); s.why = bot.why;
  const aim = input.auto ? s.x[0] + (bot.x - s.x[0]) * 0.5 : (Number.isFinite(input.x) ? input.x : s.x[0] + (input.left ? -5 : 0) + (input.right ? 5 : 0));
  if (s.lives.you > 0) s.x[0] = clamp(aim, 12, W - 12);
  if (s.lives.void > 0) s.x[1] = clamp(s.x[1] + clamp(bot.x - s.x[1], -1.6, 1.6), 12, W - 12);
  s.cool[0]--; s.cool[1]--;
  if (input.auto || input.fire) fire(s, 'you');
  if (bot.fire && s.tick % 2 === 0) fire(s, 'void');
  for (const c of s.chunks) if (c.on) { c.x += c.vx; c.y += c.vy; if (c.x < 10 || c.x > W - 10) c.vx *= -1; if (c.y < 40 || c.y > H - 40) c.vy *= -1; }
  for (const b of s.shots) if (b.on) {
    b.y += b.vy; if (b.y < 0 || b.y > H) b.on = 0;
    for (const c of s.chunks) if (c.on && b.on && Math.abs(b.x - c.x) < c.s && Math.abs(b.y - c.y) < c.s) { c.on = 0; b.on = 0; s.score[b.seat] += 10; s.sfx = 1; }
  }
  s.shots = s.shots.filter((b) => b.on);
  for (const c of s.chunks) if (c.on) {
    if (s.lives.you > 0 && Math.abs(c.x - s.x[0]) < c.s && Math.abs(c.y - (H - 18)) < c.s) { s.lives.you--; c.on = 0; }
    if (s.lives.void > 0 && Math.abs(c.x - s.x[1]) < c.s && Math.abs(c.y - 18) < c.s) { s.lives.void--; c.on = 0; }
  }
  if (!s.chunks.some((c) => c.on)) s.chunks.push({ x: 30 + rng(s) * (W - 60), y: 70, vx: (rng(s) - 0.5) * 1.4, vy: (rng(s) - 0.5), s: 12, on: 1 });
  if (s.lives.you <= 0 || s.lives.void <= 0 || s.tick >= CAP) s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9b27a'; for (const c of s.chunks) if (c.on) g.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
  g.fillStyle = '#f4f1ea'; for (const b of s.shots) g.fillRect(b.x - 1, b.y - 3, 2, 6);
  if (s.lives.void > 0) { g.fillStyle = '#b79bff'; g.fillRect(s.x[1] - 10, 14, 20, 6); }
  if (s.lives.you > 0) { g.fillStyle = '#4fe3e3'; g.fillRect(s.x[0] - 10, H - 20, 20, 6); }
}
export const how = 'Slide the cyan ship and press space or the canvas to fire. Chunks are square. Verse flies the violet ship along the top and aims more slowly. The higher score at the end wins. A link hands a friend the same field.';
