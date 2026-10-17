// field-vector — F-033, the evolving vector field mind (Grok's frontier idea, asked by the owner, 2026-10-17: "all of Grok's ideas are to be
// added to Void"; draft atomeam/a-to-mind.com drafts/F033-vector-field-mind). Particles are carried by a coarse 8x6 grid of control vectors
// (angle and magnitude per cell, 48 vectors), and a small evolutionary mind (6 genomes) reshapes that grid for the flow it wants: spread-out
// paths, moderate energy, and particles near where someone is pointing. This is the pure law: genome, bilinear field, advection step, the
// field's REAL local divergence and curl (central finite differences on the control grid, not the draft's global sums), the fitness
// (a short headless rollout, deterministic by seed), the metric -> morph mapping and the seal. No DOM, no clock, no Worker: lib/field-vector-worker.js
// only schedules `think`; lib/field-stage.js draws. The tradeoff to name: a coarse grid is cheap and stable and a genome is 98 numbers, but it can
// only make flows the size of a cell; the way out is finer grids, multi-scale fields, and WebGPU compute (docs/playbooks/field-mind.md).
import { rng, clamp, makeParticles, occupancyEntropy, randomGenome, evolveStep, morphOf, sealSync, map01 } from './field-kit.js';

export const COLS = 8, ROWS = 6, CELLS = COLS * ROWS, TAU = Math.PI * 2;
export const POINTER_R = 0.22; // a pointer pulls only particles inside this radius (unit square); outside it costs nothing
export const SPEED = 0.16;     // unit squares a second at magnitude 1
export const DIV_CURL_NORM = 8; // |div| + |curl| of this size (1/s, grid units) counts as full ink density
export const MIND_EVERY = 1.0;  // seconds of field time between thoughts: the mind runs at about 1 Hz
export const META_BASE = { id: 'vector-field-mind', version: '0.1.0-f033', evidence: 'experiment', landedFrom: 'atomeam/a-to-mind.com drafts/F033-vector-field-mind@4d93bd9' };

/** the genome spec: a0..a47 (angle, radians), m0..m47 (magnitude), scale, decay. */
export const SPEC = (() => { const s = {}; for (let i = 0; i < CELLS; i++) { s['a' + i] = [0, TAU]; s['m' + i] = [0.2, 2.5]; } s.scale = [0.4, 1.2]; s.decay = [0.8, 3]; return s; })();
export const newGenome = (rand) => randomGenome(SPEC, rand);
/** a calm genome that is the same everywhere: one gentle swirl. Used when there is no Worker and no time to think. */
export function moderateGenome() { const g = { scale: 0.8, decay: 1.6 }; for (let i = 0; i < CELLS; i++) { const cx = (i % COLS) / (COLS - 1) - 0.5, cy = Math.floor(i / COLS) / (ROWS - 1) - 0.5; g['a' + i] = (Math.atan2(cy, cx) + Math.PI / 2 + TAU) % TAU; g['m' + i] = 0.8 + Math.hypot(cx, cy); } return g; }

/** the control grid as 96 numbers (u,v per cell), the genome's scale applied. Vectors are blended as vectors, never as angles (angles wrap). */
export function fieldOf(g) { const f = new Float32Array(CELLS * 2), k = +g.scale || 1; for (let i = 0; i < CELLS; i++) { const a = +g['a' + i] || 0, m = (+g['m' + i] || 0) * k; f[i * 2] = Math.cos(a) * m; f[i * 2 + 1] = Math.sin(a) * m; } return f; }
/** the field at (x,y) in the unit square, bilinear between cell centres on the grid. Returns [u, v]. */
export function sample(f, x, y) {
  const gx = clamp(x, 0, 1) * (COLS - 1), gy = clamp(y, 0, 1) * (ROWS - 1), i = Math.min(COLS - 2, Math.floor(gx)), j = Math.min(ROWS - 2, Math.floor(gy)), fx = gx - i, fy = gy - j;
  const at = (jj, ii, c) => f[(jj * COLS + ii) * 2 + c];
  const mix = (c) => at(j, i, c) * (1 - fx) * (1 - fy) + at(j, i + 1, c) * fx * (1 - fy) + at(j + 1, i, c) * (1 - fx) * fy + at(j + 1, i + 1, c) * fx * fy;
  return [mix(0), mix(1)];
}
/** the field's divergence and curl at every interior cell by central finite differences (cells are 1/(COLS-1) by 1/(ROWS-1) of the square).
 * { div, curl (Float32Array per interior cell), meanAbsDiv, meanAbsCurl, ink (0..1) }. A pure source has div > 0 and curl 0; a pure swirl the reverse. */
export function divCurl(f) {
  const hx = 1 / (COLS - 1), hy = 1 / (ROWS - 1), div = [], curl = []; let sd = 0, sc = 0;
  for (let j = 1; j < ROWS - 1; j++) for (let i = 1; i < COLS - 1; i++) {
    const u = (jj, ii) => f[(jj * COLS + ii) * 2], v = (jj, ii) => f[(jj * COLS + ii) * 2 + 1];
    const dudx = (u(j, i + 1) - u(j, i - 1)) / (2 * hx), dvdy = (v(j + 1, i) - v(j - 1, i)) / (2 * hy), dvdx = (v(j, i + 1) - v(j, i - 1)) / (2 * hx), dudy = (u(j + 1, i) - u(j - 1, i)) / (2 * hy);
    const d = dudx + dvdy, c = dvdx - dudy; div.push(d); curl.push(c); sd += Math.abs(d); sc += Math.abs(c);
  }
  const n = div.length || 1;
  return { div: Float32Array.from(div), curl: Float32Array.from(curl), meanAbsDiv: sd / n, meanAbsCurl: sc / n, ink: clamp((sd / n + sc / n) / DIV_CURL_NORM, 0, 1) };
}

// ---- the substrate ----------------------------------------------------------------------------------------------------------------
/** a fresh field: n particles, the genome, its grid, and counters. Deterministic by seed. */
export function create(seed = 1, { n = 320, genome } = {}) {
  const rand = rng(seed), g = genome || moderateGenome();
  return { rand, n, p: makeParticles(n, rand), genome: g, field: fieldOf(g), dc: divCurl(fieldOf(g)), t: 0, thinkAt: 0, interact: 0, near: 0, speed: 0, align: 0 };
}
/** swap in a new genome (the mind's answer). The particles keep their velocities and ease toward the new field. */
export function setGenome(s, g) { s.genome = g; s.field = fieldOf(g); s.dc = divCurl(s.field); return s; }
/** one step. input: { over, x, y, down, tiltX } (x,y in the unit square). A pointer attracts only the particles inside POINTER_R (early out on the squared distance). */
export function step(s, dt, input = {}) {
  const p = s.p, decay = +s.genome.decay || 1.5, ease = Math.min(1, decay * dt), rot = (+input.tiltX || 0) * 0.6, cr = Math.cos(rot), sr = Math.sin(rot), R2 = POINTER_R * POINTER_R, pull = input.down ? 2.4 : 1.1;
  let near = 0, sp = 0, sx = 0, sy = 0;
  for (let i = 0; i < p.n; i++) {
    const [u0, v0] = sample(s.field, p.x[i], p.y[i]);
    let tx = (u0 * cr - v0 * sr) * SPEED, ty = (u0 * sr + v0 * cr) * SPEED;
    tx += (s.rand() - 0.5) * 0.01; ty += (s.rand() - 0.5) * 0.01;
    if (input.over) { const dx = input.x - p.x[i], dy = input.y - p.y[i], d2 = dx * dx + dy * dy; if (d2 < R2) { const w = (1 - Math.sqrt(d2) / POINTER_R) * pull * SPEED; const d = Math.sqrt(d2) || 1; tx += (dx / d) * w; ty += (dy / d) * w; near++; } }
    p.vx[i] += (tx - p.vx[i]) * ease; p.vy[i] += (ty - p.vy[i]) * ease;
    p.x[i] = (p.x[i] + p.vx[i] * dt + 1) % 1; p.y[i] = (p.y[i] + p.vy[i] * dt + 1) % 1;
    sp += Math.hypot(p.vx[i], p.vy[i]); sx += p.vx[i]; sy += p.vy[i];
  }
  s.t += dt; s.near = near / p.n; s.interact = input.over ? s.near : s.interact * 0.98; s.speed = sp / p.n / SPEED; s.align = sp > 1e-9 ? Math.hypot(sx, sy) / sp : 0;
  return s;
}
/** the field's numbers: { dispersion, energy, align, ink, div, curl, motion, cx, cy } all 0..1 except div and curl (signed, mean over the grid, 1/s). */
export function measure(s) {
  const p = s.p, dc = s.dc; let cx = 0, cy = 0; for (let i = 0; i < p.n; i++) { cx += p.x[i]; cy += p.y[i]; }
  const sum = (a) => { let t = 0; for (let i = 0; i < a.length; i++) t += a[i]; return a.length ? t / a.length : 0; };
  return { dispersion: occupancyEntropy(p.x, p.y, p.n, 8), energy: clamp(s.speed / 1.5, 0, 1), align: clamp(s.align, 0, 1), ink: dc.ink, div: sum(dc.div), curl: sum(dc.curl), absDiv: dc.meanAbsDiv, absCurl: dc.meanAbsCurl, cx: cx / p.n, cy: cy / p.n };
}
/** the kit's metrics from the field's numbers: dispersion is the entropy, energy and the field's own ink (|div| + |curl|) are the activity, alignment the consensus. */
export function kitMetrics(m) { return { entropy: m.dispersion, activity: clamp(0.5 * m.energy + 0.5 * m.ink, 0, 1), consensus: m.align, cx: m.cx, cy: m.cy }; }
/** the card's morph from the field: the kit morph plus ink density (0..1: sharp and high-contrast when high, soft charcoal when low). */
export function morphField(m, base = 200) { return { ...morphOf(kitMetrics(m), base), ink: Math.round(m.ink * 1000) / 1000 }; }
/** CSS custom properties for the card; --ink-density drives the contrast and blur of the drawing. */
export const inkVars = (m) => ({ '--ink-density': String(Math.round(m.ink * 1000) / 1000) });

// ---- the mind ---------------------------------------------------------------------------------------------------------------------
/** fitness of a genome: a short headless rollout from the same seed, so two genomes are judged on the same particles.
 * 0.5 path diversity (occupancy entropy) + 0.3 moderate energy (best near half speed) + 0.2 interaction (particles near the pointer). pointer: { x, y } or null. */
export function fitness(genome, { seed = 1, steps = 36, n = 96, pointer = null } = {}) {
  const s = create(seed, { n, genome }); const input = pointer ? { over: true, x: pointer.x, y: pointer.y } : {}; let near = 0;
  for (let k = 0; k < steps; k++) { step(s, 1 / 20, input); near += s.near; }
  const m = measure(s), moderate = 1 - Math.min(1, Math.abs(m.energy - 0.5) * 2), inter = pointer ? clamp(near / steps * 4, 0, 1) : 0.5;
  const score = 0.5 * m.dispersion + 0.3 * moderate + 0.2 * inter;
  return { fit: Math.round(score * 1e4) / 1e4, dispersion: m.dispersion, moderate, inter };
}
/** a mind: 6 genomes (the moderate one among them) that gets better one `think` at a time. */
export function createMind(seed = 1) { const r = rng(seed), pop = [moderateGenome(), ...Array.from({ length: 5 }, () => newGenome(r))]; return { seed, gen: 0, pop, fits: pop.map(() => 0), best: pop[0], bestFit: 0 }; }
/** one thought: judge every genome on the same particles (and where the pointer is), keep the best two, breed the rest. Mutates and returns the mind. */
export function think(mind, pointer = null) {
  const seed = mind.seed; // the same particles every thought, so a better score is a better genome and the elite never looks worse
  mind.fits = mind.pop.map((g) => fitness(g, { seed, pointer }).fit);
  let bi = 0; for (let i = 1; i < mind.fits.length; i++) if (mind.fits[i] > mind.fits[bi]) bi = i;
  mind.best = mind.pop[bi]; mind.bestFit = mind.fits[bi];
  mind.pop = evolveStep(mind.pop, mind.fits, SPEC, rng((seed + mind.gen * 7919) ^ 0x9e3779b9), { elite: 2, rate: 0.12, sigma: 0.15 }); mind.gen++;
  return mind;
}

// ---- the seal and the meta ---------------------------------------------------------------------------------------------------------
const roundG = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
/** the seal of a genome with the field's numbers: facts only (the genome and the metrics), never the pointer's path or the particles. */
export function sealField(genome, m) { return sealSync('f033', roundG(genome), { dispersion: m.dispersion, energy: m.energy, align: m.align, ink: m.ink, div: m.div, curl: m.curl }); }
/** the module's meta: { id, version, evidence, genomeHash, landedFrom }. */
export function meta(genome) { return { ...META_BASE, genomeHash: genome ? sealSync('f033', roundG(genome), {}).short : '' }; }
export { map01 };
