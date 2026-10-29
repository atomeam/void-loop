// brain-organs — the organs of Verse Brain, each one job, all reading and writing the one workspace (lib/brain-workspace.js). The owner,
// 2026-10-29: "the grok builds combined can be verse brain ... make it make sense but make it amazing and dont fake it". Each organ is the
// best working version of a family of Grok's frontier drafts (atomeam/a-to-mind.com drafts/; which drafts each organ came from is
// lib/brain-drafts.json). An organ is
//   { id, name, job, want(brain) -> 0..1 (its own reason to run now), run(brain, input), imagine?: true (it runs inside a rollout) }
// The attention scheduler (lib/brain-attention.js) decides which organs run each tick; the rollouts (lib/brain-imagine.js) run only the
// organs marked imagine, because the learners must never learn from what the brain only imagined.
// Pure: no DOM, no clock, no Math.random. The visitor's pointer path is kept only as a short ring in memory, never sealed or saved.
import { episodicPrior, recordEpisode, keyOf, recordProcedure, bestProcedure } from './brain-mind.js';
import { clamp, laplacian4, idx, mutate, randomGenome, rng } from './field-kit.js';
import { kuramoto } from './field-resonance.js';
import { synapses } from './brain-synapses.js';
import { creature } from './brain-creature.js';
import { hearing } from './brain-hearing.js';
import { painter } from './brain-painter.js';
import { gardener, tileOf } from './brain-gardener.js';
import { grower } from './brain-grower.js';
import { formula } from './brain-formula.js';
import { current } from './brain-current.js';
import { GW, GH, CELLS, RG, RH, EMB, KIND, REGIONS_X, REGIONS_Y, deposit, writeCell, readRegion, regionMeans, regionCenter, regionOf, addNode, nodesOf, cellOf } from './brain-workspace.js';

const TAU = Math.PI * 2;
export const SPECIES = 3, PARTICLES = 96, MEMBRANE = 20, MAX_CONCEPTS = 24;

// ---- the genome every organ reads its settings from (the arena evolves it) -------------------------------------------------------------
export const GENOME_SPEC = {
  feed: [0.026, 0.055], kill: [0.055, 0.0655], // tissue (Gray-Scott): the spots-and-worms band
  couple: [0.4, 3.2], spin: [0.5, 1.6],        // rhythm (Kuramoto): coupling and natural frequency
  leak: [0.15, 0.8], lr: [0.02, 0.4],          // predictor (echo state network): leak rate and readout learning rate
  sense: [0, 1.2],                             // swarm: how strongly a particle turns toward tissue it senses ahead (Physarum)
  m00: [-1, 1], m01: [-1, 1], m02: [-1, 1], m10: [-1, 1], m11: [-1, 1], m12: [-1, 1], m20: [-1, 1], m21: [-1, 1], m22: [-1, 1] // particle life
};
export const STARTER = { feed: 0.037, kill: 0.0605, couple: 1.4, spin: 1.0, leak: 0.45, lr: 0.15, sense: 0.6, m00: 0.6, m01: -0.4, m02: 0.3, m10: 0.5, m11: 0.4, m12: -0.6, m20: -0.5, m21: 0.7, m22: 0.2 };
export const fixGenome = (g = {}) => Object.fromEntries(Object.entries(GENOME_SPEC).map(([k, [lo, hi]]) => [k, clamp(Number.isFinite(+g[k]) ? +g[k] : STARTER[k], lo, hi)]));

// ---- senses: the input causal layer (pointer, tilt, sound, typed words) -------------------------------------------------------------
export const FEAT = 8; // [x, y, vx, vy, tiltX, tiltY, sound, pressed]
const senses = {
  id: 'senses', name: 'Senses', job: 'turns your pointer, tilt and sound into numbers and marks where they landed', imagine: true,
  want: () => 1,
  run(b, input) {
    const ws = b.ws, L = ws.layers.input, S = b.senses, f = S.feat, over = !!input.over;
    for (let i = 0; i < CELLS; i++) L[i] *= 0.9;
    const px = clamp(+input.x || 0, 0, 1), py = clamp(+input.y || 0, 0, 1);
    const vx = over && S.has ? (px - S.px) * 20 : 0, vy = over && S.has ? (py - S.py) * 20 : 0;
    S.px = px; S.py = py; S.has = over;
    f[0] = over ? px : 0.5; f[1] = over ? py : 0.5; f[2] = clamp(vx, -1, 1); f[3] = clamp(vy, -1, 1);
    f[4] = clamp(+input.tiltX || 0, -1, 1); f[5] = clamp(+input.tiltY || 0, -1, 1); f[6] = clamp(+input.sound || 0, 0, 1); f[7] = input.down ? 1 : 0;
    S.over = over; S.speed = Math.hypot(f[2], f[3]);
    if (over) deposit(ws, 'input', px, py, input.down ? 0.5 : 0.18, input.down ? 3 : 2, 'you');
    if (f[6] > 0.05) deposit(ws, 'input', b.focus.x, b.focus.y, f[6] * 0.35, 3, 'senses'); // sound lands where the brain is attending
    S.felt = Array.isArray(input.field) ? input.field.length : 0;
    if (Array.isArray(input.field)) for (const s of input.field) deposit(ws, 'memory', clamp(+s.x || 0, 0, 1), clamp(+s.y || 0, 0, 1), clamp(+s.act || 0, 0, 1) * 0.06, 2, 'senses'); // other skills' slots in the shared field (lib/brain-field.js)
    if (S.trail.length >= 24) S.trail.shift(); if (over) S.trail.push([px, py, f[6]]);
    return 1;
  }
};

// ---- predictor: an echo state network with an online readout (the residual / reservoir / recurrent drafts) -------------------------------
export const RES = 32;
export function makeReservoir(seed) {
  let a = (seed * 2654435761) >>> 0; const r = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
  const win = new Float32Array(RES * FEAT), w = new Float32Array(RES * RES), wout = new Float32Array(FEAT * (RES + 1));
  for (let i = 0; i < win.length; i++) win[i] = (r() - 0.5) * 1.2;
  // sparse recurrent weights scaled so each row's absolute sum is 0.9: the spectral radius is then below 0.9 (Gershgorin), an echo state
  for (let i = 0; i < RES; i++) { let s = 0; for (let j = 0; j < RES; j++) if (r() < 0.2) { w[i * RES + j] = r() - 0.5; s += Math.abs(w[i * RES + j]); } if (s) for (let j = 0; j < RES; j++) w[i * RES + j] *= 0.9 / s; }
  return { win, w, wout, h: new Float32Array(RES), prev: new Float32Array(RES + 1), guess: new Float32Array(FEAT), err: 0, errAvg: 0.5, steps: 0 };
}
/** one step: learn from how wrong the last guess was (normalised LMS), move the reservoir with u, guess the next u. Returns the error. Pure on R. */
export function reservoirStep(R, u, leak = 0.45, lr = 0.15) {
  let e2 = 0; const e = new Float32Array(FEAT);
  for (let k = 0; k < FEAT; k++) { e[k] = u[k] - R.guess[k]; e2 += (k < 4 ? 2 : 1) * e[k] * e[k]; }
  if (R.steps > 0) { let n2 = 1; for (let i = 0; i <= RES; i++) n2 += R.prev[i] * R.prev[i]; const g = lr / n2; for (let k = 0; k < FEAT; k++) for (let i = 0; i <= RES; i++) R.wout[k * (RES + 1) + i] += g * e[k] * R.prev[i]; }
  const nh = new Float32Array(RES);
  for (let i = 0; i < RES; i++) { let s = 0; for (let k = 0; k < FEAT; k++) s += R.win[i * FEAT + k] * u[k]; for (let j = 0; j < RES; j++) s += R.w[i * RES + j] * R.h[j]; nh[i] = (1 - leak) * R.h[i] + leak * Math.tanh(s); }
  R.h.set(nh); for (let i = 0; i < RES; i++) R.prev[i] = R.h[i]; R.prev[RES] = 1;
  for (let k = 0; k < FEAT; k++) { let s = 0; for (let i = 0; i <= RES; i++) s += R.wout[k * (RES + 1) + i] * R.prev[i]; R.guess[k] = s; }
  R.err = R.steps > 0 ? Math.sqrt(e2 / FEAT) : 0; R.errAvg = R.errAvg * 0.97 + R.err * 0.03; R.steps++;
  return R.err;
}
const predictor = {
  id: 'predictor', name: 'Predictor', job: 'guesses your next move; where it guessed wrong becomes surprise',
  want: (b) => (b.senses.over ? 0.95 : 0.08),
  run(b) {
    const ws = b.ws, L = ws.layers.surprise, g = b.genome, R = b.reservoir;
    for (let i = 0; i < CELLS; i++) L[i] *= 0.96;
    const err = reservoirStep(R, b.senses.feat, g.leak, g.lr);
    b.surprise = clamp(err / Math.max(0.05, R.errAvg * 2), 0, 1); // surprise is error measured against what it is used to
    if (b.senses.over && b.surprise > 0.35) deposit(ws, 'surprise', b.senses.px, b.senses.py, 0.4 * b.surprise, 3, 'predictor');
    return 1;
  }
};

// ---- gestures: online k-means of your movement, and a compression oracle over the symbols (F318, F210) ------------------------------------
export const K = 6, LETTERS = 'abcdef';
export function makeGestures() {
  const c = []; for (let i = 0; i < K; i++) c.push([i / (K - 1), (i % 3) / 2, Math.cos(i * 1.05), Math.sin(i * 1.05), 0]); // spread starts: speed, turn, dir x, dir y, sound
  return { c, n: new Array(K).fill(0), sym: -1, str: '', motifs: [], motif: -1, seen: 0, last: [], every: 0 };
}
/** the features of a short stretch of trail [[x, y, sound]]: [speed, turning, dir x, dir y, sound], each about 0..1. Pure. */
export function gestureFeatures(trail) {
  if (trail.length < 4) return null;
  const n = trail.length, a = trail[0], z = trail[n - 1]; let len = 0, turn = 0, snd = 0, pa = null;
  for (let i = 1; i < n; i++) { const dx = trail[i][0] - trail[i - 1][0], dy = trail[i][1] - trail[i - 1][1], d = Math.hypot(dx, dy); len += d; snd += trail[i][2]; if (d > 1e-4) { const ang = Math.atan2(dy, dx); if (pa != null) { let t = ang - pa; t = Math.atan2(Math.sin(t), Math.cos(t)); turn += Math.abs(t); } pa = ang; } }
  const net = Math.hypot(z[0] - a[0], z[1] - a[1]) || 1e-6;
  return [clamp(len * 2.5, 0, 1), clamp(turn / (n * 0.6), 0, 1), (z[0] - a[0]) / net, (z[1] - a[1]) / net, clamp(snd / n, 0, 1)];
}
const dist2 = (p, q) => { let s = 0; for (let k = 0; k < p.length; k++) s += (k >= 2 && k < 4 ? 0.25 : 1) * (p[k] - q[k]) ** 2; return s; };
/** online k-means: the nearest centroid to f moves toward it (rate 1/(n+1), at least 0.05); a far movement takes over the least used one. Returns the centroid's index. Pure on G. */
export const SPAWN = 0.15; // a movement this far from every kind starts a new kind on the least used centroid (no dead centroids)
export function kmeansStep(G, f) {
  let best = 0, bd = Infinity, least = 0, most = 0; for (let i = 0; i < K; i++) { const d = dist2(G.c[i], f); if (d < bd) { bd = d; best = i; } if (G.n[i] < G.n[least]) least = i; most = Math.max(most, G.n[i]); }
  if (bd > SPAWN && least !== best && G.n[least] <= Math.max(2, most * 0.05)) { G.c[least] = f.slice(); G.n[least] = 1; return least; }
  const r = Math.max(0.05, 1 / (++G.n[best] + 1)); for (let k = 0; k < f.length; k++) G.c[best][k] += r * (f[k] - G.c[best][k]);
  return best;
}
/** a name for a centroid, from what it is (not which number it got). Pure. */
export function gestureName(c) {
  if (c[4] > 0.4) return 'voice';
  if (c[0] < 0.08) return 'still';
  if (c[1] > 0.45) return c[0] > 0.4 ? 'whirl' : 'circle';
  if (c[0] > 0.45) return 'sweep';
  return Math.abs(c[2]) > Math.abs(c[3]) ? 'drift across' : 'drift up and down';
}
/** LZ78 complexity of a string: phrases x log2(phrases + 1), a compressed size in bits. Pure. */
export function lzBits(s) { const seen = new Set(); let w = '', p = 0; for (const ch of s) { const t = w + ch; if (seen.has(t)) w = t; else { seen.add(t); p++; w = ''; } } if (w) p++; return p * Math.log2(p + 1); }
/** normalised compression distance (Cilibrasi and Vitanyi): 0 alike, near 1 unrelated. Pure. */
export function ncd(x, y) { const cx = lzBits(x), cy = lzBits(y); return (lzBits(x + y) - Math.min(cx, cy)) / Math.max(1e-9, Math.max(cx, cy)); }
const gestures = {
  id: 'gestures', name: 'Gestures', job: 'sorts your movements into kinds and recognises a pattern you repeat',
  want: (b) => (b.senses.over ? 0.7 : 0.05),
  run(b) {
    const G = b.gestures, f = gestureFeatures(b.senses.trail.slice(-12));
    if (!f || !b.senses.over) return 0;
    if (++G.every % 6) return 0;
    const s = kmeansStep(G, f); G.sym = s; G.str = (G.str + LETTERS[s]).slice(-48);
    if (G.str.length >= 12 && G.str.length % 6 === 0) {
      const phrase = G.str.slice(-12); let bi = -1, bd = 1;
      G.motifs.forEach((m, i) => { const d = ncd(phrase, m.s); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < 0.62) { G.motifs[bi].seen++; G.motif = bi; G.seen = G.motifs[bi].seen; }
      else { if (G.motifs.length >= 6) G.motifs.sort((p, q) => q.seen - p.seen).pop(); G.motifs.push({ s: phrase, seen: 1 }); G.motif = G.motifs.length - 1; G.seen = 1; }
      b.board.motif = { id: G.motif, seen: G.seen, ncd: Math.round(bd * 100) / 100 };
    }
    b.board.gesture = gestureName(G.c[s]);
    return 1;
  }
};

// ---- memory: Hebbian links from a kind of gesture to the region of tissue it lights up (F297, F303, F241) -------------------------------
export const REGIONS = REGIONS_X * REGIONS_Y;
export const makeMemory = () => ({ w: new Float32Array(K * REGIONS), expect: -1, strength: 0, updates: 0 });
/** Hebbian step with decay (Oja-like, bounded): w[s][r] grows with the activity of region r while gesture s is active. Pure on M. */
export function hebbStep(M, s, regionAct, eta = 0.08, decay = 0.002) {
  for (let i = 0; i < M.w.length; i++) M.w[i] *= 1 - decay;
  if (s < 0) return M;
  let mx = 0; for (let r = 0; r < REGIONS; r++) mx = Math.max(mx, regionAct[r]);
  for (let r = 0; r < REGIONS; r++) { const post = mx > 0 ? regionAct[r] / mx : 0, i = s * REGIONS + r; M.w[i] += eta * post * (1 - M.w[i]) - eta * 0.3 * (1 - post) * M.w[i]; }
  M.updates++; return M;
}
/** the region memory expects gesture s to light up, and how sure: { region, strength }. Pure. */
export function recall(M, s) { if (s < 0) return { region: -1, strength: 0 }; let best = -1, bw = 0; for (let r = 0; r < REGIONS; r++) { const v = M.w[s * REGIONS + r]; if (v > bw) { bw = v; best = r; } } return { region: best, strength: bw }; }
const memory = {
  id: 'memory', name: 'Memory', job: 'learns which part of the tissue lights up after each kind of gesture, and expects it next time',
  want: (b) => (b.gestures.sym >= 0 ? 0.55 : 0.1),
  run(b) {
    const ws = b.ws, L = ws.layers.memory, M = b.memory;
    for (let i = 0; i < CELLS; i++) L[i] *= 0.97;
    const act = regionMeans(ws, 'input'), tis = regionMeans(ws, 'act'); for (let r = 0; r < REGIONS; r++) act[r] = act[r] + tis[r] * 0.5;
    hebbStep(M, b.gestures.sym, act);
    const e = recall(M, b.gestures.sym); M.expect = e.region; M.strength = e.strength;
    if (e.region >= 0 && e.strength > 0.2) { const c = regionCenter(e.region); deposit(ws, 'memory', c.x, c.y, 0.08 * e.strength, 5, 'memory'); }
    b.board.expect = e.region >= 0 && e.strength > 0.2 ? { region: e.region, strength: Math.round(e.strength * 100) / 100 } : null;
    return 1;
  }
};

// ---- concepts: words as hypervectors on a co-occurrence graph, and a character model that is surprised by new words (F227, F276, F298, F225)
export const HV = 256;
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
/** a word's hypervector: the bundle (majority) of its character trigrams' random +-1 vectors. Similar spellings share trigrams. Pure. */
export function hypervector(word) {
  const w = '#' + String(word).toLowerCase() + '#', acc = new Float32Array(HV);
  for (let i = 0; i + 3 <= w.length; i++) { let a = fnv(w.slice(i, i + 3)) || 1; for (let k = 0; k < HV; k++) { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; acc[k] += a & 1 ? 1 : -1; } }
  for (let k = 0; k < HV; k++) acc[k] = acc[k] >= 0 ? 1 : -1;
  return acc;
}
export const hvSim = (a, b) => { let s = 0; for (let k = 0; k < HV; k++) s += a[k] * b[k]; return s / HV; };
/** an order-0..3 character model (PPM-like blend): bits(model, text) scores a word before learn(model, text) teaches it. Pure on P. */
export const makePpm = () => ({ counts: new Map(), seen: 0 });
export function ppmBits(P, text) {
  const t = String(text).toLowerCase(); let bits = 0;
  for (let i = 0; i < t.length; i++) {
    let p = 1 / 40, wsum = 0.15; p *= wsum; // order -1: a uniform floor
    for (let o = 0; o <= 3 && o <= i; o++) { const c = P.counts.get(t.slice(i - o, i)); if (!c) continue; const tot = c.get('') || 0; if (!tot) continue; const w = 0.2 + o * 0.3; p += w * ((c.get(t[i]) || 0) / tot); wsum += w; }
    bits += -Math.log2(p / wsum);
  }
  return bits;
}
export function ppmLearn(P, text) {
  const t = String(text).toLowerCase();
  for (let i = 0; i < t.length; i++) for (let o = 0; o <= 3 && o <= i; o++) { const ctx = t.slice(i - o, i); let c = P.counts.get(ctx); if (!c) { c = new Map(); P.counts.set(ctx, c); } c.set(t[i], (c.get(t[i]) || 0) + 1); c.set('', (c.get('') || 0) + 1); }
  P.seen += t.length; return P;
}
export const STOP = new Set('and the an of to in on at is are was it its for with me my you your we our us this that these those be or but so if as by from show tell give let what how why who when where do does did can will would just about please some any'.split(' '));
export const cleanWords = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9' -]+/g, ' ').split(/\s+/).map((w) => w.replace(/^'+|'+$/g, '')).filter((w) => w.length > 1 && w.length < 24 && !STOP.has(w)).slice(0, 8); // little words carry no idea of their own
export const makeConcepts = () => ({ words: [], hv: [], node: [], edges: new Map(), ppm: makePpm(), pending: [], lastBits: 0 });
const eKey = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
/** add a phrase's words: new words become nodes placed near the brain's focus; words typed together are linked. Returns the words. */
export function addPhrase(b, text) {
  const C = b.concepts, ws = b.ws, words = cleanWords(text), ids = [];
  for (const w of words) {
    const bits = ppmBits(C.ppm, w) / Math.max(1, w.length); ppmLearn(C.ppm, w); C.lastBits = Math.round(bits * 100) / 100;
    let i = C.words.indexOf(w);
    if (i < 0) {
      if (C.words.length >= MAX_CONCEPTS) continue;
      const hv = hypervector(w), emb = new Float32Array(EMB); for (let k = 0; k < HV; k++) emb[k % EMB] += hv[k] / (HV / EMB);
      const h = fnv(w), x = clamp(b.focus.x + ((h & 255) / 255 - 0.5) * 0.3, 0.05, 0.95), y = clamp(b.focus.y + (((h >>> 8) & 255) / 255 - 0.5) * 0.3, 0.05, 0.95);
      const n = addNode(ws, { x, y, kind: KIND.concept, act: 1, emb, label: w, organ: 'concepts' }); if (n < 0) continue;
      C.words.push(w); C.hv.push(hv); C.node.push(n); i = C.words.length - 1;
      deposit(ws, 'surprise', x, y, clamp(bits / 6, 0, 1) * 0.6, 3, 'concepts'); // a word the character model did not expect is a surprise
    } else ws.nodes.act[C.node[i]] = 1;
    ids.push(i);
  }
  for (let a = 0; a < ids.length; a++) for (let c = a + 1; c < ids.length; c++) if (ids[a] !== ids[c]) { const k = eKey(ids[a], ids[c]); C.edges.set(k, (C.edges.get(k) || 0) + 1); }
  return words;
}
/** the concepts nearest a word by meaning-of-spelling (hypervector cosine) and by use (co-occurrence): [{ word, sim, linked }]. Pure. */
export function related(C, word, top = 3) {
  const i = C.words.indexOf(word); if (i < 0) return [];
  return C.words.map((w, j) => ({ word: w, sim: j === i ? -2 : hvSim(C.hv[i], C.hv[j]) + 0.3 * Math.min(3, C.edges.get(eKey(i, j)) || 0), linked: C.edges.get(eKey(i, j)) || 0 })).filter((r) => r.sim > -2).sort((p, q) => q.sim - p.sim).slice(0, top);
}
const concepts = {
  id: 'concepts', name: 'Concepts', job: 'holds the words you type as linked ideas that pass activation to each other and settle by meaning', imagine: true,
  want: (b) => (b.concepts.words.length ? 0.45 : 0),
  run(b) {
    const C = b.concepts, N = b.ws.nodes, n = C.node.length; if (!n) return 0;
    const next = new Float32Array(n);
    for (let a = 0; a < n; a++) { // message passing: a concept keeps half its activation and takes half its linked neighbours' mean
      let s = 0, c = 0; for (let j = 0; j < n; j++) { const w = C.edges.get(eKey(a, j)); if (w) { s += N.act[C.node[j]] * Math.min(3, w); c += Math.min(3, w); } }
      const near = Math.exp(-Math.hypot(N.x[C.node[a]] - b.focus.x, N.y[C.node[a]] - b.focus.y) * 6);
      next[a] = clamp(N.act[C.node[a]] * 0.94 + (c ? 0.05 * s / c : 0) + 0.02 * near, 0, 1);
    }
    for (let a = 0; a < n; a++) {
      const i = C.node[a]; N.act[i] = next[a]; let fx = 0, fy = 0;
      for (let j = 0; j < n; j++) { if (j === a) continue; const k = C.node[j], dx = N.x[k] - N.x[i], dy = N.y[k] - N.y[i], d = Math.hypot(dx, dy) + 1e-3;
        const pull = 0.3 * hvSim(C.hv[a], C.hv[j]) + 0.25 * Math.min(3, C.edges.get(eKey(a, j)) || 0); fx += (dx / d) * (pull * 0.002 - 0.00004 / (d * d)); fy += (dy / d) * (pull * 0.002 - 0.00004 / (d * d)); }
      N.vx[i] = (N.vx[i] + clamp(fx, -0.01, 0.01)) * 0.85; N.vy[i] = (N.vy[i] + clamp(fy, -0.01, 0.01)) * 0.85;
      N.x[i] = clamp(N.x[i] + N.vx[i], 0.04, 0.96); N.y[i] = clamp(N.y[i] + N.vy[i], 0.04, 0.96);
      if (N.act[i] > 0.3) deposit(b.ws, 'input', N.x[i], N.y[i], 0.03 * N.act[i], 2, 'concepts'); // an active idea lights the tissue under it
    }
    let best = -1, ba = 0; for (let a = 0; a < n; a++) if (N.act[C.node[a]] > ba) { ba = N.act[C.node[a]]; best = a; }
    b.board.thinking = best >= 0 && ba > 0.15 ? C.words[best] : null;
    return 1;
  }
};

// ---- tissue: Gray-Scott reaction-diffusion fed by everything that lands in the input and memory layers -------------------------------------
export function tissueStep(ws, feed, kill, iters = 2, owner = 'tissue', garden = null) { // garden: the gardener's feed and kill offsets per patch (lib/brain-gardener.js)
  const u = ws.layers.sub, v = ws.layers.act, inp = ws.layers.input, mem = ws.layers.memory, nu = new Float32Array(CELLS), nv = new Float32Array(CELLS);
  const o = ws.organs.indexOf(owner);
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, U = u[i], V = v[i], uvv = U * V * V, seed = inp[i] * 0.06 + mem[i] * 0.01, t = garden ? tileOf(x, y) : 0, F = garden ? feed + garden.df[t] : feed, Kl = garden ? kill + garden.dk[t] : kill;
      nu[i] = clamp(U + 0.2097 * laplacian4(u, x, y, GW, GH) - uvv + F * (1 - U) - seed, 0, 1);
      nv[i] = clamp(V + 0.105 * laplacian4(v, x, y, GW, GH) + uvv - (Kl + F) * V + seed, 0, 1);
    }
    for (let i = 0; i < CELLS; i++) { if (o >= 0 && Math.abs(nv[i] - v[i]) > 0.01) { ws.owner[i] = o; ws.wroteAt[i] = ws.tick; ws.writes[o]++; } }
    u.set(nu); v.set(nv);
  }
  return ws;
}
const tissue = {
  id: 'tissue', name: 'Tissue', job: 'the living surface: a reaction-diffusion field that grows wherever input, ideas and memory feed it', imagine: true,
  want: (b) => 0.55 + 0.4 * b.surprise,
  run(b) { tissueStep(b.ws, b.genome.feed, b.genome.kill, 2, 'tissue', b.gardener); return 1; }
};

// ---- rhythm: a Kuramoto lattice that spins faster over living tissue and locks into step (F027, F034, F442, the wave and spectral drafts) -
export function rhythmStep(b, dt = 1 / 30) {
  const ws = b.ws, act = ws.layers.act, theta = new Float32Array(RG * RH), om = new Float32Array(RG * RH);
  for (let i = 0; i < RG * RH; i++) {
    const rx = i % RG, ry = Math.floor(i / RG); let a = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) a += act[(ry * 4 + y) * GW + rx * 4 + x]; a /= 16;
    theta[i] = ws.phase[i] * TAU; om[i] = TAU * b.genome.spin * (ws.omega[i] + a * 0.5);
  }
  kuramoto(theta, om, RG, RH, b.genome.couple * (0.6 + b.surprise), 1.5, dt, 0.02, ws.rand, null);
  for (let i = 0; i < RG * RH; i++) ws.phase[i] = theta[i] / TAU;
  return ws;
}
const rhythm = {
  id: 'rhythm', name: 'Rhythm', job: 'a lattice of oscillators that falls into step; its order is how together the brain is, and what you hear', imagine: true,
  want: (b) => 0.4 + 0.3 * b.metrics.activity,
  run(b) { rhythmStep(b); return 1; }
};

// ---- swarm: particle life that also senses tissue ahead and turns to it like a slime mould (F310, F306, the swarm and fluid drafts) -------
export function seedSwarm(b) { const ws = b.ws, r = ws.rand; for (let i = 0; i < PARTICLES; i++) { const n = addNode(ws, { x: r(), y: r(), kind: i % SPECIES, organ: 'swarm' }); if (n >= 0) { ws.nodes.vx[n] = (r() - 0.5) * 0.004; ws.nodes.vy[n] = (r() - 0.5) * 0.004; } } }
const plForce = (d, rmax, m) => { const beta = 0.3, q = d / rmax; return q < beta ? q / beta - 1 : q < 1 ? m * (1 - Math.abs(2 * q - 1 - beta) / (1 - beta)) : 0; };
export function swarmStep(b) {
  const ws = b.ws, N = ws.nodes, g = b.genome, act = ws.layers.act, ids = b.swarmIds, rmax = 0.1, drive = b.board.drive || 'rest', f = b.focus;
  const M = [[g.m00, g.m01, g.m02], [g.m10, g.m11, g.m12], [g.m20, g.m21, g.m22]], o = ws.organs.indexOf('swarm');
  const tx = b.senses.feat[4] * 0.0004, ty = b.senses.feat[5] * 0.0004;
  for (const i of ids) {
    let ax = 0, ay = 0;
    for (const j of ids) { if (i === j) continue; let dx = N.x[j] - N.x[i], dy = N.y[j] - N.y[i]; const d = Math.hypot(dx, dy); if (d > rmax || d < 1e-5) continue; const F = plForce(d, rmax, M[N.kind[i]][N.kind[j]]); ax += (dx / d) * F; ay += (dy / d) * F; }
    ax *= 0.0006; ay *= 0.0006;
    // Physarum: sense the tissue at three points ahead and turn toward the richest
    const h = Math.atan2(N.vy[i], N.vx[i]) || 0, sd = 0.04, sa = 0.5, at = (a) => act[cellOf(N.x[i] + Math.cos(h + a) * sd, N.y[i] + Math.sin(h + a) * sd)];
    const L = at(-sa), C = at(0), R = at(sa), turn = (R > C && R > L ? sa : L > C && L > R ? -sa : 0) * g.sense * 0.2, sp = Math.hypot(N.vx[i], N.vy[i]) || 0.002;
    const nh = h + turn; ax += (Math.cos(nh) * sp - N.vx[i]) * 0.5; ay += (Math.sin(nh) * sp - N.vy[i]) * 0.5;
    // the phase of the rhythm under a particle nudges it: the swarm is entrained by the oscillators
    const ph = ws.phase[Math.min(RH - 1, Math.floor(N.y[i] * RH)) * RG + Math.min(RG - 1, Math.floor(N.x[i] * RG))] * TAU; ax += Math.cos(ph) * 0.00005; ay += Math.sin(ph) * 0.00005;
    const dx = f.x - N.x[i], dy = f.y - N.y[i], d = Math.hypot(dx, dy) + 1e-4;
    if (drive === 'gather') { ax += (dx / d) * 0.0002; ay += (dy / d) * 0.0002; }
    else if (drive === 'scatter' && d < 0.3) { ax -= (dx / d) * 0.00025; ay -= (dy / d) * 0.00025; }
    else if (drive === 'swirl' && d < 0.4) { ax += (-dy / d) * 0.00025 + (dx / d) * 0.00005; ay += (dx / d) * 0.00025 + (dy / d) * 0.00005; }
    N.vx[i] = clamp((N.vx[i] + ax + tx) * 0.96, -0.012, 0.012); N.vy[i] = clamp((N.vy[i] + ay + ty) * 0.96, -0.012, 0.012);
    N.x[i] += N.vx[i]; N.y[i] += N.vy[i]; if (N.x[i] < 0) N.x[i] += 1; if (N.x[i] >= 1) N.x[i] -= 1; if (N.y[i] < 0) N.y[i] += 1; if (N.y[i] >= 1) N.y[i] -= 1;
    const c = cellOf(N.x[i], N.y[i]); ws.layers.input[c] = Math.min(1, ws.layers.input[c] + 0.006); if (o >= 0) { ws.owner[c] = o; ws.wroteAt[c] = ws.tick; ws.writes[o]++; } // grazing particles feed the tissue: a loop
  }
  return ws;
}
const swarm = {
  id: 'swarm', name: 'Swarm', job: 'three species of particles that attract and chase each other, follow living tissue, and feed it', imagine: true,
  want: () => 0.5,
  run(b) { swarmStep(b); return 1; }
};

// ---- membrane: a soft body that wraps the focus and swells with the tissue inside it (F178, F192, F218, F268, the softbody and cloth drafts)
export function seedMembrane(b) { const ws = b.ws; for (let k = 0; k < MEMBRANE; k++) { const a = (k / MEMBRANE) * TAU; addNode(ws, { x: 0.5 + Math.cos(a) * 0.12, y: 0.5 + Math.sin(a) * 0.12, kind: KIND.membrane, organ: 'membrane' }); } }
export function membraneStep(b) {
  const ws = b.ws, N = ws.nodes, ids = b.membraneIds, n = ids.length, f = b.focus; if (!n) return 0;
  let cx = 0, cy = 0; for (const i of ids) { cx += N.x[i]; cy += N.y[i]; } cx /= n; cy /= n;
  const inside = readRegion(ws, 'act', { x0: cx - 0.1, y0: cy - 0.1, x1: cx + 0.1, y1: cy + 0.1 }).mean, R0 = 0.08 + clamp(inside * 1.2, 0, 0.1), rest = (TAU * R0) / n;
  const gx = b.senses.feat[4] * 0.0003, gy = 0.00008 + b.senses.feat[5] * 0.0003;
  for (let k = 0; k < n; k++) {
    const i = ids[k], p = ids[(k + n - 1) % n], q = ids[(k + 1) % n]; let ax = 0, ay = 0;
    for (const j of [p, q]) { const dx = N.x[j] - N.x[i], dy = N.y[j] - N.y[i], d = Math.hypot(dx, dy) + 1e-6; ax += (dx / d) * (d - rest) * 0.25; ay += (dy / d) * (d - rest) * 0.25; }
    const rx = N.x[i] - cx, ry = N.y[i] - cy, rd = Math.hypot(rx, ry) + 1e-6; ax += (rx / rd) * (R0 - rd) * 0.08; ay += (ry / rd) * (R0 - rd) * 0.08; // pressure
    ax += (f.x - cx) * 0.01 + gx; ay += (f.y - cy) * 0.01 + gy; // the skin follows the focus; tilt is its gravity
    N.vx[i] = (N.vx[i] + ax) * 0.82; N.vy[i] = (N.vy[i] + ay) * 0.82; N.x[i] = clamp(N.x[i] + N.vx[i], 0.01, 0.99); N.y[i] = clamp(N.y[i] + N.vy[i], 0.01, 0.99);
  }
  b.board.membrane = { swell: Math.round(clamp((R0 - 0.08) / 0.1, 0, 1) * 100) / 100 };
  return 1;
}
const membrane = {
  id: 'membrane', name: 'Membrane', job: 'a soft skin that wraps what the brain attends to and swells with how alive it is there', imagine: true,
  want: (b) => 0.3 + clamp(Math.hypot(b.focus.x - b.focus.px, b.focus.y - b.focus.py) * 20, 0, 0.6),
  run(b) { return membraneStep(b); }
};

// ---- will: tabular Q-learning over (gesture, surprise) that picks what the brain does, checked by imagination first (F301, the RL drafts) --
export const ACTIONS = ['rest', 'seed', 'gather', 'swirl', 'scatter', 'recall'];
export const WILL_EVERY = 45, STATES = (K + 1) * 3;
export const makeWill = () => ({ q: new Float32Array(STATES * ACTIONS.length), state: 0, action: 0, util0: 0, since: 0, chosen: 0, imagined: null, reward: 0, good: 0, td: 0 });
export const stateOf = (sym, surprise) => (sym + 1) * 3 + (surprise > 0.6 ? 2 : surprise > 0.25 ? 1 : 0);
/** a Q-learning update. Pure on W. */
export function qUpdate(W, s, a, r, s2, alpha = 0.3, gamma = 0.8) {
  let mx = -Infinity; for (let k = 0; k < ACTIONS.length; k++) mx = Math.max(mx, W.q[s2 * ACTIONS.length + k]);
  const i = s * ACTIONS.length + a, td = r + gamma * mx - W.q[i]; W.q[i] += alpha * td; W.td = td; return td;
}
/** the action's effect this tick: the brain's own hand. Writes the input layer as 'will'. */
export function applyAction(b, a) {
  const name = ACTIONS[a]; b.board.drive = name;
  if (name === 'seed') deposit(b.ws, 'input', b.focus.x, b.focus.y, 0.12, 3, 'will');
  if (name === 'recall' && b.memory.expect >= 0) { const c = regionCenter(b.memory.expect); deposit(b.ws, 'input', c.x, c.y, 0.08, 4, 'will'); }
}
const will = {
  id: 'will', name: 'Will', job: 'decides what the brain does next (seed, gather, swirl, scatter, recall or rest) and learns from what helped',
  want: (b) => (b.will.since >= WILL_EVERY ? 1 : 0.35),
  run(b, input, imagineFn) {
    const W = b.will; // W.since counts brain ticks (stepBrain), not runs, so a busy tick does not delay the decision
    applyAction(b, W.action);
    if (W.since < WILL_EVERY || !imagineFn) return 1;
    const util = b.utility, s2 = stateOf(b.gestures.sym, b.surprise);
    const r = (util - W.util0) * 6 + W.good * 0.6 + (b.senses.over ? 0.05 : 0); W.reward = Math.round(r * 100) / 100; W.good = 0;
    qUpdate(W, W.state, W.action, r, s2);
    // choose: the two best by Q (or one at random now and then), each imagined forward; the better imagined future wins
    // what each action did in states like this one (episodic memory) and what the visitor approved of (preference) join the Q-values
    const prior = b.mind ? episodicPrior(b, keyOf(b)) : null; W.prior = prior ? Array.from(prior.gain, (v) => Math.round(v * 1000) / 1000) : null;
    const row = Array.from({ length: ACTIONS.length }, (_, k) => [k, W.q[s2 * ACTIONS.length + k] + (prior ? prior.gain[k] * 3 : 0) + (b.mind ? b.mind.pref[k] * 0.3 : 0)]).sort((p, q) => q[1] - p[1]);
    const explore = b.ws.rand() < 0.2 ? Math.floor(b.ws.rand() * ACTIONS.length) : row[1][0], cands = [...new Set([row[0][0], explore])];
    const futures = cands.map((a) => ({ a, u: imagineFn(b, { action: a, steps: 24 }) }));
    futures.sort((p, q) => q.u - p.u);
    W.imagined = futures.map((x) => ({ action: ACTIONS[x.a], utility: Math.round(x.u * 1000) / 1000 }));
    W.state = s2; W.action = futures[0].a; W.util0 = util; W.since = 0; W.chosen++;
    if (b.mind) recordEpisode(b, W.action, util);
    b.board.action = { name: ACTIONS[W.action], imagined: W.imagined, reward: W.reward };
    return 1;
  }
};

// ---- arena: competing genomes for the whole brain, judged by imagining the brain with each one; the winner is sealed (the genome drafts) ---
export const POP = 6, ARENA_EVERY = 150;
export function makeArena(seed) { const r = rng(seed * 40503 + 7); const pop = [{ ...STARTER }]; while (pop.length < POP) pop.push(mutate({ ...STARTER }, GENOME_SPEC, r, 0.5, 0.2)); return { pop, fit: new Array(POP).fill(null), champ: 0, gen: 0, since: ARENA_EVERY - 30, r, last: null }; }
const arena = {
  id: 'arena', name: 'Arena', job: 'six genomes for the whole brain compete in imagined futures; the winner runs the brain and is sealed',
  want: (b) => (b.arena.since >= ARENA_EVERY ? 0.9 : 0.05),
  run(b, input, imagineFn) {
    const A = b.arena;
    if (A.since < ARENA_EVERY || !imagineFn) return 0;
    A.since = 0; A.gen++;
    // judge two: the champion again (the world has changed) and one challenger; the worst genome is replaced by a child of the best
    const ch = A.champ, other = 1 + (A.gen % (POP - 1)), idxs = [ch, (ch + other) % POP];
    for (const i of idxs) A.fit[i] = imagineFn(b, { genome: fixGenome(A.pop[i]), steps: 36 });
    let best = 0, worst = 0; for (let i = 0; i < POP; i++) { if ((A.fit[i] ?? -1) > (A.fit[best] ?? -1)) best = i; if ((A.fit[i] ?? -1) < (A.fit[worst] ?? -1)) worst = i; }
    const prev = A.champ; A.champ = best;
    // the worst is replaced by a child of the best, or, every third generation, by the genome that last won in this context (procedural memory)
    const kept = b.mind && A.gen % 3 === 0 ? bestProcedure(b) : null;
    if (worst !== best) { A.pop[worst] = kept ? fixGenome(kept.genome) : mutate({ ...A.pop[best] }, GENOME_SPEC, A.r, 0.4, 0.15); A.fit[worst] = null; A.fromMemory = !!kept; }
    if (b.mind && A.fit[best] != null) recordProcedure(b, fixGenome(A.pop[best]), A.fit[best]);
    b.genome = fixGenome(A.pop[A.champ]);
    A.last = { gen: A.gen, champ: A.champ, changed: prev !== A.champ, fitness: Math.round((A.fit[A.champ] ?? 0) * 1000) / 1000 };
    b.board.genome = A.last;
    return 1;
  }
};

export const ORGANS = [senses, predictor, gestures, memory, concepts, tissue, gardener, rhythm, synapses, creature, hearing, swarm, membrane, painter, grower, formula, current, will, arena];
export const ORGAN_IDS = ORGANS.map((o) => o.id);
export { randomGenome };
export const _private = { kuramoto, idx, writeCell, regionOf, nodesOf };
