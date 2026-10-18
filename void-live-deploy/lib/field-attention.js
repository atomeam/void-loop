// field-attention — ATTENTION as the force law of a field mind. The owner, 2026-10-18: "all of groks builds should be what v01ds engine is
// built on". Four of Grok's drafts (atomeam/a-to-mind.com drafts/) are absorbed here, each as a named variant with the same face:
//   create(seed) -> state, step(s, dt, input), metrics(s) -> { entropy, activity, consensus, cx, cy } (each 0..1)
//   affinity  frontier-webgpu-attention-field  labelled particles with hashed feature vectors; a typed word is an attractor that pulls the
//                                              particles whose features look like it; similar features cluster; the pointer sculpts
//   heads     F-032 attention field mind       two-head scaled dot-product attention IS the force; temperature drifts toward mid entropy
//   lattice   F-029 spatial attention lattice  a grid whose 3x3 update is attention-weighted; a 6-genome mind evolves the attention
//   causal    F-047 causal attention lattice   a grid that attends to the pointer's recent path; attention gradients carry thought nodes
// The top-level create/step/metrics dispatch on s.variant, so one card can switch laws. `think(arg)` is the slow thought for a Worker
// (lib/field-worker.js spawnMind) or the page: cluster analysis for the particle laws, one evolutionary generation for the lattices.
// Pure: no DOM, no clock, no Math.random; every count is capped (MAX_PARTICLES, MAX_QUERIES, MAX_NODES, MAX_HIST).
// The tradeoff to name: all-pairs attention inside a radius is O(n^2) on the CPU, so n stays at or under 240; the drafts' next step is
// WebGPU compute for larger n (docs/playbooks/field-mind.md). The skill is skills/attention-field-mind.js, tested by tools/field-attention.test.mjs.
import { rng, clamp, makeGrid, entropy, occupancyEntropy, stats, randomGenome, evolveStep } from './field-kit.js';

export const VARIANTS = ['affinity', 'heads', 'lattice', 'causal'];
export const SOURCES = {
  affinity: 'frontier-webgpu-attention-field', heads: 'F-032 attention-field-mind', lattice: 'F-029 spatial-attention-lattice-mind', causal: 'F-047 causal-attention-lattice-mind'
};
export const MAX_PARTICLES = 240, MAX_QUERIES = 4, MAX_NODES = 8, MAX_HIST = 12, MAX_WORD = 32, MIND_EVERY = 1;
export const D = 8; // feature dimensions
// the draft's concepts (frontier-webgpu-attention-field): every particle carries one, and its features are the concept's hash
export const CONCEPTS = ['ledger', 'webgpu', 'attention', 'local-ai', 'spatial', 'void', 'canvas', 'particle', 'cluster', 'assimilate', 'frontier', 'novel', 'compute', 'shader', 'interaction'];

// ---- hashed feature vectors -------------------------------------------------------------------------------------------------------
/** FNV-1a of a string, 32-bit unsigned. Pure. */
export function fnv(str) { let h = 0x811c9dc5; const t = String(str); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
/** a word as a cleaned token: lowercase, letters, digits and dashes only, at most MAX_WORD long ('' when nothing is left). Pure. */
export const cleanWord = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, MAX_WORD);
/** a word's feature vector: the hashing trick over its character trigrams (with edge marks), each trigram adding +-1 to one of D dims,
 *  then normalised. Words that share spelling share features ("cluster" ~ "clusters"); unrelated words land near orthogonal. Pure. */
export function hashFeat(word) {
  const w = '^' + cleanWord(word) + '$', f = new Array(D).fill(0);
  for (let i = 0; i + 3 <= w.length; i++) { const h = fnv(w.slice(i, i + 3)); f[h % D] += (h >>> 16) & 1 ? 1 : -1; }
  if (w.length < 3) { const h = fnv(w); f[h % D] += 1; }
  let n = 0; for (const v of f) n += v * v; n = Math.sqrt(n) || 1;
  return f.map((v) => v / n);
}
/** cosine of two unit feature vectors, -1..1. Pure. */
export const sim = (a, b) => { let t = 0; for (let k = 0; k < D; k++) t += a[k] * b[k]; return t; };
/** where a word's attractor sits in the unit square: from its hash, kept 0.2..0.8 so it is never on an edge. Pure. */
export const wordSpot = (word) => { const h = fnv('spot:' + cleanWord(word)); return { x: 0.2 + 0.6 * ((h & 0xffff) / 0xffff), y: 0.2 + 0.6 * ((h >>> 16) / 0xffff) }; };

// ---- particles, shared by affinity and heads ----------------------------------------------------------------------------------------
function particles(rand, n, labels) {
  const p = { n, x: new Float32Array(MAX_PARTICLES), y: new Float32Array(MAX_PARTICLES), vx: new Float32Array(MAX_PARTICLES), vy: new Float32Array(MAX_PARTICLES), label: [], feat: [] };
  for (let i = 0; i < n; i++) { p.x[i] = 0.05 + 0.9 * rand(); p.y[i] = 0.05 + 0.9 * rand(); const l = labels[i % labels.length]; p.label.push(l); p.feat.push(hashFeat(l)); }
  return p;
}
function addParticles(s, word, k) {
  const p = s.p, spot = wordSpot(word), f = hashFeat(word);
  for (let m = 0; m < k && p.n < MAX_PARTICLES; m++) { const i = p.n++; p.x[i] = clamp(spot.x + (s.rand() - 0.5) * 0.2, 0.02, 0.98); p.y[i] = clamp(spot.y + (s.rand() - 0.5) * 0.2, 0.02, 0.98); p.vx[i] = p.vy[i] = 0; p.label.push(word); p.feat.push(f); }
}
const bounce = (p, i) => {
  if (p.x[i] < 0.01) { p.x[i] = 0.01; p.vx[i] = Math.abs(p.vx[i]) * 0.6; } else if (p.x[i] > 0.99) { p.x[i] = 0.99; p.vx[i] = -Math.abs(p.vx[i]) * 0.6; }
  if (p.y[i] < 0.01) { p.y[i] = 0.01; p.vy[i] = Math.abs(p.vy[i]) * 0.6; } else if (p.y[i] > 0.99) { p.y[i] = 0.99; p.vy[i] = -Math.abs(p.vy[i]) * 0.6; }
};
/** how pure the particles' neighbourhoods are: of the pairs closer than r, the share whose features match (cosine > 0.9). Random: about 1/15. Pure. */
export function purity(p, r = 0.06) {
  let near = 0, same = 0; const r2 = r * r;
  for (let i = 0; i < p.n; i++) for (let j = i + 1; j < p.n; j++) { const dx = p.x[j] - p.x[i], dy = p.y[j] - p.y[i]; if (dx * dx + dy * dy < r2) { near++; if (sim(p.feat[i], p.feat[j]) > 0.9) same++; } }
  return near ? same / near : 0;
}
const meanSpeed = (p) => { let t = 0; for (let i = 0; i < p.n; i++) t += Math.hypot(p.vx[i], p.vy[i]); return p.n ? t / p.n : 0; };

// ---- affinity: frontier-webgpu-attention-field ----------------------------------------------------------------------------------------
// The draft's WGSL kernel: a pull toward the mouse, a push from other particles, and a pull toward the mouse scaled by how much a particle's
// features look like the typed query's. Absorbed here: the query is its own attractor at the word's spot (up to MAX_QUERIES of them), the
// push is short-range and an affinity term (cosine of features) makes like attend to like, and the pointer pulls when over, pushes when down.
export const AFF = { R: 0.3, PULL: 0.3, JITTER: 0.3, REPEL: 0.045, REPEL_K: 2.2, QUERY: 1.6, POINTER_R: 0.24, DRAG: 2.6, VMAX: 0.7 };
function createAffinity(seed, { n = 128 } = {}) {
  const rand = rng(seed);
  return { variant: 'affinity', seed, rand, p: particles(rand, Math.min(MAX_PARTICLES, n), CONCEPTS), queries: [], t: 0, near: 0, clusters: 0, gen: 0 };
}
function stepAffinity(s, dt, input = {}) {
  const p = s.p, n = p.n, R2 = AFF.R * AFF.R, PR2 = AFF.POINTER_R * AFF.POINTER_R, damp = Math.exp(-AFF.DRAG * dt); let near = 0;
  for (let i = 0; i < n; i++) {
    let fx = (+input.tiltX || 0) * 0.25 + (s.rand() - 0.5) * AFF.JITTER, fy = (+input.tiltY || 0) * 0.25 + (s.rand() - 0.5) * AFF.JITTER; const fi = p.feat[i]; // a little seeded jitter: the field never freezes
    for (let j = 0; j < n; j++) {
      if (j === i) continue; const dx = p.x[j] - p.x[i], dy = p.y[j] - p.y[i], d2 = dx * dx + dy * dy; if (d2 > R2) continue;
      const d = Math.sqrt(d2) + 1e-4, a = sim(fi, p.feat[j]), fall = 1 - d / AFF.R;
      const f = AFF.PULL * a * fall - (d < AFF.REPEL ? AFF.REPEL_K * (1 - d / AFF.REPEL) : 0); // like attends to like; nobody overlaps
      fx += (dx / d) * f; fy += (dy / d) * f;
    }
    for (const q of s.queries) { // a typed word: particles whose features look like it fall toward it, the rest drift off
      const dx = q.x - p.x[i], dy = q.y - p.y[i], d = Math.hypot(dx, dy) + 1e-4, a = sim(fi, q.feat);
      const f = a > 0 ? AFF.QUERY * a * Math.min(1, d / 0.08) : a * 0.25 * (d < 0.3 ? 1 : 0); fx += (dx / d) * f; fy += (dy / d) * f;
    }
    if (input.over) { const dx = input.x - p.x[i], dy = input.y - p.y[i], d2 = dx * dx + dy * dy; if (d2 < PR2) { const d = Math.sqrt(d2) + 1e-4, w = (1 - d / AFF.POINTER_R) * (input.down ? -2.4 : 1.2); fx += (dx / d) * w; fy += (dy / d) * w; near++; } }
    p.vx[i] = (p.vx[i] + fx * dt) * damp; p.vy[i] = (p.vy[i] + fy * dt) * damp;
    const sp = Math.hypot(p.vx[i], p.vy[i]); if (sp > AFF.VMAX) { p.vx[i] *= AFF.VMAX / sp; p.vy[i] *= AFF.VMAX / sp; }
  }
  for (let i = 0; i < n; i++) { p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; bounce(p, i); }
  s.t += dt; s.near = n ? near / n : 0; return s;
}
function metricsParticles(s) {
  const p = s.p; let cx = 0, cy = 0;
  if (s.queries && s.queries.length) { const q = s.queries[s.queries.length - 1]; let w = 0; for (let i = 0; i < p.n; i++) { const a = Math.max(0, sim(p.feat[i], q.feat)); cx += p.x[i] * a; cy += p.y[i] * a; w += a; } if (w) { cx /= w; cy /= w; } else { cx = q.x; cy = q.y; } }
  else { for (let i = 0; i < p.n; i++) { cx += p.x[i]; cy += p.y[i]; } cx /= p.n || 1; cy /= p.n || 1; }
  const att = s.variant === 'heads' ? clamp(s.ent, 0, 1) : occupancyEntropy(p.x, p.y, p.n, 8);
  return { entropy: att, activity: clamp(meanSpeed(p) / 0.25, 0, 1), consensus: clamp(clusterize({ x: p.x, y: p.y, feat: p.feat, n: p.n }).share, 0, 1), cx: clamp(cx, 0, 1), cy: clamp(cy, 0, 1) };
}

// ---- heads: F-032 attention field mind -------------------------------------------------------------------------------------------------
// Token particles; each attends over its neighbours with two heads of scaled dot-product attention: head 0 on content (the features),
// head 1 on motion and crowding (the draft's position + velocity + density embedding). The weights ARE the force: a particle moves toward
// what it attends to. The temperature drifts toward a middling attention entropy (F-032: "temperature evolved lightly by entropy"); query
// particles (the pointer, typed words) are keys everyone can attend to but they do not move.
export const HEADS = { R: 0.18, GAIN: 0.9, REPEL: 0.03, DRAG: 2.2, VMAX: 0.6, T0: 1, TMIN: 0.3, TMAX: 3, TARGET: 0.8, EDGE: 3, MAX_EDGES: 300 };
function createHeads(seed, { n = 180 } = {}) {
  const rand = rng(seed), p = particles(rand, Math.min(MAX_PARTICLES, n), CONCEPTS);
  for (let i = 0; i < p.n; i++) { const a = rand() * 6.2832; p.vx[i] = Math.cos(a) * 0.05; p.vy[i] = Math.sin(a) * 0.05; }
  return { variant: 'heads', seed, rand, p, queries: [], temp: HEADS.T0, ent: 0.5, dens: new Float32Array(MAX_PARTICLES), focus: new Float32Array(MAX_PARTICLES), edges: [], t: 0, near: 0, clusters: 0, gen: 0 };
}
function stepHeads(s, dt, input = {}) {
  const p = s.p, n = p.n, R2 = HEADS.R * HEADS.R, damp = Math.exp(-HEADS.DRAG * dt), keys = [];
  for (let i = 0; i < n; i++) { let c = 0; for (let j = 0; j < n; j++) if (j !== i) { const dx = p.x[j] - p.x[i], dy = p.y[j] - p.y[i]; if (dx * dx + dy * dy < 0.0064) c++; } s.dens[i] = Math.min(1, c / 8); s.focus[i] = 0; }
  for (const q of s.queries) keys.push({ x: q.x, y: q.y, feat: q.feat, dens: 1 });
  if (input.over) keys.push({ x: input.x, y: input.y, feat: null, dens: 1 });
  const fx = new Float32Array(n), fy = new Float32Array(n), edges = []; let entSum = 0, entN = 0, near = 0;
  const sc = new Float32Array(n + keys.length), ox = new Float32Array(n + keys.length), oy = new Float32Array(n + keys.length), od = new Float32Array(n + keys.length), oj = new Int32Array(n + keys.length);
  for (let i = 0; i < n; i++) {
    const sp = Math.hypot(p.vx[i], p.vy[i]) || 1, ux = p.vx[i] / sp, uy = p.vy[i] / sp;
    let m = 0;
    for (let j = 0; j < n + keys.length; j++) {
      if (j === i) continue; const k = j < n ? null : keys[j - n], kx = k ? k.x : p.x[j], ky = k ? k.y : p.y[j], dx = kx - p.x[i], dy = ky - p.y[i], d2 = dx * dx + dy * dy;
      if (d2 > R2 && !(k && k.feat)) continue; const d = Math.sqrt(d2) + 1e-4; ox[m] = dx; oy[m] = dy; od[m] = d; oj[m] = j; m++; if (k && !k.feat) near++; // a typed word is a key every token can attend to, however far
    }
    if (!m) continue;
    for (let h = 0; h < 2; h++) {
      let mx = -Infinity;
      for (let t = 0; t < m; t++) {
        const j = oj[t], k = j < n ? null : keys[j - n];
        const score = h === 0 ? (k ? (k.feat ? sim(p.feat[i], k.feat) * 6 : 4) : sim(p.feat[i], p.feat[j]) * 3) // content: the features (the pointer: a strong neutral key)
          : ((ox[t] / od[t]) * ux + (oy[t] / od[t]) * uy) * 0.5 + (k ? k.dens : s.dens[j]) * 0.8;     // motion and crowding
        sc[t] = score / s.temp; if (sc[t] > mx) mx = sc[t];
      }
      let z = 0; for (let t = 0; t < m; t++) { sc[t] = Math.exp(sc[t] - mx); z += sc[t]; }
      let H = 0;
      for (let t = 0; t < m; t++) {
        const a = sc[t] / z; if (a > 1e-9) H -= a * Math.log(a);
        const f = a * HEADS.GAIN * Math.min(1, od[t] / 0.04) - (od[t] < HEADS.REPEL ? 0.5 * (1 - od[t] / HEADS.REPEL) : 0);
        fx[i] += (ox[t] / od[t]) * f; fy[i] += (oy[t] / od[t]) * f;
        if (oj[t] < n) s.focus[oj[t]] += a; if (a * m > HEADS.EDGE && a > 0.08 && oj[t] < n && edges.length < HEADS.MAX_EDGES * 3) edges.push(i, oj[t], Math.round(a * 1000) / 1000);
      }
      if (m > 1) { entSum += H / Math.log(m); entN++; }
    }
  }
  for (let i = 0; i < n; i++) {
    p.vx[i] = (p.vx[i] + fx[i] * dt) * damp; p.vy[i] = (p.vy[i] + fy[i] * dt) * damp;
    const sp = Math.hypot(p.vx[i], p.vy[i]); if (sp > HEADS.VMAX) { p.vx[i] *= HEADS.VMAX / sp; p.vy[i] *= HEADS.VMAX / sp; }
    p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; bounce(p, i);
  }
  s.ent = entN ? entSum / entN : s.ent; s.temp = clamp(s.temp + (HEADS.TARGET - s.ent) * 0.6 * dt, HEADS.TMIN, HEADS.TMAX);
  s.edges = edges; s.t += dt; s.near = n ? near / n : 0; return s;
}

// ---- lattice: F-029 spatial attention lattice mind ------------------------------------------------------------------------------------
// A G x G field; each cell's update is attention over its 3x3 neighbourhood: weight exp(sharp * similarity) times a learned weight for
// the neighbour's place (self, edge, corner), then a growth bump (a smooth bell around mu) moves the cell up or down. The draft's own rule
// decayed to an empty sheet; the bell keeps it alive and still lets the mind choose. Six genomes evolve (fitness: variance, an answer to
// the pointer and the typed words, a field neither empty nor full). Typed words are persistent sources; the pointer injects energy.
export const LG = 48;
export const LSPEC = { sharp: [0, 4], kSelf: [0.1, 1], kEdge: [0.1, 1], kCorner: [0, 1], mu: [0.15, 0.45], sigma: [0.04, 0.18], rate: [0.05, 0.35] };
export const LPOP = 6, LTRIAL = 20;
const fixL = (g) => Object.fromEntries(Object.keys(LSPEC).map((k) => [k, clamp(Number.isFinite(+(g && g[k])) ? +g[k] : (LSPEC[k][0] + LSPEC[k][1]) / 2, LSPEC[k][0], LSPEC[k][1])]));
export const LDEFAULT = { sharp: 2, kSelf: 0.55, kEdge: 0.25, kCorner: 0.8, mu: 0.17, sigma: 0.052, rate: 0.35 }; // found by a seeded search: alive, varied, still moving
function createLattice(seed) {
  const rand = rng(seed), f = makeGrid(LG, LG);
  for (let i = 0; i < f.length; i++) f[i] = rand() * 0.2;
  for (let k = 0; k < 10; k++) { const x = rand.int(LG), y = rand.int(LG); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) f[((y + dy + LG) % LG) * LG + ((x + dx + LG) % LG)] = 0.8 + rand() * 0.2; }
  return { variant: 'lattice', seed, rand, f, nf: makeGrid(LG, LG), genome: fixL(LDEFAULT), sources: [], act: 0, t: 0, gen: 0, fit: 0, pointer: null };
}
/** one lattice step of field f into nf under genome g; returns the mean absolute change. Pure on its inputs (f and nf are swapped by the caller). */
export function latticeStep(f, nf, g, { k = 1, pointer = null, sources = [], tiltX = 0, tiltY = 0 } = {}) {
  let moved = 0; const two = 2 * g.sigma * g.sigma, wOf = (dx, dy) => (dx === 0 && dy === 0 ? g.kSelf : dx === 0 || dy === 0 ? g.kEdge : g.kCorner);
  for (let y = 0; y < LG; y++) for (let x = 0; x < LG; x++) {
    const i = y * LG + x, v = f[i]; let acc = 0, ws = 1e-6;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nv = f[((y + dy + LG) % LG) * LG + ((x + dx + LG) % LG)], w = Math.exp(g.sharp * (1 - Math.abs(v - nv))) * wOf(dx, dy); acc += nv * w; ws += w; }
    const m = acc / ws, grow = 2 * Math.exp(-((m - g.mu) * (m - g.mu)) / two) - 1;
    let o = v + g.rate * grow * k * 0.5;
    if (pointer) { const d = Math.hypot(x - pointer.x * (LG - 1), y - pointer.y * (LG - 1)); if (d < 3) o += (pointer.down ? 0.5 : 0.3) * (1 - d / 3) * k; } // stronger than the bell's pull down, or a touch would vanish
    for (const s of sources) { const d = Math.hypot(x - s.x * (LG - 1), y - s.y * (LG - 1)); if (d < 3.5) o += 0.3 * k; } // a word lights a disc that outlasts the bell's pull down
    o += (tiltX * (x / LG - 0.5) + tiltY * (y / LG - 0.5)) * 0.02 * k;
    nf[i] = clamp(o, 0, 1); moved += Math.abs(nf[i] - v);
  }
  return moved / f.length;
}
function stepLattice(s, dt, input = {}) {
  const k = clamp(dt * 60, 0.25, 3), pointer = input.over ? { x: input.x, y: input.y, down: !!input.down } : null; s.pointer = pointer ? { x: pointer.x, y: pointer.y } : s.pointer;
  const a = latticeStep(s.f, s.nf, s.genome, { k, pointer, sources: s.sources, tiltX: +input.tiltX || 0, tiltY: +input.tiltY || 0 });
  const t = s.f; s.f = s.nf; s.nf = t; s.act = s.act * 0.9 + a * 0.1; s.t += dt; return s;
}
/** the mean of a G x G field (side gw x gh) in radius r cells around (x,y) in 0..1. Pure. */
function around(f, gw, gh, x, y, r) { const cx = Math.round(x * (gw - 1)), cy = Math.round(y * (gh - 1)); let t = 0, c = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) { t += f[((cy + dy + gh) % gh) * gw + ((cx + dx + gw) % gw)]; c++; } return c ? t / c : 0; }
function massCentre(f, gw, gh) { let mx = 0, my = 0, m = 0; for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const w = f[y * gw + x]; mx += w * x; my += w * y; m += w; } return m ? { cx: mx / m / (gw - 1), cy: my / m / (gh - 1) } : { cx: 0.5, cy: 0.5 }; }
/** the lattice's numbers: entropy of its values, activity, consensus (how much more energy sits at the pointer and the words than elsewhere), cx/cy. Pure. */
export function measureLattice(f, act, focus = []) {
  const st = stats(f), at = focus.length ? focus.reduce((t, q) => t + around(f, LG, LG, q.x, q.y, 3), 0) / focus.length : st.mean, mc = massCentre(f, LG, LG);
  return { entropy: entropy(f, 16), activity: clamp(act * 10, 0, 1), consensus: clamp(0.5 + (at - st.mean) * 2, 0, 1), cx: mc.cx, cy: mc.cy, variance: st.variance, mean: st.mean };
}
const latticeFocus = (s) => [...s.sources, ...(s.pointer ? [s.pointer] : [])];
/** what the F-029 mind rewards: variance (diversity), an answer to the pointer and the words, and a field that is neither empty nor full. Pure. */
export const latticeFitness = (m) => 0.55 * clamp(m.variance * 6, 0, 1) + 0.3 * m.consensus + 0.15 * (m.mean > 0.05 && m.mean < 0.7 ? 1 : 0);
/** one F-029 generation: each genome replays LTRIAL steps from the same snapshot; the best two are kept. arg { pop, f, seed, gen, sources, pointer }
 *  -> { pop, best, fitness, gen }. Synchronous and deterministic for its inputs. */
export function evolveLattice(arg) {
  const r = rng(((arg.seed || 1) * 7919 + (arg.gen || 0)) >>> 0), pop = (arg.pop && arg.pop.length ? arg.pop : [LDEFAULT, ...Array.from({ length: LPOP - 1 }, () => randomGenome(LSPEC, r))]).map(fixL);
  const sources = arg.sources || [], pointer = arg.pointer || null, focus = [...sources, ...(pointer ? [pointer] : [])];
  const fits = pop.map((g) => {
    let f = Float32Array.from(arg.f), nf = new Float32Array(f.length), act = 0;
    for (let i = 0; i < LTRIAL; i++) { act = act * 0.9 + latticeStep(f, nf, g, { k: 1, sources, pointer: pointer ? { ...pointer, down: false } : null }) * 0.1; const t = f; f = nf; nf = t; }
    return Math.round(latticeFitness(measureLattice(f, act, focus)) * 1e6) / 1e6;
  });
  let bi = 0; fits.forEach((v, i) => { if (v > fits[bi]) bi = i; });
  return { pop: evolveStep(pop, fits, LSPEC, r, { elite: 2 }).map(fixL), best: pop[bi], fitness: fits[bi], gen: (arg.gen || 0) + 1 };
}

// ---- causal: F-047 causal attention lattice mind ----------------------------------------------------------------------------------------
// A CW x CH field. Each cell's attention is a distance-decayed average of its neighbourhood plus a bias from the pointer's recent path
// (the last MAX_HIST places, newer counting more: causal, it only looks back), minus the residual |local - field| times a gain. The field
// eases toward its attention; cells above a threshold get a little extra. Thought nodes ride the attention's gradient and feed the field
// where they sit; pressing near a node holds it under the pointer. Eight genomes evolve (the draft's six genes: radius, decay, pointer
// weight, residual gain, node attract, energy threshold) by replaying a short run on the same path: low residual, high confidence,
// nodes near the pointer, and a field that stays lit (the draft's fitness rewarded an empty field; this one does not).
export const CW = 64, CH = 36;
export const CSPEC = { rad: [0, 1], decay: [0.2, 2], pWeight: [0, 1], rGain: [0, 1], nAttract: [0, 1], eThresh: [0.2, 0.9] };
export const CPOP = 8, CTRIAL = 12, NODE_LABELS = ['node0', 'node1', 'node2', 'node3', 'node4'];
export const CDEFAULT = { rad: 0.5, decay: 0.8, pWeight: 0.5, rGain: 0.3, nAttract: 0.6, eThresh: 0.5 };
const fixC = (g) => Object.fromEntries(Object.keys(CSPEC).map((k) => [k, clamp(Number.isFinite(+(g && g[k])) ? +g[k] : (CSPEC[k][0] + CSPEC[k][1]) / 2, CSPEC[k][0], CSPEC[k][1])]));
function createCausal(seed) {
  const rand = rng(seed), f = makeGrid(CW, CH); for (let i = 0; i < f.length; i++) f[i] = rand() * 0.3;
  const nodes = NODE_LABELS.map((label, i) => ({ label, x: 0.1 + 0.8 * rand(), y: 0.1 + 0.8 * rand(), vx: 0, vy: 0, hue: 40 + i * 50 }));
  return { variant: 'causal', seed, rand, f, attn: makeGrid(CW, CH), nf: makeGrid(CW, CH), genome: fixC(CDEFAULT), hist: [], nodes, held: -1, residual: 0, conf: 0, act: 0, t: 0, gen: 0, fit: 0, last: null };
}
/** the pointer path's pull on every cell (the causal bias, before the genome's weight): newer places count more. Pure. */
export function pathBias(hist) {
  const pb = new Float32Array(CW * CH); if (!hist || !hist.length) return pb;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const ux = x / (CW - 1), uy = y / (CH - 1); let b = 0; for (let h = 0; h < hist.length && h < MAX_HIST; h++) b += Math.exp(-Math.hypot((ux - hist[h].x) * 1.6, uy - hist[h].y) * 10) * (1 - h / MAX_HIST); pb[y * CW + x] = b; }
  return pb;
}
/** one causal step: field f, attention out, next field nf (written), under genome g with the path bias pb (pathBias(hist)) and nodes.
 *  Returns { residual, moved }. Moves the nodes (not the held one). Pure on its inputs. */
export function causalStep(f, attn, nf, g, pb, nodes, { k = 1, held = -1 } = {}) {
  const R = 1 + Math.round(g.rad), side = 2 * R + 1, kw = new Float32Array(side * side); let ws = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const w = Math.exp(-Math.hypot(dx, dy) * g.decay); kw[(dy + R) * side + dx + R] = w; ws += w; }
  let moved = 0, res = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x; let s = 0;
    for (let dy = -R; dy <= R; dy++) { const row = ((y + dy + CH) % CH) * CW, kr = (dy + R) * side + R; for (let dx = -R; dx <= R; dx++) s += f[row + ((x + dx + CW) % CW)] * kw[kr + dx]; }
    const local = s / ws;
    const residual = Math.abs(local - f[i]), a = Math.max(0, local * 0.7 + Math.min(1, pb[i] * g.pWeight) * 0.3 - residual * g.rGain);
    attn[i] = a; res += Math.abs(a - f[i]);
    nf[i] = clamp(f[i] * 0.92 + a * 0.08 + (a > g.eThresh ? 0.02 : 0), 0, 1) * k + f[i] * (1 - k);
    moved += Math.abs(nf[i] - f[i]);
  }
  nodes.forEach((n, j) => {
    const ix = clamp(Math.round(n.x * (CW - 1)), 0, CW - 1), iy = clamp(Math.round(n.y * (CH - 1)), 0, CH - 1), at = (xx, yy) => attn[((yy + CH) % CH) * CW + ((xx + CW) % CW)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = ((iy + dy + CH) % CH) * CW + ((ix + dx + CW) % CW); nf[c] = Math.min(1, nf[c] + (dx || dy ? 0.05 : 0.15) * g.nAttract * k); } // a node feeds the field around it
    if (j === held) { n.vx = n.vy = 0; return; }
    const gx = at(ix + 1, iy) - at(ix - 1, iy), gy = at(ix, iy + 1) - at(ix, iy - 1);
    n.vx = n.vx * 0.85 + gx * 0.04 * k; n.vy = n.vy * 0.85 + gy * 0.04 * k;
    n.x = ((n.x + n.vx * k) % 1 + 1) % 1; n.y = ((n.y + n.vy * k) % 1 + 1) % 1;
  });
  return { residual: res / f.length, moved: moved / f.length };
}
function stepCausal(s, dt, input = {}) {
  const k = clamp(dt * 60, 0.25, 1);
  if (input.over) {
    const here = { x: clamp(+input.x, 0, 1), y: clamp(+input.y, 0, 1) };
    if (!s.last || Math.hypot(here.x - s.last.x, here.y - s.last.y) > 0.005) { s.hist.unshift(here); s.histN = (s.histN || 0) + 1; if (s.hist.length > MAX_HIST) s.hist.length = MAX_HIST; const i = Math.round(here.y * (CH - 1)) * CW + Math.round(here.x * (CW - 1)); s.f[i] = Math.min(1, s.f[i] + 0.4); }
    s.last = here;
    if (input.down && s.held < 0) { let best = -1, bd = 0.07; s.nodes.forEach((n, j) => { const d = Math.hypot(n.x - here.x, n.y - here.y); if (d < bd) { bd = d; best = j; } }); s.held = best; }
    if (s.held >= 0 && s.nodes[s.held]) { s.nodes[s.held].x = here.x; s.nodes[s.held].y = here.y; }
  }
  if (!input.down) s.held = -1;
  if (!s.pb || s.pbAt !== s.histN) { s.pb = pathBias(s.hist); s.pbAt = s.histN; }
  const r = causalStep(s.f, s.attn, s.nf, s.genome, s.pb, s.nodes, { k, held: s.held });
  const t = s.f; s.f = s.nf; s.nf = t;
  s.residual = r.residual; s.conf = Math.max(0, 1 - r.residual * 3); s.act = s.act * 0.9 + r.moved * 0.1; s.t += dt; return s;
}
/** how near the nodes are to the newest pointer place, 0..1 (0.5 with no pointer yet). Pure. */
export const nodeProx = (nodes, hist) => (hist.length && nodes.length ? nodes.reduce((t, n) => t + Math.exp(-Math.hypot(n.x - hist[0].x, n.y - hist[0].y) * 5), 0) / nodes.length : 0.5);
/** what the F-047 mind rewards. Pure. */
export const causalFitness = (residual, conf, prox, mean) => 0.35 * (1 - Math.min(1, residual)) + 0.25 * conf + 0.2 * prox + 0.2 * clamp(mean * 4, 0, 1);
/** one F-047 generation: each genome replays CTRIAL steps on the same field, path and nodes. arg { pop, f, hist, nodes, seed, gen }
 *  -> { pop, best, fitness, gen }. Synchronous and deterministic for its inputs. */
export function evolveCausal(arg) {
  const r = rng(((arg.seed || 1) * 104729 + (arg.gen || 0)) >>> 0), pop = (arg.pop && arg.pop.length ? arg.pop : [CDEFAULT, ...Array.from({ length: CPOP - 1 }, () => randomGenome(CSPEC, r))]).map(fixC);
  const hist = (arg.hist || []).slice(0, MAX_HIST), pb = pathBias(hist);
  const fits = pop.map((g) => {
    let f = Float32Array.from(arg.f), nf = new Float32Array(f.length); const attn = new Float32Array(f.length), nodes = (arg.nodes || []).map((n) => ({ ...n })); let res = 0;
    for (let i = 0; i < CTRIAL; i++) { res = causalStep(f, attn, nf, g, pb, nodes).residual; const t = f; f = nf; nf = t; }
    return Math.round(causalFitness(res, Math.max(0, 1 - res * 3), nodeProx(nodes, hist), stats(f).mean) * 1e6) / 1e6;
  });
  let bi = 0; fits.forEach((v, i) => { if (v > fits[bi]) bi = i; });
  return { pop: evolveStep(pop, fits, CSPEC, r, { elite: 2 }).map(fixC), best: pop[bi], fitness: fits[bi], gen: (arg.gen || 0) + 1 };
}

// ---- clusters (the particle laws' slow thought) -------------------------------------------------------------------------------------------
/** clusters of particles: union-find over pairs closer than r whose features match (cosine > 0.9); counts groups of at least `min`.
 *  arg { x, y, feat, n?, r, min } -> { clusters, biggest, sizes (largest first, at most 8), share (of particles in a counted group, 0..1) }.
 *  Pure; the metrics use its share as consensus (like with like), and the Worker runs it for the particle laws' cluster count. */
export function clusterize(arg) {
  const x = arg.x || [], y = arg.y || [], feat = arg.feat || [], n = Math.min(arg.n == null ? x.length : arg.n, x.length, feat.length, MAX_PARTICLES), r2 = (arg.r || 0.06) ** 2, min = arg.min || 4, up = Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (up[a] !== a) { up[a] = up[up[a]]; a = up[a]; } return a; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = x[j] - x[i], dy = y[j] - y[i]; if (dx * dx + dy * dy < r2 && sim(feat[i], feat[j]) > 0.9) up[find(i)] = find(j); }
  const size = new Map(); for (let i = 0; i < n; i++) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
  const sizes = [...size.values()].filter((v) => v >= min).sort((a, b) => b - a);
  return { clusters: sizes.length, biggest: sizes[0] || 0, sizes: sizes.slice(0, 8), share: n ? sizes.reduce((t, v) => t + v, 0) / n : 0 };
}

// ---- the shared face ------------------------------------------------------------------------------------------------------------------
const MAKERS = { affinity: createAffinity, heads: createHeads, lattice: createLattice, causal: createCausal };
const STEPS = { affinity: stepAffinity, heads: stepHeads, lattice: stepLattice, causal: stepCausal };
/** a fresh field of one variant (default affinity), deterministic by seed. */
export function create(seed = 1, { variant = 'affinity', n } = {}) { const v = MAKERS[variant] ? variant : 'affinity'; return MAKERS[v]((+seed >>> 0) || 1, n ? { n } : {}); }
/** one step of whichever law the state holds. input: { over, x, y, down, tiltX, tiltY } with x, y in 0..1. */
export function step(s, dt = 1 / 60, input = {}) { return STEPS[s.variant](s, clamp(+dt || 0, 0, 0.05), input || {}); }
/** { entropy, activity, consensus, cx, cy }, each 0..1, for whichever law the state holds. Pure. */
export function metrics(s) {
  if (s.variant === 'lattice') { const m = measureLattice(s.f, s.act, latticeFocus(s)); return { entropy: m.entropy, activity: m.activity, consensus: m.consensus, cx: m.cx, cy: m.cy }; }
  if (s.variant === 'causal') { const mc = massCentre(s.attn, CW, CH); return { entropy: entropy(s.f, 16), activity: clamp(s.act * 80, 0, 1), consensus: clamp(s.conf, 0, 1), cx: mc.cx, cy: mc.cy }; }
  return metricsParticles(s);
}
/** the next law after this one, for the card's Law button. Pure. */
export const nextVariant = (v) => VARIANTS[(VARIANTS.indexOf(v) + 1) % VARIANTS.length];
/** a typed word becomes an attractor in whichever law the state holds: a query attractor plus six particles of that word (affinity), a key every
 *  particle can attend to (heads), a persistent energy source (lattice), a thought node (causal). The oldest goes past the cap. Returns the word, or '' when nothing was left. */
export function addQuery(s, raw) {
  const word = cleanWord(raw); if (!word) return '';
  const spot = wordSpot(word), q = { word, x: spot.x, y: spot.y, feat: hashFeat(word) };
  if (s.variant === 'affinity' || s.variant === 'heads') { s.queries = s.queries.filter((o) => o.word !== word); s.queries.push(q); if (s.queries.length > MAX_QUERIES) s.queries.shift(); if (s.variant === 'affinity') addParticles(s, word, 6); }
  else if (s.variant === 'lattice') { s.sources = s.sources.filter((o) => o.word !== word); s.sources.push({ word, x: spot.x, y: spot.y }); if (s.sources.length > MAX_QUERIES) s.sources.shift(); }
  else { if (s.nodes.length >= MAX_NODES) s.nodes.splice(NODE_LABELS.length, 1); s.nodes.push({ label: word, x: spot.x, y: spot.y, vx: 0, vy: 0, hue: fnv(word) % 360 }); }
  return word;
}
/** how well the particle laws answer the newest word: of the particles whose features look like it (cosine > 0.5), the share within
 *  0.15 of its attractor, 0..1 (0 with no word, or in a lattice). Rises as the look-alikes fall toward the word. Pure. */
export function answer(s) {
  if (!s.p || !s.queries || !s.queries.length) return 0; const q = s.queries[s.queries.length - 1], p = s.p; let like = 0, at = 0;
  for (let i = 0; i < p.n; i++) if (sim(p.feat[i], q.feat) > 0.5) { like++; if (Math.hypot(p.x[i] - q.x, p.y[i] - q.y) < 0.15) at++; }
  return like ? at / like : 0;
}
/** the words the field is attending to now. Pure. */
export const words = (s) => (s.variant === 'lattice' ? s.sources.map((o) => o.word) : s.variant === 'causal' ? s.nodes.slice(NODE_LABELS.length).map((n) => n.label) : s.queries.map((q) => q.word));

/** what to send the slow thought (plain arrays, so it crosses to a Worker). */
export function mindArg(s, pop = null) {
  if (s.variant === 'lattice') return { variant: 'lattice', pop, f: Array.from(s.f), seed: s.seed, gen: s.gen, sources: s.sources.map(({ x, y }) => ({ x, y })), pointer: s.pointer };
  if (s.variant === 'causal') return { variant: 'causal', pop, f: Array.from(s.f), seed: s.seed, gen: s.gen, hist: s.hist.slice(), nodes: s.nodes.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })) };
  const p = s.p; return { variant: s.variant, x: Array.from(p.x.subarray(0, p.n)), y: Array.from(p.y.subarray(0, p.n)), feat: p.feat.slice(0, p.n), gen: s.gen };
}
/** the slow thought, for a Worker or the page: clusters for the particle laws, one generation for the lattices. Synchronous and deterministic. */
export function think(arg = {}) {
  if (arg.variant === 'lattice') return { variant: 'lattice', ...evolveLattice(arg) };
  if (arg.variant === 'causal') return { variant: 'causal', ...evolveCausal(arg) };
  return { variant: arg.variant || 'affinity', ...clusterize(arg), gen: (arg.gen || 0) + 1 };
}
/** take a thought's answer into the state (ignored when the law has changed since it was asked). Returns the population to send next time. */
export function applyThought(s, out) {
  if (!out || out.variant !== s.variant) return null;
  s.gen = out.gen;
  if (s.variant === 'lattice') { s.genome = fixL(out.best); s.fit = out.fitness; return out.pop; }
  if (s.variant === 'causal') { s.genome = fixC(out.best); s.fit = out.fitness; return out.pop; }
  s.clusters = out.clusters; s.biggest = out.biggest; return null;
}
const r3 = (v) => Math.round(v * 1000) / 1000;
/** the facts a seal keeps: the law, its numbers, how many words (never the words, never the pointer's path). Pure. */
export function params(s) {
  const base = { variant: s.variant, source: SOURCES[s.variant], gen: s.gen || 0, words: words(s).length };
  if (s.variant === 'lattice' || s.variant === 'causal') return { ...base, genome: Object.fromEntries(Object.entries(s.genome).map(([k, v]) => [k, r3(v)])) };
  return { ...base, n: s.p.n, clusters: s.clusters || 0, ...(s.variant === 'heads' ? { temp: r3(s.temp) } : {}) };
}
