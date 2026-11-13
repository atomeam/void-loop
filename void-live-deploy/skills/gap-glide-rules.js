/**
 * gap-glide-rules — Gap Glide, a one-tap flyer, in plain JS (no DOM).
 * Two gliders share one scrolling course of gaps. You are seat 1, Verse is seat 2. Gravity pulls down; a tap lifts.
 * The first glider to touch a wall or a bar loses. A careful tap beats Verse, who aims a little low.
 * Research: domains/void.game-research.md. The one-tap genre is free; the famous name and its art are not used.
 *   create(seed) -> s    tick(s, { flap, auto }) -> s    selfPlay(seed) -> { over, tick, score }
 */
export const id = 'gap-glide', W = 280, H = 168, BX = 64, R = 5, GAP = 64, GW = 18, SPACE = 108;
const GRAV = 0.22, LIFT = -3.1, CAP = 6000;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
function pipe(s, x) {
  const lo = 26 + GAP / 2, hi = H - 26 - GAP / 2;
  return { x, c: lo + Math.floor(rng(s) * (hi - lo)), scored: false };
}
export function create(seed = 1) {
  const s = { n: (seed >>> 0) || 1, tick: 0, y: [H * 0.42, H * 0.42], v: [0, 0], alive: [1, 1], pipes: [], over: null, why: '', score: { you: 0, void: 0 }, sfx: 0 };
  for (let i = 0; i < 3; i++) s.pipes.push(pipe(s, 190 + i * SPACE));
  return s;
}
const nextPipe = (s) => s.pipes.find((p) => p.x + GW > BX - R) || s.pipes[0];
/** seat 'you' or 'void'. late is how far below the gap centre the glider waits before it lifts. */
export function wantFlap(s, seat, late) {
  const i = seat === 'void' ? 1 : 0;
  if (!s.alive[i]) return false;
  const p = nextPipe(s);
  return s.v[i] > 0.15 && s.y[i] > p.c + late;
}
function hit(y, p) {
  if (BX + R < p.x || BX - R > p.x + GW) return false;
  return y - R < p.c - GAP / 2 || y + R > p.c + GAP / 2;
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  const flap = [input.auto ? wantFlap(s, 'you', 4) : !!input.flap, wantFlap(s, 'void', 26)];
  s.why = flap[1] ? 'lifting toward the gap, a little late' : 'holding the glide';
  for (let i = 0; i < 2; i++) if (s.alive[i]) {
    if (flap[i]) { s.v[i] = LIFT; s.sfx = 1; }
    s.v[i] = Math.min(5.6, s.v[i] + GRAV);
    s.y[i] += s.v[i];
    if (s.y[i] < R || s.y[i] > H - R) s.alive[i] = 0;
  }
  for (const p of s.pipes) {
    p.x -= 1.55;
    for (let i = 0; i < 2; i++) if (s.alive[i] && hit(s.y[i], p)) s.alive[i] = 0;
    if (!p.scored && p.x + GW < BX - R) { p.scored = true; if (s.alive[0]) s.score.you++; if (s.alive[1]) s.score.void++; }
  }
  if (s.pipes.length && s.pipes[0].x < -GW) { s.pipes.shift(); s.pipes.push(pipe(s, s.pipes[s.pipes.length - 1].x + SPACE)); }
  if (!s.alive[0] || !s.alive[1]) s.over = s.alive[0] ? 'you' : s.alive[1] ? 'void' : 'draw';
  else if (s.tick >= CAP) s.over = s.score.you > s.score.void ? 'you' : s.score.void > s.score.you ? 'void' : 'draw';
  return s;
}
export function selfPlay(seed, cap = CAP) {
  const s = create(seed);
  while (!s.over && s.tick < cap) tick(s, { auto: true });
  return { over: s.over, tick: s.tick, score: { ...s.score } };
}
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  for (const p of s.pipes) {
    g.fillStyle = '#3a2a78';
    g.fillRect(p.x, 0, GW, p.c - GAP / 2);
    g.fillRect(p.x, p.c + GAP / 2, GW, H - (p.c + GAP / 2));
    g.fillStyle = '#4fe3e3'; g.fillRect(p.x, p.c - GAP / 2 - 3, GW, 3); g.fillRect(p.x, p.c + GAP / 2, GW, 3);
  }
  const bird = (y, color, on) => { if (!on) return; g.fillStyle = color; g.beginPath(); g.arc(BX, y, R, 0, 7); g.fill(); };
  bird(s.y[1], '#b79bff', s.alive[1]); bird(s.y[0], '#4fe3e3', s.alive[0]);
}
export const how = 'Tap or press the space bar to lift your cyan glider. Verse flies the violet one on the same course and aims a little low. The first one to touch a bar or the edge loses. A link can hand a friend the same course.';
