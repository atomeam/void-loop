// brain-gardener, Verse Brain's tissue kept at the edge of chaos, from F215 (codec retina gardener, atomeam/a-to-mind.com drafts/). Owner,
// 2026-10-29: "combine all the builds into one entity", "dont fake it". F215's idea: a video codec is a free model of surprise, because the
// bytes in a delta frame are what motion-compensated prediction could not explain; a gardener that reads them per patch can keep every
// patch of a Gray-Scott world between dead and noise. Here:
//   1. the retina: the tissue (lib/brain-organs.js tissueStep) cut into 4 x 4 patches of 16 x 12 cells. Each blink (every BLINK ticks) a
//      patch's activity is quantized to 8 levels, the last blink is shifted by the best of 9 small moves (motion compensation), and what
//      is left is coded with an LZ78 count (lzBits). Its surprise is log2(1 + those bits), smoothed. F215's retina was 16 WebCodecs
//      VideoEncoders; the brain is pure and runs in node too, so this is the same measure made by a small coder of its own.
//   2. the classes: dead (no surprise, nothing moves), flow (it moves the way the last blink said), novel (in the band: it moves in ways
//      the coder could not predict) and noise (above the band).
//   3. the gardener: every THINK blinks it attends to the patches furthest from the band (3 a thought) and acts on each: seed fresh life,
//      steer the patch's feed and kill half way toward a regime measured on this tissue (waves, ripples, pulses or calm), or wait. Values per patch and zone
//      (below, in, above the band), with shared priors, epsilon 0.2; the reward is the drop in band distance 24 blinks later.
//   The patch's own feed and kill are offsets on the genome's, so the arena still evolves the tissue and the gardener tends each patch.
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { GW, GH, deposit } from './brain-workspace.js';

// the LZ78 count of lib/brain-organs.js (lzBits), here so this file needs nothing from the organ list that names it
const lzBits = (s) => { const seen = new Set(); let w = '', p = 0; for (const ch of s) { const t = w + ch; if (seen.has(t)) w = t; else { seen.add(t); p++; w = ''; } } if (w) p++; return p * Math.log2(p + 1); };
export const NX = 4, NY = 4, TILES = NX * NY, TW = GW / NX, TH = GH / NY, LEVELS = 8, BLINK = 4, THINK = 6, DUE = 24, FOCUS = 3;
// the band is the middle third between what the coder says of a still patch and of a patch of pure noise (15 levels of change at random)
const STILL = Math.log2(1 + lzBits('H'.repeat(TW * TH)));
const NOISE = (() => { const r = rng(12345); let s = ''; for (let i = 0; i < TW * TH; i++) s += String.fromCharCode(65 + Math.floor(r() * 15)); return Math.log2(1 + lzBits(s)); })();
export const BAND = [STILL + (NOISE - STILL) / 3, STILL + (2 * (NOISE - STILL)) / 3]; // log2(1 + bits) a blink: about 7.4 to 8.4
export const MID = (BAND[0] + BAND[1]) / 2;
// measured on the brain's own tissue (2 Gray-Scott steps a tick, 64x48): the low-feed wave region is the liveliest here (surprise 7.3-7.7 bits a
// patch); F215's spots, coral and worms all settle calm (about 6.7), so spots is kept only as the way to calm a patch that runs too wild.
export const REG = { waves: [0.022, 0.051], ripples: [0.02, 0.049], pulses: [0.014, 0.051], calm: [0.0367, 0.0649] };
export const ACTS = ['seed', 'waves', 'ripples', 'pulses', 'calm', 'wait'];
const NA = ACTS.length, ZONES = ['below', 'in', 'above'];
const PRIOR = { below: [0.05, 0.1, 0.1, 0.05, 0, 0], in: [0, 0, 0, 0, 0, 0.05], above: [0, 0, 0, 0, 0.1, 0.05] };

/** a new gardener: every patch on the genome's feed and kill, an empty retina. */
export function makeGardener(seed = 1) {
  return { rand: rng((seed * 2654435761) >>> 0 || 1), on: true, since: 0, rescues: 0, blinks: 0, prev: null, s: new Float32Array(TILES).fill(4), moved: new Float32Array(TILES),
    df: new Float32Array(TILES), dk: new Float32Array(TILES), q: Array.from({ length: TILES }, () => ZONES.map(() => new Array(NA).fill(0))), prior: ZONES.map((z) => PRIOR[z].slice()),
    pending: [], thoughts: 0, acts: new Array(NA).fill(0), rewards: [], focus: -1, lastThink: 0, inBand: 0 };
}
export const tileOf = (x, y) => Math.floor(y / TH) * NX + Math.floor(x / TW);
const level = (v) => Math.min(LEVELS - 1, Math.floor(clamp(v * 3.2, 0, 0.999) * LEVELS));
/** the surprise of one patch: the LZ bits of what is left after the best of 9 shifted predictions from the last blink. Pure. */
export function patchBits(cur, prev, t) {
  const x0 = (t % NX) * TW, y0 = Math.floor(t / NX) * TH;
  let best = Infinity, still = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    let s = '', same = 0;
    for (let y = y0; y < y0 + TH; y++) for (let x = x0; x < x0 + TW; x++) {
      const px = (x + dx + GW) % GW, py = (y + dy + GH) % GH, r = cur[y * GW + x] - prev[py * GW + px];
      if (!r) same++; s += String.fromCharCode(72 + clamp(r, -7, 7));
    }
    const bits = lzBits(s); if (bits < best) best = bits;
    if (!dx && !dy) still = same / (TW * TH);
  }
  return { bits: Math.log2(1 + best), moved: 1 - still };
}
/** one blink of the retina on the activity layer. Pure on G. */
export function blink(G, act) {
  const cur = Uint8Array.from(act, level);
  if (G.prev) for (let t = 0; t < TILES; t++) { const p = patchBits(cur, G.prev, t); G.s[t] += (p.bits - G.s[t]) * 0.35; G.moved[t] += (p.moved - G.moved[t]) * 0.35; }
  G.prev = cur; G.blinks++;
  let n = 0; for (let t = 0; t < TILES; t++) if (inBand(G, t)) n++; G.inBand = n;
  return n;
}
export const inBand = (G, t) => G.s[t] >= BAND[0] && G.s[t] <= BAND[1];
export const zoneOf = (G, t) => (G.s[t] < BAND[0] ? 0 : G.s[t] > BAND[1] ? 2 : 1);
export const distOf = (G, t) => Math.max(0, BAND[0] - G.s[t], G.s[t] - BAND[1]) + Math.abs(G.s[t] - MID) * 0.15;
export function classOf(G, t) { const z = zoneOf(G, t); return z === 2 ? 'noise' : z === 1 ? 'novel' : G.moved[t] > 0.05 ? 'flow' : 'dead'; }
const qOf = (G, t, z) => G.q[t][z].map((v, i) => v + G.prior[z][i]);
/** act on a patch: seed (three small spots of fresh life in the input layer the tissue grows from), steer half way to a regime, or wait. */
export function act(b, t, a) {
  const G = b.gardener, x0 = (t % NX) * TW, y0 = Math.floor(t / NX) * TH;
  if (a === 0) for (let k = 0; k < 3; k++) deposit(b.ws, 'input', (x0 + 2 + G.rand() * (TW - 4)) / GW, (y0 + 2 + G.rand() * (TH - 4)) / GH, 0.5, 2, 'gardener');
  else if (a < 5) {
    const r = REG[ACTS[a]], f = b.genome.feed + G.df[t], k = b.genome.kill + G.dk[t];
    G.df[t] = clamp(G.df[t] + (r[0] - f) * 0.5, 0.008 - b.genome.feed, 0.09 - b.genome.feed); G.dk[t] = clamp(G.dk[t] + (r[1] - k) * 0.5, 0.04 - b.genome.kill, 0.07 - b.genome.kill);
  }
  G.acts[a]++;
}
/** attend to the patches furthest from the band and act on each one that has nothing still playing out. Pure on b. */
export function think(b) {
  const G = b.gardener; G.thoughts++;
  const order = [...Array(TILES).keys()].sort((x, y) => distOf(G, y) - distOf(G, x));
  const chosen = order.slice(0, FOCUS).filter((t) => distOf(G, t) > 0.05 || G.rand() < 0.15);
  G.focus = chosen.length ? chosen[0] : -1;
  for (const t of chosen) {
    if (G.pending.some((p) => p.t === t)) continue;
    const z = zoneOf(G, t), q = qOf(G, t, z);
    let a = q.indexOf(Math.max(...q)); if (G.rand() < 0.2) a = Math.floor(G.rand() * NA);
    act(b, t, a); G.pending.push({ t, a, z, d0: distOf(G, t), due: G.blinks + DUE });
  }
}
/** the whole garden first: each blink every patch's steer eases 1% back to the brain's own feed and kill, so a steer lasts only while it
 *  keeps paying; and when the whole tissue is nearly dead or nearly full (mean activity under 0.06 or over 0.23, the brain's activity
 *  metric under 0.24 or over 0.92) every steer is halved and the quietest patches are seeded, so tending a patch never costs the field. */
export function tend(b) {
  const G = b.gardener, A = b.ws.layers.act; let sum = 0; for (let i = 0; i < A.length; i++) sum += A[i];
  const mean = sum / A.length; for (let t = 0; t < TILES; t++) { G.df[t] *= 0.99; G.dk[t] *= 0.99; }
  if (!G.on || (mean >= 0.06 && mean <= 0.23)) return false;
  for (let t = 0; t < TILES; t++) { G.df[t] *= 0.5; G.dk[t] *= 0.5; }
  if (mean < 0.06) [...Array(TILES).keys()].sort((x, y) => G.s[x] - G.s[y]).slice(0, 4).forEach((t) => act(b, t, 0));
  G.rescues++; return true;
}
/** the reward for each action whose time is up: how much nearer the band its patch came. Pure on G. */
export function learn(G) {
  G.pending = G.pending.filter((p) => {
    if (G.blinks < p.due) return true;
    const r = p.d0 - distOf(G, p.t); G.rewards.push(r); if (G.rewards.length > 200) G.rewards.shift();
    G.q[p.t][p.z][p.a] += (r - G.q[p.t][p.z][p.a]) * 0.3; G.prior[p.z][p.a] += (r - G.prior[p.z][p.a]) * 0.05;
    return false;
  });
}
/** the gardener for the self (lib/brain.js selfOf): numbers only. */
export function gardenerOf(G) {
  const mean = G.rewards.length ? G.rewards.reduce((a, v) => a + v, 0) / G.rewards.length : 0, classes = { dead: 0, flow: 0, novel: 0, noise: 0 };
  for (let t = 0; t < TILES; t++) classes[classOf(G, t)]++;
  return { blinks: G.blinks, inBand: G.inBand, thoughts: G.thoughts, acts: Object.fromEntries(ACTS.map((a, i) => [a, G.acts[i]])), reward: Math.round(mean * 1000) / 1000, classes, focus: G.focus };
}
/** what the gardener learned, as numbers for slow knowledge (lib/brain-mind.js knowledgeOf): the patch offsets, values and priors. */
export const gardenOf = (G) => ({ df: Array.from(G.df, (v) => Math.round(v * 1e5) / 1e5), dk: Array.from(G.dk, (v) => Math.round(v * 1e5) / 1e5), q: G.q.map((zs) => zs.map((r) => r.map((v) => Math.round(v * 1000) / 1000))), prior: G.prior.map((r) => r.map((v) => Math.round(v * 1000) / 1000)) });
/** put kept gardening back. Anything not of the right shape and range is refused and changes nothing. Returns true when it loaded. */
export function loadGarden(G, k) {
  const nums = (a, n, lo, hi) => Array.isArray(a) && a.length === n && a.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi);
  if (!k || !nums(k.df, TILES, -0.1, 0.1) || !nums(k.dk, TILES, -0.1, 0.1) || !nums(k.prior && k.prior.flat ? k.prior.flat() : null, ZONES.length * NA, -2, 2) || !Array.isArray(k.prior) || k.prior.length !== ZONES.length
    || !Array.isArray(k.q) || k.q.length !== TILES || !k.q.every((zs) => Array.isArray(zs) && zs.length === ZONES.length && zs.every((r) => nums(r, NA, -2, 2)))) return false;
  G.df = Float32Array.from(k.df); G.dk = Float32Array.from(k.dk); G.q = k.q.map((zs) => zs.map((r) => r.slice())); G.prior = k.prior.map((r) => r.slice());
  return true;
}

export const gardener = {
  id: 'gardener', name: 'Gardener', job: 'reads how surprising each patch of the tissue is with a small video-style coder, and tends the patches back to the edge of chaos',
  want: (b) => (b.gardener.since >= BLINK ? 0.7 : 0.02),
  run(b) {
    const G = b.gardener; // G.since counts ticks in stepBrain (lib/brain.js)
    if (G.since < BLINK) return 0;
    G.since = 0; blink(G, b.ws.layers.act); learn(G); tend(b);
    if (G.on && G.blinks > 20 && G.blinks - G.lastThink >= THINK) { G.lastThink = G.blinks; think(b); }
    const t = G.focus; b.board.garden = { inBand: G.inBand, focus: t, x: t >= 0 ? ((t % NX) + 0.5) / NX : 0.5, y: t >= 0 ? (Math.floor(t / NX) + 0.5) / NY : 0.5, cls: t >= 0 ? classOf(G, t) : '', tick: b.ticks };
    return 1;
  }
};
