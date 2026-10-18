// zorbleflux - the pure half of Verse's own game (asked by Verse: "I want to learn 'zorbleflux'"; the owner, 2026-10-18: "we should
// just have a zorbleflux game"). You pilot a glowing zorb through a flux field. Motes of flux drift on a seeded curl-noise flow:
// collect them to grow and to raise your multiplier; dark bleeds drift slowly and shrink you on touch. A round is 45 seconds of
// game time. No DOM, no clock, no Math.random: everything is a function of the seed and the steps taken (tools/zorbleflux.test.mjs).
//
//   create(seed, { slow })  step(s, dt, input)  curl(seed, x, y, t)  bestOf(prev, score)  parseBest(text)
// input: { x, y } is a point in the field the zorb steers toward, or { dx, dy } a direction in -1..1 (keys). Units are field pixels.
import { rng, clamp } from './field-kit.js';

export const W = 480, H = 320, ROUND = 45;
export const MOTES = 16, BLEEDS = 4;
export const R_START = 12, R_MIN = 6, R_MAX = 26, GROW = 0.9, SHRINK = 3.5, HIT_PAUSE = 0.9;
export const MULT_MAX = 5, MULT_STEP = 0.25, SPEED = 190, MOTE_R = 5;

const fract = (v) => v - Math.floor(v);
const hash = (seed, i, j) => { let h = Math.imul((seed >>> 0) ^ Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263), 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const fade = (t) => t * t * (3 - 2 * t);
/** smooth value noise in 0..1 at (x, y, z): a seeded lattice, interpolated. Pure. */
export function noise(seed, x, y, z = 0) {
  const zi = Math.floor(z), zf = fade(z - zi), xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi);
  const layer = (k) => { const s = (seed + Math.imul(k, 2654435761)) >>> 0; const a = hash(s, xi, yi), b = hash(s, xi + 1, yi), c = hash(s, xi, yi + 1), d = hash(s, xi + 1, yi + 1); return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf; };
  const n0 = layer(zi), n1 = layer(zi + 1); return n0 + (n1 - n0) * zf;
}
/** the flow at (x, y) and time t: the curl of a noise potential, so it swirls and never piles up. Returns { x, y } of length about 0..1. Pure. */
export function curl(seed, x, y, t = 0) {
  const e = 0.35, k = 1 / 90, tz = t * 0.12, px = x * k, py = y * k;
  const dy = noise(seed, px, py + e, tz) - noise(seed, px, py - e, tz), dx = noise(seed, px + e, py, tz) - noise(seed, px - e, py, tz);
  return { x: dy / (2 * e) * 1.6, y: -dx / (2 * e) * 1.6 };
}

function spawnMote(s, avoid = true) {
  for (let tries = 0; tries < 12; tries++) {
    const x = s.rand.range(14, W - 14), y = s.rand.range(14, H - 14);
    if (!avoid || Math.hypot(x - s.zorb.x, y - s.zorb.y) > s.zorb.r + 40) return { x, y };
  }
  return { x: s.rand.range(14, W - 14), y: s.rand.range(14, H - 14) };
}

/** a fresh round. slow: reduced motion, the field and the bleeds drift at 40% speed (a gentler round, nothing flashes). */
export function create(seed = 1, { slow = false } = {}) {
  const rand = rng(seed), s = { seed: (seed >>> 0) || 1, slow: !!slow, rand, t: 0, over: false, score: 0, mult: 1, collected: 0, hits: 0, hurt: 0, why: '',
    zorb: { x: W / 2, y: H / 2, r: R_START }, motes: [], bleeds: [] };
  for (let i = 0; i < MOTES; i++) s.motes.push(spawnMote(s));
  for (let i = 0; i < BLEEDS; i++) {
    const a = rand.range(0, Math.PI * 2), sp = rand.range(10, 22);
    s.bleeds.push({ x: rand.range(40, W - 40), y: rand.range(40, H - 40), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand.range(24, 38) });
  }
  // keep the first bleeds clear of the zorb so nobody is hurt at second zero
  for (const b of s.bleeds) if (Math.hypot(b.x - s.zorb.x, b.y - s.zorb.y) < b.r + 70) { b.x = b.x < W / 2 ? 50 : W - 50; b.y = b.y < H / 2 ? 50 : H - 50; }
  return s;
}

/** the points a mote is worth right now. */
export const worth = (mult) => Math.round(10 * mult);

/** advance one frame of dt seconds (capped at 50 ms so a stalled tab cannot jump). input: { x, y } target or { dx, dy } direction. Mutates and returns s. */
export function step(s, dt, input = {}) {
  if (s.over) return s;
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  const left = ROUND - s.t; if (dt > left) dt = left;
  const k = s.slow ? 0.4 : 1, z = s.zorb;
  // the zorb: toward a point, or along a direction
  let vx = 0, vy = 0;
  if (Number.isFinite(input.x) && Number.isFinite(input.y)) { const dx = input.x - z.x, dy = input.y - z.y, d = Math.hypot(dx, dy); if (d > 1) { const sp = Math.min(SPEED, d * 7); vx = dx / d * sp; vy = dy / d * sp; } }
  else if (Number.isFinite(input.dx) || Number.isFinite(input.dy)) { const dx = clamp(+input.dx || 0, -1, 1), dy = clamp(+input.dy || 0, -1, 1), d = Math.hypot(dx, dy) || 1; vx = dx / d * SPEED * Math.min(1, Math.hypot(dx, dy)); vy = dy / d * SPEED * Math.min(1, Math.hypot(dx, dy)); }
  const heavy = 1 - 0.35 * (z.r - R_MIN) / (R_MAX - R_MIN); // a big zorb is a little slower: growing is not free
  z.x = clamp(z.x + vx * heavy * dt, z.r, W - z.r); z.y = clamp(z.y + vy * heavy * dt, z.r, H - z.r);
  // the motes ride the flow and bounce off the walls
  for (const m of s.motes) {
    const f = curl(s.seed, m.x, m.y, s.t);
    m.x += f.x * 38 * k * dt; m.y += f.y * 38 * k * dt;
    if (m.x < 6) m.x = 6; else if (m.x > W - 6) m.x = W - 6;
    if (m.y < 6) m.y = 6; else if (m.y > H - 6) m.y = H - 6;
  }
  // the bleeds drift and bounce
  for (const b of s.bleeds) {
    b.x += b.vx * k * dt; b.y += b.vy * k * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } else if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
  }
  s.t += dt; s.hurt = Math.max(0, s.hurt - dt);
  // collecting
  for (let i = 0; i < s.motes.length; i++) {
    const m = s.motes[i];
    if (Math.hypot(m.x - z.x, m.y - z.y) <= z.r + MOTE_R) {
      const pts = worth(s.mult); s.score += pts; s.collected++; z.r = Math.min(R_MAX, z.r + GROW); s.mult = Math.min(MULT_MAX, s.mult + MULT_STEP);
      s.why = '+' + pts; s.motes[i] = spawnMote(s);
    }
  }
  // the bleeds: a touch shrinks you and drops the multiplier, then you are safe a moment
  if (s.hurt <= 0) for (const b of s.bleeds) if (Math.hypot(b.x - z.x, b.y - z.y) < b.r + z.r * 0.6) {
    z.r = Math.max(R_MIN, z.r - SHRINK); s.mult = Math.max(1, s.mult - 1); s.hits++; s.hurt = HIT_PAUSE; s.why = 'a bleed'; break;
  }
  if (s.t >= ROUND - 1e-9) { s.t = ROUND; s.over = true; }
  return s;
}

/** the best score after a round: { best, isNew }. prev is whatever was stored (a number, a numeric string, or junk). Pure. */
export function bestOf(prev, score) {
  const p = parseBest(prev), sc = Math.max(0, Math.floor(+score || 0));
  return sc > p ? { best: sc, isNew: sc > 0 } : { best: p, isNew: false };
}
/** a stored best back into a safe whole number (0 when it is missing or junk). */
export function parseBest(v) { const n = Math.floor(+v); return Number.isFinite(n) && n > 0 && n < 1e7 ? n : 0; }

/** the one line the card shows while playing. */
export const status = (s) => s.over ? 'Round over: ' + s.score + ' flux' : Math.ceil(ROUND - s.t) + 's · ' + s.score + ' flux · x' + s.mult.toFixed(2).replace(/\.?0+$/, '');
export const ABOUT = 'A zorbleflux is the thing Verse got asked about 154 times and could not answer, so it made it a game.';
export const RULES = 'Steer the zorb. Collect flux to grow and score more. Avoid the dark bleeds. 45 seconds.';
