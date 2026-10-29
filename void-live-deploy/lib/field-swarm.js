// field-swarm — swarms, trajectories and implicit fields: seven of Grok's drafts as one pure law module on Verse's field kit (asked by the
// owner, 2026-10-18: "all of groks builds should be what v01ds engine is built on"; drafts in atomeam/a-to-mind.com drafts/). Each draft's
// law is a named variant with the same shape, so the card (skills/swarm-mind.js) and its Worker mind can run any of them:
//   swarm      F-044 + F-030 + F-026 + F-028  two tribes of agents ride a tiny MLP vector field, climb the pointer's fading memory, lean
//                                              toward where the pointer is heading, and compete (engage vs explore) for the stage
//   neural     F-044  Neural Implicit Vector Mind: passive tracers in a continuous field MLP(x, y, pointer proximity) -> velocity
//   memory     F-030  Trajectory Memory Field: the pointer leaves decaying trails in a grid (decay, diffusion, gain, noise) agents climb
//   lattice    F-026  Pointer Trajectory Lattice: an 8x8 intent lattice of the pointer's recent velocity predicts where it goes next
//   compete    F-028  Competitive Minds: boids under two evolving genomes, one rewarded for engagement, one for exploration
//   probes     F-040  Evolved Neural Probe Swarm: a dozen probes steered by a shared MLP 6->8->3, with a connection graph
//   resonance  F-041  Resonance-Seeking Agents: agents lock their phase to a wave field they themselves excite
//   gravity    F-022  Thought Gravity: a typed thought becomes a gravity well (a hash places it), agents fall into the wells
// API: create(seed, { variant, n, genome }) -> state; step(s, dt, input); measure(s) (all the numbers); metrics(s) -> { entropy, activity,
// consensus, cx, cy } each 0..1; fitness(variant, m, tribe); evolveSwarm(arg) (one generation, synchronous, for a Worker or the page).
// No DOM, no clock, no Math.random: everything is a function of its arguments and the seed. At most MAX_AGENTS agents.
// Privacy: the pointer only ever enters as its CURRENT point (and the one before it, for a velocity); the memory grid and the lattice are
// fading fields, and params() (what a seal keeps) holds the law, the genome and counts, never the path, the grids or a typed thought.
import { rng, clamp, wrap01, makeGrid, idx, occupancyEntropy, randomGenome, evolveStep } from './field-kit.js';

export const MAX_AGENTS = 240, SPEED = 0.18, MG = 32, LG = 8, WG = 32, POP = 6, TRIAL = 48, TRIAL_N = 72, MIND_EVERY = 1.5, MAX_WELLS = 8;
const TAU = Math.PI * 2;

// ---- a tiny MLP (F-044, F-040): weights [W1 nh*nin, b1 nh, W2 nout*nh, b2 nout], hidden relu or tanh, outputs tanh -----------------
export const mlpSize = (nin, nh, nout) => nin * nh + nh + nh * nout + nout;
/** out (length nout) = tanh(W2 · act(W1 · inp + b1) + b2). Pure; `out` and `h` are scratch arrays it fills. */
export function mlp(w, inp, nin, nh, nout, relu = true, out = new Float64Array(nout), h = new Float64Array(nh)) {
  const b1 = nin * nh, w2 = b1 + nh, b2 = w2 + nh * nout;
  for (let j = 0; j < nh; j++) { let s = w[b1 + j]; for (let k = 0; k < nin; k++) s += w[j * nin + k] * inp[k]; h[j] = relu ? (s > 0 ? s : 0) : Math.tanh(s); }
  for (let o = 0; o < nout; o++) { let s = w[b2 + o]; for (let j = 0; j < nh; j++) s += w[w2 + o * nh + j] * h[j]; out[o] = Math.tanh(s); }
  return out;
}
const wSpec = (n, extra = {}) => { const s = {}; for (let i = 0; i < n; i++) s['w' + i] = [-2, 2]; return Object.assign(s, extra); };
/** the weight vector of a genome (keys w0..w{n-1}). Pure. */
export const weightsOf = (g, n) => { const w = new Float64Array(n); for (let i = 0; i < n; i++) w[i] = +g['w' + i] || 0; return w; };

// ---- each draft's genome --------------------------------------------------------------------------------------------------------------
const NEURAL_W = mlpSize(3, 8, 2), TRIBE_W = mlpSize(3, 6, 2), PROBE_W = mlpSize(6, 8, 3);
export const SPECS = {
  swarm: wSpec(TRIBE_W, { memory: [0, 1.5], intent: [0, 1.5], chase: [0, 1.5], sep: [0, 1], speed: [0.5, 1.5] }),
  neural: wSpec(NEURAL_W),
  memory: { decay: [0.85, 0.995], diffuse: [0.02, 0.4], gain: [0.1, 0.8], noise: [0, 0.05] },
  lattice: { lead: [0, 0.6], pull: [0.2, 2], decay: [0.9, 0.999] },
  compete: { align: [0, 2], coh: [0, 2], sep: [0, 2], maxSp: [0.5, 2], attract: [0, 2] },
  probes: wSpec(PROBE_W),
  resonance: { lr: [0.01, 0.3], inject: [0.02, 0.3], speed: [0.05, 0.4], freq: [0.2, 2] },
  gravity: { pull: [0.2, 2], damp: [0.9, 0.995], noise: [0, 0.4] }
};
export const VARIANTS = {
  swarm: { fid: 'F-044+F-030+F-026+F-028', title: 'Swarm mind', n: 160, tribes: true },
  neural: { fid: 'F-044', title: 'Neural implicit field', n: 160 },
  memory: { fid: 'F-030', title: 'Trajectory memory field', n: 140 },
  lattice: { fid: 'F-026', title: 'Trajectory intent lattice', n: 200 },
  compete: { fid: 'F-028', title: 'Competitive minds', n: 160, tribes: true },
  probes: { fid: 'F-040', title: 'Neural probe swarm', n: 12 },
  resonance: { fid: 'F-041', title: 'Resonance-seeking agents', n: 24 },
  gravity: { fid: 'F-022', title: 'Thought gravity', n: 180 }
};
export const LAWS = Object.keys(VARIANTS);
const lawOf = (v) => (VARIANTS[v] ? v : 'swarm');
const fix = (g, spec) => Object.fromEntries(Object.entries(spec).map(([k, [lo, hi]]) => [k, clamp(Number.isFinite(+(g && g[k])) ? +g[k] : lo + (hi - lo) / 2, lo, hi)]));
/** a starting genome for a law, the same for the same seed: the "fixed interesting weights" each draft falls back to without a Worker. */
export function seedGenome(variant, seed = 1, tribe = 0) {
  const v = lawOf(variant), r = rng((seed >>> 0) * 31 + 17 + tribe * 101), g = randomGenome(SPECS[v], r);
  if (v === 'swarm') { g.memory = tribe ? 0.3 : 1.1; g.intent = tribe ? 0.2 : 1.0; g.chase = tribe ? 0.1 : 1.2; g.sep = tribe ? 0.6 : 0.3; g.speed = tribe ? 1.2 : 0.9; } // A engages, B explores
  if (v === 'compete') { g.attract = tribe ? 0.2 : 1.4; g.maxSp = tribe ? 1.6 : 1; }
  if (v === 'memory') Object.assign(g, { decay: 0.97, diffuse: 0.18, gain: 0.35, noise: 0.02 });
  if (v === 'resonance') Object.assign(g, { lr: 0.08, inject: 0.15, speed: 0.15, freq: 1 });
  if (v === 'lattice') Object.assign(g, { lead: 0.3, pull: 1, decay: 0.98 });
  if (v === 'gravity') Object.assign(g, { pull: 0.8, damp: 0.96, noise: 0.2 });
  return fix(g, SPECS[v]);
}

// ---- the substrate ----------------------------------------------------------------------------------------------------------------------
/** a fresh swarm for a law. genome: one genome, or { A, B } for a law with two tribes. Deterministic by seed. */
export function create(seed = 1, { variant = 'swarm', n, genome } = {}) {
  const v = lawOf(variant), meta = VARIANTS[v], N = clamp(Math.round(n || meta.n), 1, MAX_AGENTS), rand = rng(seed);
  const s = { variant: v, fid: meta.fid, seed, rand, n: N, x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N),
    tribe: new Uint8Array(N), phase: new Float32Array(N), energy: new Float32Array(N), connect: new Float32Array(N), freq: new Float32Array(N),
    mem: null, wave: null, lat: null, wells: [], t: 0, act: 0, near: 0, align: 0, last: null, dominant: 0, liveA: 0, liveB: 0, graph: 0, resonance: 0 };
  for (let i = 0; i < N; i++) { s.x[i] = rand(); s.y[i] = rand(); s.tribe[i] = i & 1; s.phase[i] = rand() * TAU; s.energy[i] = 0.5; s.connect[i] = 0.5; s.freq[i] = 0.4 + rand() * 1.2; }
  if (v === 'swarm' || v === 'memory') s.mem = makeGrid(MG, MG);
  if (v === 'swarm' || v === 'lattice') s.lat = { sx: new Float32Array(LG * LG), sy: new Float32Array(LG * LG), c: new Float32Array(LG * LG) };
  if (v === 'resonance') s.wave = makeGrid(WG, WG);
  if (v === 'gravity') for (const w of ['idea', 'mind', 'void']) addWell(s, w);
  setGenome(s, genome || (meta.tribes ? { A: seedGenome(v, seed, 0), B: seedGenome(v, seed, 1) } : seedGenome(v, seed)));
  return s;
}
/** swap in the mind's answer (one genome, or { A, B }). Agents keep their places and velocities. */
export function setGenome(s, g) {
  const spec = SPECS[s.variant];
  if (VARIANTS[s.variant].tribes) s.genome = { A: fix(g && (g.A || g), spec), B: fix(g && (g.B || g.A || g), spec) }; else s.genome = fix(g, spec);
  const nw = s.variant === 'swarm' ? TRIBE_W : s.variant === 'neural' ? NEURAL_W : s.variant === 'probes' ? PROBE_W : 0;
  s.w = nw ? (VARIANTS[s.variant].tribes ? [weightsOf(s.genome.A, nw), weightsOf(s.genome.B, nw)] : [weightsOf(s.genome, nw)]) : null;
  return s;
}

// ---- shared pieces -------------------------------------------------------------------------------------------------------------------
const gridAt = (g, n, x, y) => g[idx(Math.min(n - 1, Math.floor(wrap01(x) * n)), Math.min(n - 1, Math.floor(wrap01(y) * n)), n, n)];
/** the gradient of an n*n grid at (x, y) in the unit square, by central differences one cell apart. Pure. */
export function gridGrad(g, n, x, y) { const h = 1 / n; return [(gridAt(g, n, x + h, y) - gridAt(g, n, x - h, y)) / 2, (gridAt(g, n, x, y + h) - gridAt(g, n, x, y - h)) / 2]; }
/** add a Gaussian bump of `amt` (radius r cells) at (x, y) to an n*n grid, capped at `cap`. */
export function inject(g, n, x, y, amt, r = 2, cap = 1) {
  const cx = Math.floor(clamp(x, 0, 0.9999) * n), cy = Math.floor(clamp(y, 0, 0.9999) * n);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = idx(cx + dx, cy + dy, n, n); g[i] = Math.min(cap, g[i] + amt * Math.exp(-(dx * dx + dy * dy) / Math.max(0.5, r * r * 0.6))); }
}
const pdist = (s, i, input) => (input.over ? Math.hypot(input.x - s.x[i], input.y - s.y[i]) : 1);
const move = (s, i, tx, ty, dt, ease) => { s.vx[i] += (tx - s.vx[i]) * ease; s.vy[i] += (ty - s.vy[i]) * ease; s.x[i] = wrap01(s.x[i] + s.vx[i] * dt); s.y[i] = wrap01(s.y[i] + s.vy[i] * dt); };
const noiseV = (s, a) => (s.rand() - 0.5) * a;

/** F-030: one step of the memory kernel { decay, diffuse, gain, noise } on an MG*MG grid; the pointer (only where it is now) injects. */
export function memoryStep(m, k, input, rand, dt = 1 / 60) {
  const f = clamp(dt * 60, 0.25, 3), d = Math.pow(k.decay, f), nx = new Float32Array(m.length);
  for (let y = 0; y < MG; y++) for (let x = 0; x < MG; x++) {
    const i = y * MG + x, nb = (m[idx(x + 1, y, MG, MG)] + m[idx(x - 1, y, MG, MG)] + m[idx(x, y + 1, MG, MG)] + m[idx(x, y - 1, MG, MG)]) / 4;
    nx[i] = clamp(m[i] * d + (nb - m[i]) * k.diffuse * f + (rand() - 0.5) * k.noise * 0.5 * f, 0, 1);
  }
  m.set(nx);
  if (input && input.over) inject(m, MG, input.x, input.y, k.gain * (input.down ? 1.6 : 1) * 0.4 * f, 2);
  return m;
}
/** F-026: the intent lattice learns the pointer's velocity per cell (exponential moving average) and forgets with `decay`. Only the last
 *  point is kept, to know the velocity. Returns the lattice. */
export function latticeStep(s, k, input, dt = 1 / 60) {
  const L = s.lat, f = clamp(dt * 60, 0.25, 3), d = Math.pow(k.decay, f);
  for (let i = 0; i < L.c.length; i++) { L.c[i] *= d; L.sx[i] *= d; L.sy[i] *= d; }
  if (input && input.over) {
    if (s.last) {
      const vx = (input.x - s.last.x) / Math.max(dt, 1e-3), vy = (input.y - s.last.y) / Math.max(dt, 1e-3), a = 0.25;
      if (Math.abs(vx) < 5 && Math.abs(vy) < 5) { const c = Math.min(LG - 1, Math.floor(input.x * LG)) + LG * Math.min(LG - 1, Math.floor(input.y * LG)); L.sx[c] += (vx - L.sx[c]) * a; L.sy[c] += (vy - L.sy[c]) * a; L.c[c] = Math.min(1, L.c[c] + a); }
    }
    s.last = { x: input.x, y: input.y };
  } else s.last = null;
  return L;
}
/** the lattice's strongest cells as predictions { x, y, s } (cell centre pushed ahead by its velocity times `lead` seconds). Pure. */
export function predictions(L, lead = 0.3, top = 3) {
  const out = [];
  for (let i = 0; i < L.c.length; i++) { if (L.c[i] < 0.02) continue; const mag = Math.hypot(L.sx[i], L.sy[i]); out.push({ x: clamp((i % LG + 0.5) / LG + L.sx[i] * lead, 0, 1), y: clamp((Math.floor(i / LG) + 0.5) / LG + L.sy[i] * lead, 0, 1), s: Math.min(1, mag * 0.4 + L.c[i] * 0.6) }); }
  return out.sort((a, b) => b.s - a.s).slice(0, top);
}
/** F-022: where a thought lands, from its words alone (a string hash), in 0.1..0.9 each way, and its starting strength. Pure. */
export function wellOf(phrase) {
  const p = String(phrase || '').toLowerCase().trim(); let hx = 0, hy = 0, hs = 7;
  for (let i = 0; i < p.length; i++) { hx = (hx * 31 + p.charCodeAt(i)) % 10000; hy = (hy * 37 + p.charCodeAt(i) * 3) % 10000; hs = (hs * 41 + p.charCodeAt(i)) % 9973; }
  return { x: (hx / 10000) * 0.8 + 0.1, y: (hy / 10000) * 0.8 + 0.1, strength: 0.6 + (hs / 9973) * 0.4 };
}
/** add a thought's well: older wells step aside (repulsion inside 0.15) and fade a little; at most MAX_WELLS (the oldest goes). The words
 *  themselves are not kept, only the place and strength. Returns the wells. */
export function addWell(s, phrase) {
  const w = wellOf(phrase);
  for (const o of s.wells) { const dx = w.x - o.x, dy = w.y - o.y, d = Math.hypot(dx, dy) || 0.01; if (d < 0.15) { const push = (0.15 - d) * 0.5; o.x = clamp(o.x - (dx / d) * push, 0.05, 0.95); o.y = clamp(o.y - (dy / d) * push, 0.05, 0.95); } o.strength = Math.max(0.2, o.strength * 0.995); }
  s.wells.push({ x: w.x, y: w.y, strength: w.strength }); while (s.wells.length > MAX_WELLS) s.wells.shift();
  return s.wells;
}
const wellPull = (s, i, pull) => { let ax = 0, ay = 0; for (const w of s.wells) { const dx = w.x - s.x[i], dy = w.y - s.y[i], d2 = dx * dx + dy * dy + 0.0011; ax += dx * w.strength * pull / d2; ay += dy * w.strength * pull / d2; } return [ax, ay]; };

// ---- the laws, one per draft ---------------------------------------------------------------------------------------------------------
const scratch = { inp: new Float64Array(6), out: new Float64Array(3), h: new Float64Array(8) };
const LAW = {
  // F-044 + F-030 + F-026 + F-028: velocity = the tribe's MLP field + memory climb + intent pull + pointer chase + thought wells + a little separation
  swarm(s, dt, input, ease) {
    const k = s.genome, preds = predictions(s.lat, 0.3);
    memoryStep(s.mem, { decay: 0.97, diffuse: 0.15, gain: 0.5, noise: 0.01 }, input, s.rand, dt); latticeStep(s, { decay: 0.98 }, input, dt);
    for (let i = 0; i < s.n; i++) {
      const t = s.tribe[i], g = t ? k.B : k.A, w = s.w[t], pd = pdist(s, i, input), boost = t === s.dominant ? 1.15 : 0.85;
      scratch.inp[0] = s.x[i] * 2 - 1; scratch.inp[1] = s.y[i] * 2 - 1; scratch.inp[2] = Math.exp(-pd * 4);
      const o = mlp(w, scratch.inp, 3, 6, 2, true, scratch.out, scratch.h);
      let tx = o[0] * SPEED * g.speed * boost, ty = o[1] * SPEED * g.speed * boost;
      const [gx, gy] = gridGrad(s.mem, MG, s.x[i], s.y[i]); tx += gx * g.memory * 6; ty += gy * g.memory * 6;
      if (preds.length) { const p = preds[i % preds.length]; tx += (p.x - s.x[i]) * g.intent * p.s * 0.8; ty += (p.y - s.y[i]) * g.intent * p.s * 0.8; }
      if (input.over && g.chase > 0) { const dx = input.x - s.x[i], dy = input.y - s.y[i], d = Math.hypot(dx, dy) || 1; tx += (dx / d) * g.chase * SPEED * Math.min(1, d * 6); ty += (dy / d) * g.chase * SPEED * Math.min(1, d * 6); } // F-028's attract gene
      if (s.wells.length) { const [ax, ay] = wellPull(s, i, 0.02); tx += ax; ty += ay; }
      if (g.sep > 0) for (let j = i + 1; j < Math.min(s.n, i + 24); j++) // separation from the next 24 agents only: cheap, and enough to stop clumps { const dx = s.x[j] - s.x[i], dy = s.y[j] - s.y[i], d2 = dx * dx + dy * dy; if (d2 < 0.0016 && d2 > 1e-9) { const f = g.sep * 0.02 / Math.sqrt(d2); tx -= dx * f; ty -= dy * f; } }
      move(s, i, tx + noiseV(s, 0.02), ty + noiseV(s, 0.02), dt, ease);
    }
    const m = measure(s); // F-028: the tribes compete for the stage; the one doing better at its own reward leads (10% hysteresis)
    s.liveA = s.liveA * 0.95 + fitness('swarm', m, 0) * 0.05; s.liveB = s.liveB * 0.95 + fitness('swarm', m, 1) * 0.05;
    if (!s.hold) { if (s.dominant === 0 && s.liveB > s.liveA * 1.1) s.dominant = 1; else if (s.dominant === 1 && s.liveA > s.liveB * 1.1) s.dominant = 0; }
  },
  // F-044: passive tracers sample the continuous field MLP(x, y, exp(-4 * distance to the pointer)) -> velocity
  neural(s, dt, input, ease) {
    const w = s.w[0];
    for (let i = 0; i < s.n; i++) {
      scratch.inp[0] = s.x[i] * 2 - 1; scratch.inp[1] = s.y[i] * 2 - 1; scratch.inp[2] = Math.exp(-pdist(s, i, input) * 4);
      const o = mlp(w, scratch.inp, 3, 8, 2, true, scratch.out, scratch.h);
      move(s, i, o[0] * SPEED * 1.4 + (input.tiltX || 0) * 0.03 + noiseV(s, 0.03), o[1] * SPEED * 1.4 + (input.tiltY || 0) * 0.03 + noiseV(s, 0.03), dt, ease);
    }
  },
  // F-030: the pointer writes a fading memory; agents climb it and wander
  memory(s, dt, input, ease) {
    memoryStep(s.mem, s.genome, input, s.rand, dt);
    for (let i = 0; i < s.n; i++) { const [gx, gy] = gridGrad(s.mem, MG, s.x[i], s.y[i]); s.phase[i] += noiseV(s, 0.6); move(s, i, gx * 8 + Math.cos(s.phase[i]) * SPEED * 0.35, gy * 8 + Math.sin(s.phase[i]) * SPEED * 0.35, dt, ease); }
  },
  // F-026: agents go where the lattice predicts the pointer is heading (the strongest few cells, each pushed ahead by its velocity)
  lattice(s, dt, input, ease) {
    const g = s.genome; latticeStep(s, g, input, dt); const preds = predictions(s.lat, g.lead);
    for (let i = 0; i < s.n; i++) {
      let tx = noiseV(s, 0.06), ty = noiseV(s, 0.06);
      if (preds.length) { const p = preds[i % preds.length], dx = p.x - s.x[i], dy = p.y - s.y[i], d = Math.hypot(dx, dy) || 1; if (d < 0.45) { tx += (dx / d) * g.pull * p.s * SPEED; ty += (dy / d) * g.pull * p.s * SPEED; } }
      else { tx += (0.5 - s.y[i]) * 0.05; ty += (s.x[i] - 0.5) * 0.05; } // nothing learned yet: a slow drift round the middle
      move(s, i, tx, ty, dt, ease);
    }
  },
  // F-028: boids under the dominant mind's genome (A engages with the pointer, B explores); dominance switches with 10% hysteresis
  compete(s, dt, input, ease) {
    const g = s.dominant ? s.genome.B : s.genome.A, R2 = 0.01, S2 = 0.0016;
    for (let i = 0; i < s.n; i++) {
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, nn = 0;
      for (let j = 0; j < s.n; j++) { if (i === j) continue; let dx = s.x[j] - s.x[i], dy = s.y[j] - s.y[i]; dx -= Math.round(dx); dy -= Math.round(dy); const d2 = dx * dx + dy * dy; if (d2 < R2 && d2 > 1e-9) { ax += s.vx[j]; ay += s.vy[j]; cx += dx; cy += dy; nn++; if (d2 < S2) { const d = Math.sqrt(d2); sx -= dx / d; sy -= dy / d; } } }
      if (nn) { ax /= nn; ay /= nn; cx /= nn; cy /= nn; }
      let tx = s.vx[i] + (ax - s.vx[i]) * g.align * 0.3 + cx * g.coh * 2 + sx * g.sep * 0.02, ty = s.vy[i] + (ay - s.vy[i]) * g.align * 0.3 + cy * g.coh * 2 + sy * g.sep * 0.02;
      if (input.over) { const dx = input.x - s.x[i], dy = input.y - s.y[i], d = Math.hypot(dx, dy) || 1; const a = g.attract * (s.dominant ? 0.6 : 1.4) * 0.06; tx += (dx / d) * a; ty += (dy / d) * a; }
      tx += noiseV(s, 0.02); ty += noiseV(s, 0.02);
      const sp = Math.hypot(tx, ty), cap = g.maxSp * SPEED; if (sp > cap) { tx = tx / sp * cap; ty = ty / sp * cap; } else if (sp < SPEED * 0.2) { tx += (s.rand() - 0.5) * 0.04; ty += (s.rand() - 0.5) * 0.04; }
      move(s, i, tx, ty, dt, ease);
    }
    const m = measure(s); s.liveA = s.liveA * 0.95 + fitness('compete', m, 0) * 0.05; s.liveB = s.liveB * 0.95 + fitness('compete', m, 1) * 0.05;
    if (!s.hold) { if (s.dominant === 0 && s.liveB > s.liveA * 1.1) s.dominant = 1; else if (s.dominant === 1 && s.liveA > s.liveB * 1.1) s.dominant = 0; }
  },
  // F-040: each probe reads (dx, dy, distance to the pointer, its velocity, its connection) and a shared MLP 6->8->3 answers (vx, vy, connect)
  probes(s, dt, input, ease) {
    const w = s.w[0], k = clamp(dt * 60, 0.25, 3), px = input.over ? input.x : 0.5, py = input.over ? input.y : 0.5;
    for (let i = 0; i < s.n; i++) {
      const I = scratch.inp; I[0] = px - s.x[i]; I[1] = py - s.y[i]; I[2] = Math.hypot(I[0], I[1]); I[3] = s.vx[i] / SPEED; I[4] = s.vy[i] / SPEED; I[5] = s.connect[i];
      const o = mlp(w, I, 6, 8, 3, false, scratch.out, scratch.h);
      s.vx[i] = s.vx[i] * Math.pow(0.8, k) + o[0] * SPEED * 0.5 * k; s.vy[i] = s.vy[i] * Math.pow(0.8, k) + o[1] * SPEED * 0.5 * k;
      const sp = Math.hypot(s.vx[i], s.vy[i]), cap = SPEED * 2; if (sp > cap) { s.vx[i] *= cap / sp; s.vy[i] *= cap / sp; }
      s.connect[i] = ((s.connect[i] + o[2] + 1) / 2) * 0.5 + 0.25;
      s.x[i] = clamp(s.x[i] + s.vx[i] * dt, 0.03, 0.97); s.y[i] = clamp(s.y[i] + s.vy[i] * dt, 0.03, 0.97);
    }
    s.graph = graphEdges(s).length;
  },
  // F-041: a wave field (diffusion and decay) the agents excite; each agent turns its phase toward the field's local beat and moves along it
  resonance(s, dt, input, ease) {
    const g = s.genome, f = clamp(dt * 60, 0.25, 3), W = s.wave, nx = new Float32Array(W.length); let lock = 0;
    for (let y = 0; y < WG; y++) for (let x = 0; x < WG; x++) { const i = y * WG + x, lap = W[idx(x - 1, y, WG, WG)] + W[idx(x + 1, y, WG, WG)] + W[idx(x, y - 1, WG, WG)] + W[idx(x, y + 1, WG, WG)] - 4 * W[i]; nx[i] = clamp(W[i] * Math.pow(0.96, f) + lap * 0.18 * Math.min(1, f), 0, 4); }
    W.set(nx);
    if (input.down) inject(W, WG, input.x, input.y, 3.5 * 0.3 * f, 1, 4); // a press is a query wave (F-041)
    for (let i = 0; i < s.n; i++) {
      const local = gridAt(W, WG, s.x[i], s.y[i]), target = Math.atan2(Math.sin(s.t * s.freq[i] * g.freq + local), 1);
      let dp = target - s.phase[i]; dp -= TAU * Math.round(dp / TAU); s.phase[i] += dp * g.lr * f;
      s.energy[i] = clamp(s.energy[i] + (local * 0.05 + 0.008 * Math.cos(dp) - 0.006) * f, 0.05, 1); // the draft's energy (field minus a cost), plus a reward for being in phase: in tune agents move
      const sp = s.energy[i] * g.speed; move(s, i, Math.cos(s.phase[i]) * sp, Math.sin(s.phase[i]) * sp, dt, ease);
      inject(W, WG, s.x[i], s.y[i], s.energy[i] * g.inject * f, 0, 4); lock += Math.abs(Math.cos(s.phase[i] - local));
    }
    s.resonance = lock / s.n;
  },
  // F-022: agents fall toward the thought wells (strength / distance), with noise and damping
  gravity(s, dt, input, ease) {
    const g = s.genome, k = clamp(dt * 60, 0.25, 3), damp = Math.pow(g.damp, k);
    for (let i = 0; i < s.n; i++) {
      const [ax, ay] = wellPull(s, i, g.pull * 0.0012);
      s.vx[i] = (s.vx[i] + (ax + noiseV(s, g.noise * 0.02)) * k) * damp; s.vy[i] = (s.vy[i] + (ay + noiseV(s, g.noise * 0.02)) * k) * damp;
      const sp = Math.hypot(s.vx[i], s.vy[i]), cap = SPEED * 3; if (sp > cap) { s.vx[i] *= cap / sp; s.vy[i] *= cap / sp; }
      s.x[i] = wrap01(s.x[i] + s.vx[i] * dt); s.y[i] = wrap01(s.y[i] + s.vy[i] * dt);
    }
  }
};

/** one step of the swarm's law. dt in seconds; input { over, x, y, down, tiltX, tiltY } in the unit square (the pointer as it is now). */
export function step(s, dt = 1 / 60, input = {}) {
  dt = clamp(+dt || 1 / 60, 1 / 240, 0.05); const ease = Math.min(1, dt * 4);
  LAW[s.variant](s, dt, input || {}, ease);
  let sp = 0, sx = 0, sy = 0, near = 0, nearA = 0, nA = 0;
  for (let i = 0; i < s.n; i++) { sp += Math.hypot(s.vx[i], s.vy[i]); sx += s.vx[i]; sy += s.vy[i]; const close = input && input.over && Math.hypot(input.x - s.x[i], input.y - s.y[i]) < 0.12; if (close) near++; if (!s.tribe[i]) { nA++; if (close) nearA++; } }
  s.act = sp / s.n / SPEED; s.align = sp > 1e-9 ? Math.hypot(sx, sy) / sp : 0; s.near = near / s.n; s.nearA = nA ? nearA / nA : 0; s.t += dt;
  return s;
}
/** F-040's graph: pairs of probes whose mean connection is above 0.4 and that sit within 0.4 of each other. [[i, j, strength]]. Pure. */
export function graphEdges(s) {
  const out = []; if (s.n > 40) return out;
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) { const st = (s.connect[i] + s.connect[j]) / 2; if (st > 0.4 && Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]) < 0.4) out.push([i, j, st]); }
  return out;
}

// ---- the numbers ------------------------------------------------------------------------------------------------------------------------
/** every number the laws and their fitness read: entropy (occupancy), energy, moderate (best near 0.8 of SPEED), near (all agents) and nearA (tribe A), align, structure and
 *  response (F-030), confidence (F-026), resonance (F-041), graph (F-040), coherence (F-022), liveA/liveB/dominant (F-028), cx, cy. */
export function measure(s) {
  let cx = 0, cy = 0; for (let i = 0; i < s.n; i++) { cx += s.x[i]; cy += s.y[i]; } cx /= s.n; cy /= s.n;
  const energy = clamp(s.act / 2, 0, 1), m = { entropy: occupancyEntropy(s.x, s.y, s.n, s.n < 40 ? 4 : 8), energy, moderate: 1 - Math.min(1, Math.abs(s.act - 0.8) / 0.8), near: clamp(s.near * 4, 0, 1), nearA: clamp((s.nearA || 0) * 4, 0, 1), align: clamp(s.align, 0, 1), cx, cy, structure: 0, response: 0, confidence: 0, resonance: s.resonance || 0, graph: 0, coherence: 0, liveA: s.liveA, liveB: s.liveB, dominant: s.dominant };
  if (s.mem) { let a = 0, q = 0, on = 0; for (let i = 0; i < s.mem.length; i++) { a += s.mem[i]; q += s.mem[i] * s.mem[i]; } a /= s.mem.length; q = q / s.mem.length - a * a; for (let i = 0; i < s.n; i++) if (gridAt(s.mem, MG, s.x[i], s.y[i]) > 0.08) on++; m.structure = clamp(Math.sqrt(Math.max(0, q)) * 6, 0, 1); m.response = clamp(a * 8, 0, 1); m.onMemory = on / s.n; }
  if (s.lat) { const p = predictions(s.lat, 0.3, 1); m.confidence = p.length ? p[0].s : 0; }
  if (s.variant === 'probes') { let pd = 0, dv = 0, c = 0; for (let i = 0; i < s.n; i++) { pd += Math.hypot(s.x[i] - 0.5, s.y[i] - 0.5); c += s.connect[i]; } dv = clamp(pd / s.n / 0.5, 0, 1); m.graph = clamp(c / s.n, 0, 1); m.diversity = dv; m.edges = graphEdges(s).length; }
  if (s.wells.length) { let inw = 0; for (let i = 0; i < s.n; i++) if (s.wells.some((w) => Math.hypot(w.x - s.x[i], w.y - s.y[i]) < 0.12)) inw++; m.coherence = inw / s.n; m.wellPower = clamp(s.wells.reduce((t, w) => t + w.strength, 0) / 6, 0, 1); }
  return m;
}
/** what each law's mind rewards, 0..1. tribe 0 is mind A (engage), tribe 1 mind B (explore) for the laws with two minds. Pure. */
export function fitness(variant, m, tribe = 0) {
  switch (lawOf(variant)) {
    case 'swarm': return tribe ? 0.4 * m.entropy + 0.3 * m.moderate + 0.3 * (1 - m.near) : 0.6 * (m.nearA ?? m.near) + 0.2 * (m.onMemory || 0) + 0.2 * m.moderate; // A: its own agents with you; B: spread out, away
    case 'neural': return 0.5 * m.entropy + 0.3 * m.moderate + 0.2 * m.near;                  // F-044: spread + near the pointer + no extreme speeds
    case 'memory': return 0.5 * m.structure + 0.3 * m.response + 0.2 * (m.onMemory || 0);    // F-030: structure + energy + response
    case 'lattice': return 0.6 * m.near + 0.2 * m.entropy + 0.2 * m.moderate;                 // F-026: be where the pointer is going
    case 'compete': return tribe ? 0.5 * m.energy + 0.5 * m.entropy : m.near;                 // F-028: B explores, A engages
    case 'probes': return clamp((clamp(1 - (m.pointerDist ?? 0.5), 0, 1) * 2 + (m.diversity || 0) + m.graph * 0.5) / 3.5, 0, 1); // F-040
    case 'resonance': return 0.6 * m.resonance + 0.4 * m.entropy;                             // F-041
    case 'gravity': return 0.5 * m.entropy + 0.5 * m.coherence;                               // F-022: spread out, yet held by the thoughts
  }
  return 0;
}
/** the kit's five numbers, each 0..1: entropy, activity (energy), consensus (what the law agrees on), cx, cy. */
export function metrics(s) {
  const m = measure(s), consensus = { swarm: m.dominant ? 1 - m.near : m.near, neural: m.align, memory: m.onMemory || 0, lattice: m.confidence, compete: m.align, probes: m.graph, resonance: m.resonance, gravity: m.coherence }[s.variant];
  return { entropy: m.entropy, activity: m.energy, consensus: clamp(consensus || 0, 0, 1), cx: m.cx, cy: m.cy };
}

// ---- the mind ---------------------------------------------------------------------------------------------------------------------------
/** a pointer that circles where the person last pointed (or the middle): the rollouts never replay anyone's path. Pure. */
export const orbit = (k, c) => ({ over: true, down: false, x: clamp((c ? c.x : 0.5) + 0.16 * Math.cos(k * 0.15), 0, 1), y: clamp((c ? c.y : 0.5) + 0.12 * Math.sin(k * 0.15), 0, 1) });
/** a genome's score: TRIAL steps of TRIAL_N agents from the same seed under the orbiting pointer; tribe picks the reward. Pure. */
export function rollout(variant, genome, { seed = 1, pointer = null, tribe = 0, steps = TRIAL, n } = {}) {
  const v = lawOf(variant), s = create(seed, { variant: v, n: n || Math.min(TRIAL_N, VARIANTS[v].n), genome: VARIANTS[v].tribes ? { A: genome, B: genome } : genome });
  if (VARIANTS[v].tribes) { s.dominant = tribe; s.hold = true; } // a rollout judges one mind: it keeps the stage
  let pd = 0; for (let k = 0; k < steps; k++) { const inp = orbit(k, pointer); step(s, 1 / 30, inp); if (v === 'probes') { let d = 0; for (let i = 0; i < s.n; i++) d += Math.hypot(inp.x - s.x[i], inp.y - s.y[i]); pd += d / s.n; } }
  const m = measure(s); if (v === 'probes') m.pointerDist = pd / steps;
  return Math.round(fitness(v, m, tribe) * 1e4) / 1e4;
}
/** one generation, for a Worker or the page: arg { variant, pop, seed, gen, pointer } -> { variant, pop, best, fitness, gen }. A law with
 *  two minds keeps two populations ({ A, B }), each judged by its own reward. Synchronous and deterministic for its inputs; the best two
 *  of each population are kept as they are, so the best never gets worse. */
export function evolveSwarm(arg = {}) {
  const v = lawOf(arg.variant), spec = SPECS[v], seed = (+arg.seed || 1) >>> 0, gen = +arg.gen || 0, r = rng(seed * 7919 + gen + 1);
  const pointer = arg.pointer && Number.isFinite(+arg.pointer.x) ? { x: clamp(+arg.pointer.x, 0, 1), y: clamp(+arg.pointer.y, 0, 1) } : null;
  const one = (pop, tribe) => {
    pop = (Array.isArray(pop) && pop.length ? pop : [seedGenome(v, seed, tribe), ...Array.from({ length: POP - 1 }, () => randomGenome(spec, r))]).map((g) => fix(g, spec));
    const fits = pop.map((g) => rollout(v, g, { seed, pointer, tribe })); let bi = 0; fits.forEach((f, i) => { if (f > fits[bi]) bi = i; });
    return { pop: evolveStep(pop, fits, spec, r, { elite: 2, rate: 0.2, sigma: 0.12 }).map((g) => fix(g, spec)), best: pop[bi], fit: fits[bi] };
  };
  if (VARIANTS[v].tribes) { const a = one(arg.pop && arg.pop.A, 0), b = one(arg.pop && arg.pop.B, 1); return { variant: v, pop: { A: a.pop, B: b.pop }, best: { A: a.best, B: b.best }, fitness: Math.max(a.fit, b.fit), fitA: a.fit, fitB: b.fit, gen: gen + 1 }; }
  const o = one(arg.pop, 0); return { variant: v, pop: o.pop, best: o.best, fitness: o.fit, gen: gen + 1 };
}

// ---- what a seal keeps --------------------------------------------------------------------------------------------------------------------
const round = (g) => Object.fromEntries(Object.entries(g || {}).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
/** the facts a seal keeps: the law, its draft, the genome (rounded) and counts. Never the pointer's path, the grids or a thought's words. */
export function params(s) { return { law: s.variant, fid: s.fid, agents: s.n, wells: s.wells.length, genome: VARIANTS[s.variant].tribes ? { A: round(s.genome.A), B: round(s.genome.B) } : round(s.genome) }; }
