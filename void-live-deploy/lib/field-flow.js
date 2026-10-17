// field-flow — the pure law of F-033, the Adaptive Flow-Canvas (asked by Owner, 2026-10-17; Grok's idea F-033, on lib/field-kit.js).
// Particles ride a coarse vector field (G x G cells, bilinear, Euler or RK2). The field is the sum of three things: a base
// field made from three numbers (magnitude, direction, spatial frequency) that a small evolutionary mind keeps improving, the
// edits a person paints by hand, and a Gaussian swirl the pointer injects (it fades). No DOM, no clock, no Math.random: every
// function is a function of its arguments, so the law is tested with numbers (tools/field-flow.test.mjs).
//   baseField(params) edits makeField  sampleField advectOne advect   the field and how a tracer moves in it
//   injectSwirl decaySwirl paintEdit composeField                    the pointer, the person and the sum
//   scoreFlow evolveFlow                                               fitness = trajectory diversity + a pointer-interaction bonus; mutate, score, replace if better
//   flowMetrics inkShape                                               the numbers the card morphs from; a particle's velocity as a CSS shape
import { clamp, lerp, wrap01, makeGrid, rng, occupancyEntropy, entropy, mutate } from './field-kit.js';

export const G = 16;               // cells each way
export const VERSION = 1;          // shown on the card; bump it when the law changes
export const MAX_N = 700;          // the most tracers ever drawn (the ink-density control scales between MIN_N and this)
export const MIN_N = 60;
export const SPEC = { mag: [0.05, 0.5], dir: [0, 6.2832], freq: [0.5, 3] };
export const START = { mag: 0.22, dir: 0.6, freq: 1.4 };
const TAU = Math.PI * 2;

export const makeField = () => ({ u: makeGrid(G, G), v: makeGrid(G, G) });
export const copyField = (a, b) => { a.u.set(b.u); a.v.set(b.v); return a; };

/** the base field from three numbers: a swirling sheet whose mean heading is `dir`, whose waves repeat `freq` times across the card and whose speed is about `mag`. */
export function baseField(params, f = makeField()) {
  const mag = params.mag, dir = params.dir, k = TAU * params.freq;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = (i + 0.5) / G, y = (j + 0.5) / G, th = dir + 1.4 * Math.sin(k * x + 1) * Math.cos(k * y + 0.5), sp = mag * (0.75 + 0.25 * Math.sin(k * (x + y)));
    f.u[j * G + i] = sp * Math.cos(th); f.v[j * G + i] = sp * Math.sin(th);
  }
  return f;
}

/** the field's vector at (x,y) in the unit square, bilinear between the four nearest cell centres, wrapping at the edges. Writes into out [u,v]. */
export function sampleField(f, x, y, out = [0, 0]) {
  const gx = wrap01(x) * G - 0.5, gy = wrap01(y) * G - 0.5, i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
  const a = ((i0 % G) + G) % G, b = (a + 1) % G, c = ((j0 % G) + G) % G, d = (c + 1) % G;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  out[0] = f.u[c * G + a] * w00 + f.u[c * G + b] * w10 + f.u[d * G + a] * w01 + f.u[d * G + b] * w11;
  out[1] = f.v[c * G + a] * w00 + f.v[c * G + b] * w10 + f.v[d * G + a] * w01 + f.v[d * G + b] * w11;
  return out;
}

const k1 = [0, 0], k2 = [0, 0];
/** one tracer's step: Euler (one look at the field) or RK2 (the midpoint rule: look, half a step, look again). Returns [x', y', u, v] in `out`; positions wrap. */
export function advectOne(f, x, y, dt, method = 'rk2', out = [0, 0, 0, 0]) {
  sampleField(f, x, y, k1); let u = k1[0], v = k1[1];
  if (method === 'rk2') { sampleField(f, x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1], k2); u = k2[0]; v = k2[1]; }
  out[0] = wrap01(x + u * dt); out[1] = wrap01(y + v * dt); out[2] = u; out[3] = v; return out;
}
/** advect the first n tracers of p (x, y, vx, vy arrays) one step. */
export function advect(p, f, dt, n = p.n, method = 'rk2') {
  const o = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) { advectOne(f, p.x[i], p.y[i], dt, method, o); p.x[i] = o[0]; p.y[i] = o[1]; p.vx[i] = o[2]; p.vy[i] = o[3]; }
  return p;
}

// ---- the pointer, the person, the sum ----------------------------------------------------------------------------------------
/** add a Gaussian swirl centred on (px,py) to a swirl field: tangential, zero at the centre, strongest about one sigma out. */
export function injectSwirl(sw, px, py, k = 0.3, sigma = 0.14) {
  const s2 = 2 * sigma * sigma;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const dx = (i + 0.5) / G - px, dy = (j + 0.5) / G - py, w = Math.exp(-(dx * dx + dy * dy) / s2) * k / sigma;
    sw.u[j * G + i] += -dy * w; sw.v[j * G + i] += dx * w;
  }
  return sw;
}
export function decaySwirl(sw, keep = 0.93) { for (let i = 0; i < sw.u.length; i++) { sw.u[i] *= keep; sw.v[i] *= keep; } return sw; }
/** a person's brush: push the cells near (x,y) along (dx,dy), Gaussian in the distance, edits kept within +-limit so nothing runs away. */
export function paintEdit(ed, x, y, dx, dy, radius = 0.1, k = 0.5, limit = 0.7) {
  const s2 = 2 * radius * radius;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const ex = (i + 0.5) / G - x, ey = (j + 0.5) / G - y, w = Math.exp(-(ex * ex + ey * ey) / s2) * k;
    if (w < 0.004) continue; const n = j * G + i;
    ed.u[n] = clamp(ed.u[n] + dx * w, -limit, limit); ed.v[n] = clamp(ed.v[n] + dy * w, -limit, limit);
  }
  return ed;
}
export const editedCells = (ed) => { let n = 0; for (let i = 0; i < ed.u.length; i++) if (Math.abs(ed.u[i]) + Math.abs(ed.v[i]) > 0.01) n++; return n; };
/** total = base + edits + swirl (+ a steady push, the tilt). */
export function composeField(tot, base, ed, sw, wind = null) {
  const wx = Number.isFinite(wind && wind[0]) ? wind[0] : 0, wy = Number.isFinite(wind && wind[1]) ? wind[1] : 0; // a missing or non-finite component is 0, never NaN
  for (let i = 0; i < tot.u.length; i++) { tot.u[i] = base.u[i] + ed.u[i] + sw.u[i] + wx; tot.v[i] = base.v[i] + ed.v[i] + sw.v[i] + wy; }
  return tot;
}

// ---- the mind: mutate candidates, score them, keep a candidate only if it is better ------------------------------------------------
const flatten = (ed) => (ed ? { u: Float32Array.from(ed.u), v: Float32Array.from(ed.v) } : { u: makeGrid(G, G), v: makeGrid(G, G) });
/**
 * How good a base field is, from 0 to 1: trajectory diversity (how evenly the tracers' paths cover the card, how many different ways they
 * head), times a motion factor so a field that goes nowhere cannot win; and, when a pointer is on the card, a bonus for a field that
 * answers it (how far the pointer's swirl moves the same tracers from where they would have gone). Seeded: same arguments, same score.
 */
export function scoreFlow(params, edits, seed, pointer = null, { M = 48, T = 36, dt = 0.06 } = {}) {
  const rand = rng(seed), base = baseField(params), ed = flatten(edits), tot = makeField(), none = makeField();
  const sx = new Float32Array(M), sy = new Float32Array(M); for (let i = 0; i < M; i++) { sx[i] = rand(); sy[i] = rand(); }
  const run = (field) => {
    const xs = new Float32Array(M * T), ys = new Float32Array(M * T), ang = new Float32Array(M), endx = new Float32Array(M), endy = new Float32Array(M), o = [0, 0, 0, 0]; let len = 0;
    for (let i = 0; i < M; i++) {
      let x = sx[i], y = sy[i]; const ox = x, oy = y;
      for (let t = 0; t < T; t++) { advectOne(field, x, y, dt, 'rk2', o); let dx = o[0] - x, dy = o[1] - y; dx -= Math.round(dx); dy -= Math.round(dy); len += Math.hypot(dx, dy); x = o[0]; y = o[1]; xs[i * T + t] = x; ys[i * T + t] = y; }
      let ex = x - ox, ey = y - oy; ex -= Math.round(ex); ey -= Math.round(ey); ang[i] = wrap01(Math.atan2(ey, ex) / TAU); endx[i] = ex; endy[i] = ey;
    }
    return { xs, ys, ang, endx, endy, mean: len / M };
  };
  composeField(tot, base, ed, none);
  const a = run(tot), cover = occupancyEntropy(a.xs, a.ys, M * T, 8), heads = entropy(a.ang, 8), motion = clamp(a.mean / 0.3, 0, 1);
  const diversity = (0.6 * cover + 0.4 * heads) * motion;
  if (!pointer) return { fitness: diversity, diversity, bonus: 0 };
  const sw = injectSwirl(makeField(), clamp(pointer.x, 0, 1), clamp(pointer.y, 0, 1), 0.9, 0.16), withP = makeField(); composeField(withP, base, ed, sw);
  const b = run(withP); let moved = 0; for (let i = 0; i < M; i++) moved += Math.hypot(b.endx[i] - a.endx[i], b.endy[i] - a.endy[i]);
  const bonus = clamp(moved / M / 0.25, 0, 1);
  return { fitness: 0.75 * diversity + 0.25 * bonus, diversity, bonus };
}
/**
 * One round of the evolutionary loop, the function the Worker runs. msg = { params, edits?, seed, pointer?, cands?, sigma?, gen? }.
 * It scores the current params, mutates `cands` candidates, scores each on the same tracers, and keeps the best only if it beats the
 * current by a margin. Returns { params, fitness, prev, improved, gen, tried, diversity, bonus }.
 */
export function evolveFlow(msg) {
  const cur = { mag: +msg.params.mag, dir: +msg.params.dir, freq: +msg.params.freq }, seed = (msg.seed >>> 0) || 1, rand = rng(seed ^ 0x9e3779b9), n = clamp(Math.floor(msg.cands || 4), 1, 8);
  const here = scoreFlow(cur, msg.edits, seed, msg.pointer);
  let best = cur, top = here, improved = false;
  for (let c = 0; c < n; c++) {
    const cand = mutate(cur, SPEC, rand, 0.7, msg.sigma || 0.15), r = scoreFlow(cand, msg.edits, seed, msg.pointer);
    if (r.fitness > top.fitness + 1e-4) { best = cand; top = r; improved = true; }
  }
  return { params: best, fitness: top.fitness, prev: here.fitness, improved, gen: (msg.gen | 0) + 1, tried: n, diversity: top.diversity, bonus: top.bonus };
}

// ---- the card's numbers ----------------------------------------------------------------------------------------------------------
/** { entropy, activity, consensus, cx, cy } for the first n tracers: where they are spread (occupancy entropy), how fast they go, how much they agree on a heading (|mean velocity| / mean speed), where the fast ones are. */
export function flowMetrics(p, n) {
  if (!n) return { entropy: 0, activity: 0, consensus: 0, cx: 0.5, cy: 0.5 };
  let sp = 0, sx = 0, sy = 0, wx = 0, wy = 0, w = 0;
  for (let i = 0; i < n; i++) { const s = Math.hypot(p.vx[i], p.vy[i]); sp += s; sx += p.vx[i]; sy += p.vy[i]; wx += p.x[i] * s; wy += p.y[i] * s; w += s; }
  return { entropy: occupancyEntropy(p.x, p.y, n, 8), activity: clamp(sp / n / 0.5, 0, 1), consensus: sp > 1e-9 ? clamp(Math.hypot(sx, sy) / sp, 0, 1) : 0, cx: w > 1e-9 ? wx / w : 0.5, cy: w > 1e-9 ? wy / w : 0.5 };
}
/**
 * A tracer's velocity as a CSS shape: a still one is a round drop; the faster it goes the longer it stretches along its heading and
 * the more its corners sharpen into a leaf. { w, h (px), rot (deg), radius (CSS border-radius), speed (0..1) }.
 */
export function inkShape(vx, vy, ink = 0.6) {
  const sp = clamp(Math.hypot(vx, vy) / 0.5, 0, 1), big = 6 + 8 * clamp(ink, 0, 1), r = (a, b) => Math.round(lerp(a, b, sp));
  return { w: Math.round(big * (1 + 2.2 * sp) * 10) / 10, h: Math.round(big * (1 - 0.35 * sp) * 10) / 10, rot: Math.round((Math.atan2(vy, vx) * 180) / Math.PI), speed: Math.round(sp * 100) / 100,
    radius: r(50, 100) + '% ' + r(50, 8) + '% ' + r(50, 100) + '% ' + r(50, 8) + '%' };
}

// ---- the idea (the object lib/field-stage.js runs) ------------------------------------------------------------------------------
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const activeCount = (ink) => Math.round(lerp(MIN_N, MAX_N, clamp(ink, 0, 1)));

export function createFlow(seed) {
  const rand = rng(seed), p = { n: MAX_N, x: new Float32Array(MAX_N), y: new Float32Array(MAX_N), vx: new Float32Array(MAX_N), vy: new Float32Array(MAX_N) };
  const age = new Uint16Array(MAX_N), px = new Float32Array(MAX_N), py = new Float32Array(MAX_N);
  for (let i = 0; i < MAX_N; i++) { p.x[i] = px[i] = rand(); p.y[i] = py[i] = rand(); age[i] = rand.int(400); }
  const s = { seed, rand, p, age, px, py, ink: 0.6, method: 'rk2', params: { ...START }, shown: { ...START }, base: makeField(), edits: makeField(), swirl: makeField(), total: makeField(), editing: false, gen: 0, fit: 0, improved: 0, mode: 'main', t: 0, lastDir: [0, 0] };
  baseField(s.shown, s.base); composeField(s.total, s.base, s.edits, s.swirl);
  return s;
}
/** a new result from the mind: the field moves toward it over the next half second (the direction by the short way round). */
export function adoptMind(s, res) { if (!res || !res.params) return s; s.params = { mag: res.params.mag, dir: res.params.dir, freq: res.params.freq }; s.gen = res.gen | 0; s.fit = res.fitness; if (res.improved) s.improved++; return s; }
export function stepFlow(s, dt, input = {}) {
  dt = clamp(dt, 0.004, 0.05); s.t += dt;
  const k = Math.min(1, dt * 2.5), tg = s.params, sh = s.shown;
  if (Math.abs(tg.mag - sh.mag) + Math.abs(tg.freq - sh.freq) + Math.abs(angleDelta(sh.dir, tg.dir)) > 1e-4) { sh.mag += (tg.mag - sh.mag) * k; sh.freq += (tg.freq - sh.freq) * k; sh.dir = wrap01((sh.dir + angleDelta(sh.dir, tg.dir) * k) / TAU) * TAU; baseField(sh, s.base); }
  decaySwirl(s.swirl, 0.93);
  if (input.over && !s.editing) injectSwirl(s.swirl, input.x, input.y, input.down ? 0.5 : 0.16, 0.14);
  composeField(s.total, s.base, s.edits, s.swirl, input.tilting ? [input.tiltX * 0.12, input.tiltY * 0.12] : null);
  const n = activeCount(s.ink), p = s.p, o = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    s.px[i] = p.x[i]; s.py[i] = p.y[i]; advectOne(s.total, p.x[i], p.y[i], dt, s.method, o); p.x[i] = o[0]; p.y[i] = o[1]; p.vx[i] = o[2]; p.vy[i] = o[3];
    if (++s.age[i] > 520) { s.age[i] = 0; p.x[i] = s.px[i] = s.rand(); p.y[i] = s.py[i] = s.rand(); }
  }
  return s;
}
export const metricsFlow = (s) => flowMetrics(s.p, activeCount(s.ink));
