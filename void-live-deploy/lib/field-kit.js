// field-kit — the pure half of Verse's "field minds" (the Grok frontier ideas F-020..F-033, asked by the owner, 2026-10-17: "all of
// Grok's ideas are to be added to Verse"). A field mind is a small simulated substrate (particles, a grid, a lattice) plus a tiny
// local mind that reads the field and lets the card around it change. This file has no DOM and no clock: everything is a function of
// its arguments, deterministic by seed, so each idea's law can be tested with numbers instead of pixels. The DOM half is
// lib/field-stage.js; how to add the next idea on the kit is docs/playbooks/field-mind.md.
//
//   rng(seed)                       seeded random, () => [0,1), with .range(a,b) .int(n) .gauss()
//   clamp lerp wrap01 map01         number helpers
//   makeGrid(w,h,fill) idx laplacian4   a Float32Array grid and its 4-neighbour Laplacian (wrapping edges)
//   makeParticles(n,rand) integrate     struct-of-arrays particles in the unit square
//   stats(arr) entropy(arr,bins) occupancyEntropy(xs,ys,n,g)   the field's numbers, entropy normalised to 0..1
//   morphOf(metrics) morphCss(morph)    metric -> plain numbers -> CSS strings (hue-rotate, blur, scale, HUD transform)
//   randomGenome mutate cross evolveStep   a small evolutionary mind (F-023, F-024, F-025)
//   audioMap(metrics) tiltOf(beta,gamma) pointerIn(x,y,rect)   inputs and the spectrum drone, as numbers
//   canonical(v) sealOf(...) seal(...) sha256Hex sha256Sync     a SHA-256 seal of params + metrics (facts, never raw input)
// metrics is always { entropy, activity, consensus, cx, cy } with each in 0..1 (cx, cy: where the field's attention is).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap01 = (v) => v - Math.floor(v);
/** v in [lo,hi] mapped to 0..1 (clamped). */
export const map01 = (v, lo, hi) => (hi === lo ? 0 : clamp((v - lo) / (hi - lo), 0, 1));
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

/** a seeded random generator (mulberry32): same seed, same sequence. */
export function rng(seed) {
  let a = (num(seed, 1) >>> 0) || 1;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (n) => Math.floor(r() * Math.max(1, n));
  r.gauss = () => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return r;
}

// ---- grids and particles -------------------------------------------------------------------------------------------------
export const makeGrid = (w, h, fill = 0) => { const g = new Float32Array(w * h); if (fill) g.fill(fill); return g; };
export const idx = (x, y, w, h) => ((y + h) % h) * w + ((x + w) % w);
/** the 4-neighbour Laplacian at (x,y) of a w*h grid with wrapping edges. */
export const laplacian4 = (g, x, y, w, h) => g[idx(x - 1, y, w, h)] + g[idx(x + 1, y, w, h)] + g[idx(x, y - 1, w, h)] + g[idx(x, y + 1, w, h)] - 4 * g[idx(x, y, w, h)];

/** n particles in the unit square, at rest or with a small random speed. */
export function makeParticles(n, rand, speed = 0) {
  const p = { n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n) };
  for (let i = 0; i < n; i++) { p.x[i] = rand(); p.y[i] = rand(); if (speed) { const a = rand() * 6.2832; p.vx[i] = Math.cos(a) * speed; p.vy[i] = Math.sin(a) * speed; } }
  return p;
}
/** one Euler step with drag, then wrap the unit square (or bounce when wrap is false). */
export function integrate(p, dt, drag = 0, wrap = true) {
  const k = Math.max(0, 1 - drag * dt);
  for (let i = 0; i < p.n; i++) {
    p.vx[i] *= k; p.vy[i] *= k; p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
    if (wrap) { p.x[i] = wrap01(p.x[i]); p.y[i] = wrap01(p.y[i]); }
    else { if (p.x[i] < 0 || p.x[i] > 1) { p.vx[i] = -p.vx[i]; p.x[i] = clamp(p.x[i], 0, 1); } if (p.y[i] < 0 || p.y[i] > 1) { p.vy[i] = -p.vy[i]; p.y[i] = clamp(p.y[i], 0, 1); } }
  }
  return p;
}

// ---- the field's numbers --------------------------------------------------------------------------------------------------
/** { mean, variance, min, max } of an array. */
export function stats(arr) {
  const n = arr.length; if (!n) return { mean: 0, variance: 0, min: 0, max: 0 };
  let s = 0, mn = Infinity, mx = -Infinity; for (let i = 0; i < n; i++) { const v = arr[i]; s += v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const mean = s / n; let q = 0; for (let i = 0; i < n; i++) { const d = arr[i] - mean; q += d * d; }
  return { mean, variance: q / n, min: mn, max: mx };
}
/** Shannon entropy of the values' histogram over [lo,hi], normalised to 0..1 (0 = every value in one bin, 1 = evenly spread). */
export function entropy(arr, bins = 16, lo = 0, hi = 1) {
  const n = arr.length; if (!n || bins < 2) return 0;
  const c = new Float64Array(bins); for (let i = 0; i < n; i++) c[Math.min(bins - 1, Math.floor(map01(arr[i], lo, hi) * bins))]++;
  let h = 0; for (let b = 0; b < bins; b++) if (c[b]) { const p = c[b] / n; h -= p * Math.log2(p); }
  return clamp(h / Math.log2(bins), 0, 1);
}
/** entropy of where n unit-square points sit on a g*g occupancy grid, 0..1. Points bunched in one cell: 0. Spread evenly: 1. */
export function occupancyEntropy(xs, ys, n, g = 8) {
  if (!n) return 0; const c = new Float64Array(g * g);
  for (let i = 0; i < n; i++) c[Math.min(g - 1, Math.floor(clamp(xs[i], 0, 1) * g)) + g * Math.min(g - 1, Math.floor(clamp(ys[i], 0, 1) * g))]++;
  let h = 0; for (let k = 0; k < c.length; k++) if (c[k]) { const p = c[k] / n; h -= p * Math.log2(p); }
  return clamp(h / Math.log2(g * g), 0, 1);
}

// ---- metric -> morph -----------------------------------------------------------------------------------------------------
/** the card's change as plain numbers, from the metrics: hue (degrees), blur (px, on the canvas), scale, the HUD's shift (px) and tilt (deg), corner radius (px), glow 0..1. */
export function morphOf(m = {}, base = 200) {
  const e = clamp(num(m.entropy), 0, 1), a = clamp(num(m.activity), 0, 1), c = clamp(num(m.consensus), 0, 1);
  const cx = clamp(num(m.cx, 0.5), 0, 1), cy = clamp(num(m.cy, 0.5), 0, 1);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    hue: r1((num(base) + e * 140 + c * 30) % 360),
    blur: r1(clamp(e * a * 1.5, 0, 1.5)),
    scale: Math.round((1 + (a - 0.5) * 0.12) * 1000) / 1000,
    hudX: r1((cx - 0.5) * 12), hudY: r1((cy - 0.5) * 8), hudTilt: r1((c - 0.5) * 4),
    radius: r1(8 + e * 20), glow: Math.round(a * 100) / 100
  };
}
/** a morph as CSS strings and custom properties. For the CARD only; the page is never touched. */
export function morphCss(mo) {
  return {
    filter: 'hue-rotate(' + mo.hue + 'deg)', canvasFilter: mo.blur > 0 ? 'blur(' + mo.blur + 'px)' : 'none',
    transform: 'scale(' + mo.scale + ')', hud: 'translate(' + mo.hudX + 'px,' + mo.hudY + 'px) rotate(' + mo.hudTilt + 'deg)',
    radius: mo.radius + 'px', glow: '0 0 ' + Math.round(mo.glow * 24) + 'px hsl(' + mo.hue + ',70%,55%)',
    vars: { '--ff-hue': String(mo.hue), '--ff-glow': String(mo.glow), '--ff-scale': String(mo.scale) }
  };
}

// ---- a small evolutionary mind (spec: { name: [lo, hi], ... }) -----------------------------------------------------------------
export const randomGenome = (spec, rand) => Object.fromEntries(Object.entries(spec).map(([k, [lo, hi]]) => [k, lo + (hi - lo) * rand()]));
export function mutate(g, spec, rand, rate = 0.3, sigma = 0.12) {
  const o = {}; for (const [k, [lo, hi]] of Object.entries(spec)) o[k] = rand() < rate ? clamp(num(g[k]) + rand.gauss() * sigma * (hi - lo), lo, hi) : num(g[k], lo);
  return o;
}
export const cross = (a, b, rand) => Object.fromEntries(Object.keys(a).map((k) => [k, rand() < 0.5 ? a[k] : b[k]]));
/** the next generation: the best two kept as they are, the rest children (crossover of two tournament winners, then mutation). Pure given rand. */
export function evolveStep(pop, fits, spec, rand, { elite = 2, rate = 0.3, sigma = 0.12 } = {}) {
  const n = pop.length, order = [...pop.keys()].sort((i, j) => fits[j] - fits[i] || i - j), next = order.slice(0, Math.min(elite, n)).map((i) => ({ ...pop[i] }));
  const pick = () => { const a = rand.int(n), b = rand.int(n); return pop[fits[a] >= fits[b] ? a : b]; };
  while (next.length < n) next.push(mutate(cross(pick(), pick(), rand), spec, rand, rate, sigma));
  return next;
}

// ---- inputs and sound, as numbers ----------------------------------------------------------------------------------------------
/** where a client point sits in a rect, 0..1 each way. */
export const pointerIn = (cx, cy, r) => ({ x: clamp((cx - r.left) / (r.width || 1), 0, 1), y: clamp((cy - r.top) / (r.height || 1), 0, 1) });
/** the device's tilt (DeviceOrientation beta/gamma, degrees) as a push in -1..1 on each axis. */
export const tiltOf = (beta, gamma) => ({ x: clamp(num(gamma) / 45, -1, 1), y: clamp(num(beta) / 45, -1, 1) });
/** the spectrum drone for the metrics: three partials (Hz) with gains, a master gain and a stereo pan. Silent when the field is. */
export function audioMap(m = {}) {
  const e = clamp(num(m.entropy), 0, 1), a = clamp(num(m.activity), 0, 1), c = clamp(num(m.consensus), 0, 1), f0 = 110 * Math.pow(2, e * 1.5);
  const r2 = (v) => Math.round(v * 100) / 100;
  return { freqs: [r2(f0), r2(f0 * (1.5 + 0.1 * c)), r2(f0 * (2 + 0.5 * e))], gains: [r2(0.5), r2(0.3 * (1 - c * 0.5)), r2(0.2 * e)], master: r2(0.02 + 0.1 * a), pan: r2(clamp((num(m.cx, 0.5) - 0.5) * 2, -1, 1)) };
}

// ---- the seal -------------------------------------------------------------------------------------------------------------------
/** a stable text for any plain value: keys sorted, numbers to 4 decimals, no undefined. */
export function canonical(v) {
  if (v == null) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4) : 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return '[' + Array.from(v, canonical).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return 'null';
}
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
/** SHA-256 of a string as hex, pure and synchronous (the test fallback; the browser uses crypto.subtle). */
export function sha256Sync(text) {
  const data = new TextEncoder().encode(String(text)), len = data.length, total = ((len + 9 + 63) >> 6) << 6, buf = new Uint8Array(total);
  buf.set(data); buf[len] = 0x80; const dv = new DataView(buf.buffer); dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296)); dv.setUint32(total - 4, (len * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0, t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), od = new DataView(out.buffer); for (let i = 0; i < 8; i++) od.setUint32(i * 4, H[i]);
  return hex(out);
}
/** SHA-256 hex of a string: crypto.subtle when the browser has it (a secure page), the pure version otherwise. */
export async function sha256Hex(text) {
  try { const s = globalThis.crypto && globalThis.crypto.subtle; if (s) return hex(new Uint8Array(await s.digest('SHA-256', new TextEncoder().encode(String(text))))); } catch (_) { /* fall through */ }
  return sha256Sync(text);
}
/** the sealed record's body: the idea, its params and metrics (numbers only), and a count; never the time and never raw pointer history, so the same field seals to the same hash. */
export function sealOf(idea, params, metrics, extra = {}) { return { idea: String(idea), params: params || {}, metrics: metrics || {}, ...extra }; }
/** the seal of an idea's params + metrics: { hash, short, text, body }. */
export async function seal(idea, params, metrics, extra) { const body = sealOf(idea, params, metrics, extra), text = canonical(body), hash = await sha256Hex(text); return { hash, short: hash.slice(0, 12), text, body }; }
export function sealSync(idea, params, metrics, extra) { const body = sealOf(idea, params, metrics, extra), text = canonical(body), hash = sha256Sync(text); return { hash, short: hash.slice(0, 12), text, body }; }
