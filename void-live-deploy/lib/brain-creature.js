// brain-creature, Verse Brain's Lenia creature, from F304 (lenia-gait-evolver, atomeam/a-to-mind.com drafts/). Owner, 2026-10-29: "combine
// all the builds into one entity", "dont fake it". F304 evolved a Lenia creature that walks along +x in a world of its own; here it lives
// beside the brain's working memory (same 64 x 48 torus, cell for cell) and walks to where the brain is thinking (the attention's focus).
//   Lenia: each cell's growth is a Gaussian of a ring-shaped kernel's weighted sum of its neighbours (Chan 2019). Six genes in 0..1 decode
//   to mu, sigma, dt, two ring heights and a shift. The shift moves the kernel's centre away from the cell, which breaks the symmetry and
//   gives the body a gait. Steering is eight such kernels, one per direction: each step uses the one that points nearest to the focus.
//   Online evolution: an antithetic, rank-shaped evolution strategy (OpenAI-ES, as in F304) tries six genomes around its mean, each for
//   TRIAL steps of the creature's real life. A genome's fitness is how far it brought the body toward the focus while it was more than
//   NEAR cells away; a body that dies (mass out of its band, or smeared over the world) scores -1 and is grown again where it fell. The
//   mean moves toward the better ones. Two guards keep it honest: every WINDOW generations the mean is compared with the best mean so
//   far (the anchor) and goes back to it when it scores clearly worse, and the search width shrinks when many trials die.
// Re-measured before it was built in (tools/brain-creature.test.mjs and the drift runs behind it): F304's winner and START both follow a
// moving target for 300 steps on most seeds (36 and 35 of 40 alive; on another 20 seeds F304's was ahead, 1.54 against 1.34). Over 900 steps START keeps 11 of 15 alive and gains 1.15 cells per
// 10 steps, F304's winner keeps 8 and gains 0.47. START came from an offline run of this same ES on this same task. Online, 80
// generations from START lifted the score on unseen seeds from 1.17 to between 1.45 and 1.98 on 6 of 6 seeds.
// It writes a little of its body into the input layer as 'creature', so attention sees where it is. Its ES mean is slow knowledge:
// lib/brain-mind.js knowledgeOf keeps it between visits.
// Pure: no DOM, no clock, no Math.random (its own seeded stream, so it never shifts the other organs' random numbers).
import { clamp } from './field-kit.js';
import { GW, GH, CELLS, deposit } from './brain-workspace.js';

export const R = 6, DIRS = 8, EXT = 12, STEPS = 6, TRIAL = 90, POP = 6, SIGMA = 0.05, LR = 0.5, GENES = 6, WINDOW = 5, DROP = 0.3, NEAR = 4, SIGMA_MIN = 0.01, SIGMA_MAX = 0.08;
export const RANGES = [['mu', 0.10, 0.35], ['sigma', 0.012, 0.060], ['dt', 0.05, 0.20], ['b2', 0, 1], ['b3', 0, 1], ['shift', 0, 0.40]];
/** the genome the offline ES found (es.cjs run 1, 25 generations of 12, seeds 1..50): it follows. */
export const START = [0.464, 0.459, 0.632, 0.646, 0.481, 0.733];
/** F304's own winner (drafts/F304-lenia-gait-evolver/test-result.json best params, encoded): it walks +x and also follows, but over long runs it dies more often than START. */
export const F304_BEST = [0.5616, 0.575, 0.544, 0.3064, 0.4195, 0.724];
const TAU = Math.PI * 2, PW = GW + 2 * EXT, PH = GH + 2 * EXT, MASS_LO = 0.3, MASS_HI = 2.2, SMEAR = 0.2;

export function stream(seed) { let a = (seed * 2654435761 + 7) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const wrapD = (d, n) => d - n * Math.round(d / n);

/** genes in 0..1 to Lenia physics. Pure. */
export function decode(g) { const p = {}; RANGES.forEach(([k, lo, hi], i) => { p[k] = lo + c01(+g[i] || 0) * (hi - lo); }); return p; }
function shell(q, betas) { if (q <= 0 || q >= 1) return 0; const s = q * 3, i = Math.min(2, Math.floor(s)), f = s - i; return betas[i] * Math.exp(4 - 1 / (f * (1 - f) + 1e-9)); }
/** the kernel for one walking direction, as padded-grid offsets and weights (sum 1). Pure. */
export function kernel(p, dirX, dirY) {
  const betas = [1, p.b2, p.b3], sx = -p.shift * R * dirX, sy = -p.shift * R * dirY, ext = Math.min(EXT, Math.ceil(R + Math.abs(sx) + Math.abs(sy)) + 1);
  const k = [], w = []; let sum = 0;
  for (let dy = -ext; dy <= ext; dy++) for (let dx = -ext; dx <= ext; dx++) { const v = shell(Math.hypot(dx - sx, dy - sy) / R, betas); if (v > 1e-4) { k.push(dy * PW + dx); w.push(v); sum += v; } }
  return { k: Int32Array.from(k), w: Float32Array.from(w, (v) => v / sum), ext };
}
const growth = (u, p) => { const d = u - p.mu; return 2 * Math.exp(-d * d / (2 * p.sigma * p.sigma)) - 1; };

/** a world holding one creature with genome g: the eight steering kernels, the body grid and its padded copy. */
export function makeWorld(g) { const w = { A: new Float32Array(CELLS), B: new Float32Array(CELLS), P: new Float32Array(PW * PH), rows: new Uint8Array(GH), cols: new Uint8Array(GW) }; setGenome(w, g); return w; }
export function setGenome(w, g) { w.g = Array.from(g, (v) => c01(+v || 0)); w.p = decode(w.g); w.K = []; for (let d = 0; d < DIRS; d++) w.K.push(kernel(w.p, Math.cos(d / DIRS * TAU), Math.sin(d / DIRS * TAU))); w.ext = Math.max(...w.K.map((k) => k.ext)); }
/** one Lenia step with steering kernel d. Exact and only over the live box grown by the kernel's reach: outside it u = 0, so cells stay 0. */
export function stepWorld(w, d) {
  const { A, B, P, rows, cols, ext, p } = w, K = w.K[d], kk = K.k, ww = K.w, n = kk.length; rows.fill(0); cols.fill(0); let any = false;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (A[y * GW + x] > 0) { rows[y] = 1; cols[x] = 1; any = true; }
  B.fill(0);
  if (any) {
    const R2 = new Uint8Array(GH), C2 = new Uint8Array(GW);
    for (let y = 0; y < GH; y++) if (rows[y]) for (let e = -ext; e <= ext; e++) R2[(y + e + GH) % GH] = 1;
    for (let x = 0; x < GW; x++) if (cols[x]) for (let e = -ext; e <= ext; e++) C2[(x + e + GW) % GW] = 1;
    for (let py = 0; py < PH; py++) { const sy = (((py - EXT) % GH) + GH) % GH; for (let px = 0; px < PW; px++) P[py * PW + px] = A[sy * GW + (((px - EXT) % GW) + GW) % GW]; }
    for (let y = 0; y < GH; y++) { if (!R2[y]) continue; const base = (y + EXT) * PW + EXT; for (let x = 0; x < GW; x++) { if (!C2[x]) continue;
      const c = base + x; let u = 0; for (let i = 0; i < n; i++) u += P[c + kk[i]] * ww[i];
      const v = A[y * GW + x] + p.dt * growth(u, p); B[y * GW + x] = v < 0 ? 0 : v > 1 ? 1 : v; } }
  }
  w.A = B; w.B = A;
}
/** the body's mass, its torus-aware centre in cells, and how many cells it covers. Pure. */
export function bodyOf(A) {
  let m = 0, cx = 0, sx = 0, cy = 0, sy = 0, cover = 0; const tx = TAU / GW, ty = TAU / GH;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const v = A[y * GW + x]; if (!v) continue; m += v; if (v > 0.05) cover++; cx += v * Math.cos(x * tx); sx += v * Math.sin(x * tx); cy += v * Math.cos(y * ty); sy += v * Math.sin(y * ty); }
  return { m, cover, x: (Math.atan2(-sx, -cx) + Math.PI) / tx, y: (Math.atan2(-sy, -cy) + Math.PI) / ty };
}
/** grow a fresh body (a random blob a little wider than the kernel) centred at cell (cx, cy). */
export function seedBody(w, r, cx, cy) {
  w.A.fill(0); const rad = R * 1.3;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const d = Math.hypot(wrapD(x - cx, GW), wrapD(y - cy, GH)); if (d < rad) w.A[y * GW + x] = r() * (1 - d / rad) * 1.2 > 0.25 ? r() * 0.9 + 0.1 : 0; }
  w.body = bodyOf(w.A); w.m0 = w.body.m;
}
/** the direction (0..DIRS-1) from cell (x, y) toward cell (tx, ty) on the torus. Pure. */
export function dirTo(x, y, tx, ty) { const a = Math.atan2(wrapD(ty - y, GH), wrapD(tx - x, GW)); return ((Math.round(a / TAU * DIRS) % DIRS) + DIRS) % DIRS; }
export const distTo = (x, y, tx, ty) => Math.hypot(wrapD(tx - x, GW), wrapD(ty - y, GH));
/** is the body out of its band (dead)? */
const deadOf = (w) => { const r = w.body.m / (w.m0 || 1); return r < MASS_LO ? 'low' : r > MASS_HI ? 'high' : w.body.cover > SMEAR * CELLS ? 'smear' : ''; };

/** how well genome g follows a target that jumps every seg steps, on its own seeded world: cells closer per 10 steps, or -1 + the part
 *  of the run it lived if it died, or -0.5 if it smeared. The measure the offline ES used. Pure. */
export function follow(g, seed, T = 300, seg = 100) {
  const r = stream(seed * 7919 + 3), w = makeWorld(g); seedBody(w, r, GW / 2, GH / 2);
  let tx = 0, ty = 0, gain = 0, d0 = 0;
  for (let t = 0; t < T; t++) {
    if (t % seg === 0) { if (t) gain += d0 - distTo(w.body.x, w.body.y, tx, ty); tx = r() * GW; ty = r() * GH; d0 = distTo(w.body.x, w.body.y, tx, ty); }
    stepWorld(w, dirTo(w.body.x, w.body.y, tx, ty));
    if (t % 4 === 3) { w.body = bodyOf(w.A); const mr = w.body.m / w.m0; if (mr < MASS_LO || mr > MASS_HI) return -1 + t / T; }
  }
  w.body = bodyOf(w.A); gain += d0 - distTo(w.body.x, w.body.y, tx, ty);
  return w.body.cover > SMEAR * CELLS ? -0.5 : gain / T * 10;
}

/** a new creature: the ES (mean at START, or a kept mean), its world and a body in the middle. */
export function makeCreature(seed = 1, mean = START) {
  const r = stream(seed), C = { r, mean: Array.from(mean, (v) => c01(+v || 0)), eps: [], fits: [], k: 0, t: 0, gain: 0, gens: 0, updates: 0, trials: 0, deaths: 0,
    lastFit: 0, genFit: [], x: GW / 2, y: GH / 2, steps: 0, learn: true, sigma: SIGMA, why: { low: 0, high: 0, smear: 0 }, far: 0,
    anchor: { mean: Array.from(mean, (v) => c01(+v || 0)), score: null }, window: [], reverts: 0 };
  newGeneration(C); C.w = makeWorld(candidate(C)); seedBody(C.w, r, GW / 2, GH / 2); C.d = 0;
  return C;
}
function newGeneration(C) { C.eps = []; for (let i = 0; i < POP / 2; i++) { const e = []; for (let d = 0; d < GENES; d++) e.push(gauss(C.r)); C.eps.push(e, e.map((v) => -v)); } C.fits = []; C.k = 0; }
const candidate = (C) => C.mean.map((m, d) => c01(m + C.sigma * C.eps[C.k][d]));
/** close the trial of candidate k with fitness f; after the last, move the mean (rank-shaped, antithetic) and start a new generation. */
function closeTrial(C, f) {
  C.fits.push(f); C.lastFit = f; C.trials++; C.k++; C.t = 0; C.gain = 0; C.far = 0;
  if (C.k < POP) { setGenome(C.w, candidate(C)); return; }
  const fits = C.fits, idx = fits.map((_, i) => i).sort((a, b) => fits[a] - fits[b]), w = new Array(POP);
  idx.forEach((i, rank) => { w[i] = rank / (POP - 1) - 0.5; });
  const spread = fits[idx[POP - 1]] - fits[idx[0]];
  if (C.learn && spread > 0.2) { // a generation where every genome did the same (the body sat on the focus) carries no signal: keep the mean
    for (let d = 0; d < GENES; d++) { let s = 0; for (let i = 0; i < POP; i++) s += w[i] * C.eps[i][d]; C.mean[d] = c01(C.mean[d] + LR * C.sigma * s / POP); }
    C.updates++;
  }
  // how far to explore is learned too: a generation where many died narrows the search, one where none did widens it
  const died = fits.filter((f) => f === -1).length / POP; if (C.learn) C.sigma = clamp(C.sigma * (died > 0.3 ? 0.85 : died === 0 ? 1.1 : 1), SIGMA_MIN, SIGMA_MAX);
  const gf = fits.reduce((a, b) => a + b, 0) / POP; C.genFit.push(Math.round(gf * 100) / 100); if (C.genFit.length > 40) C.genFit.shift();
  C.window.push(gf); if (C.learn && C.window.length === WINDOW) guard(C);
  C.gens++; newGeneration(C); setGenome(C.w, candidate(C));
}
/** the elitist guard. One trial is a noisy measure (the focus may be near or far, the body young or old), so the mean can drift into
 *  physics that die. Every WINDOW generations the window's mean fitness is held against the anchor (the best mean so far and its score):
 *  better becomes the new anchor, much worse goes back to it. A score that stays a little below slowly lowers the anchor, so one lucky
 *  window cannot freeze the learning. */
function guard(C) {
  const s = C.window.reduce((a, b) => a + b, 0) / C.window.length; C.window = [];
  if (C.anchor.score === null || s >= C.anchor.score) C.anchor = { mean: C.mean.slice(), score: s };
  else if (s < C.anchor.score - DROP) { C.mean = C.anchor.mean.slice(); C.reverts++; }
  else C.anchor.score -= 0.1 * (C.anchor.score - s);
}
/** n steps of life toward cell (tx, ty): steer, step, measure, and score the running trial. Returns the steps lived. */
export function live(C, tx, ty, n = STEPS) {
  const w = C.w;
  for (let s = 0; s < n; s++) {
    const before = distTo(w.body.x, w.body.y, tx, ty);
    C.d = dirTo(w.body.x, w.body.y, tx, ty); stepWorld(w, C.d); w.body = bodyOf(w.A); C.steps++; C.t++;
    const dead = deadOf(w); if (dead) { C.deaths++; C.why[dead]++; const x = w.body.m > 0 ? w.body.x : C.x, y = w.body.m > 0 ? w.body.y : C.y; seedBody(w, C.r, x, y); closeTrial(C, -1); continue; }
    if (before > NEAR) { C.gain += before - distTo(w.body.x, w.body.y, tx, ty); C.far++; } // on the focus already, there is nothing to measure
    C.x = w.body.x; C.y = w.body.y;
    if (C.t >= TRIAL) closeTrial(C, C.gain / Math.max(C.far, TRIAL / 3) * 10);
  }
  return n;
}
/** move the body, as it is, so its centre lands on cell (x, y): a drag on the card. The trial goes on (a step's gain is measured from
 *  where the body is, so the move itself scores nothing). */
export function dropCreature(C, x, y) {
  const w = C.w, dx = Math.round(wrapD(x - w.body.x, GW)), dy = Math.round(wrapD(y - w.body.y, GH)), A = w.A, B = w.B;
  for (let yy = 0; yy < GH; yy++) for (let xx = 0; xx < GW; xx++) B[((yy + dy + GH) % GH) * GW + ((xx + dx + GW) % GW)] = A[yy * GW + xx];
  w.A = B; w.B = A; w.body = bodyOf(w.A); C.x = w.body.x; C.y = w.body.y;
}
/** a kept ES mean (knowledgeOf): six numbers in 0..1, or nothing changes. Returns whether it was taken. */
export function loadMean(C, m) {
  if (!Array.isArray(m) || m.length !== GENES || !m.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return false;
  C.mean = m.slice(); C.anchor = { mean: m.slice(), score: null }; C.window = []; return true;
}
/** is the learning going anywhere: mean fitness of the last generations, against the first ones it remembers. Pure. */
export function progress(C) { const g = C.genFit, n = Math.min(5, Math.floor(g.length / 2)); if (n < 1) return null; const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length; return { early: Math.round(avg(g.slice(0, n)) * 100) / 100, late: Math.round(avg(g.slice(-n)) * 100) / 100 }; }

export const creature = {
  id: 'creature', name: 'Creature', job: 'a Lenia creature that walks to where the brain is thinking, and evolves its own physics while it lives',
  want: (b) => 0.2 + 0.6 * clamp((distTo(b.creature.x, b.creature.y, b.focus.x * GW, b.focus.y * GH) - NEAR) / 16, 0, 1),
  run(b) {
    const C = b.creature; live(C, b.focus.x * GW, b.focus.y * GH);
    deposit(b.ws, 'input', C.x / GW, C.y / GH, clamp(C.w.body.m / 400, 0, 0.04), 2, 'creature');
    b.board.creature = { x: Math.round(C.x / GW * 1000) / 1000, y: Math.round(C.y / GH * 1000) / 1000, gen: C.gens, deaths: C.deaths, fit: C.lastFit };
    return 1;
  }
};
