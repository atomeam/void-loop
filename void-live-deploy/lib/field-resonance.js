// field-resonance — the spectral / resonance / sound laws of V01D's field minds, one pure module for six of Grok's drafts (asked by
// Owner, 2026-10-18: "all of groks builds should be what v01ds engine is built on"; drafts in atomeam/a-to-mind.com drafts/). Each draft's
// law is a named VARIANT with the same shape (create / step / metrics, plus a fitness the mind can replay), so one card
// (skills/resonance-mind.js) runs any of them and the next sound idea is one more variant here, not one more page:
//   resonance  F-034 Spectral Resonance Evolutionary Mind: an 8x6 Kuramoto lattice (coupling K, frequency spread, kernel width) whose phase
//              gradient carries 240 particles; the mind wants spectral variety, coherent clusters and particles spread out.
//   phase      F-027 Spectral Phase Resonance Mind: a 16x12 phase lattice whose natural-frequency band and coupling the mind tunes to the
//              RHYTHM of your pointer (zero crossings of its path, in Hz) while keeping it in step (order parameter r = |mean e^(i theta)|).
//   bands      F-044 Spectral Resonance Lattice: 240 particles whose speeds are binned into five bands (sub..ultra); the band peak is the
//              coherence, a resonance gene pulls speeds into the loudest band, and band "portals" open while it is coherent: press one and
//              the genes are reinforced toward that regime.
//   voice      F-037 Resonant Voice Lattice Mind: a 40x25 logistic + diffusion + decay lattice whose column spectrum is matched against a
//              target spectrum: the microphone's (only when the person turns it on), else a peak where the pointer is.
//   spatial    F-048 Resonant Spatial Audio Mind: 160 particles whose density features go through a 12-weight policy to a 4-partial
//              synth (base, pan, gain, detune; harmonics 1, 2, 3, 5); the synth's spectrum (modelled here, so it is testable and needs
//              no AnalyserNode) pulls particles toward its loud bins, and the mind wants a harmonic (peaked, not flat) sound.
//   predict    F-042 Predictive Audio Particle Mind: an 8->12->8 network predicts the next 8-bin spectrum (the microphone's when on,
//              else a drifting synthetic one the pointer plucks); the residual pushes 80 particles, and the mind is scored on its REAL
//              prediction error over the recent spectra (the draft scored every genome with the same number plus noise).
// Pure: no DOM, no clock, no Math.random; every number comes from the seed and the inputs. metrics(s) is the kit's
// { entropy, activity, consensus, cx, cy } (each 0..1) plus resonance (0..1, the variant's own headline number).
import { rng, clamp, wrap01, idx, makeGrid, makeParticles, occupancyEntropy, entropy, randomGenome, evolveStep } from './field-kit.js';

export const TAU = Math.PI * 2;
export const POP = 6, TRIAL = 48, MIND_EVERY = 1.2;
const DRAFTS = 'atomeam/a-to-mind.com drafts/';
export const VARIANTS = {
  resonance: { fid: 'F-034', title: 'Spectral resonance', draft: DRAFTS + 'F034-spectral-resonance-mind', how: 'an 8x6 lattice of coupled oscillators; particles ride its phase gradient' },
  phase: { fid: 'F-027', title: 'Spectral phase', draft: DRAFTS + 'F027-spectral-phase-mind', how: 'a phase lattice that tunes itself to the rhythm of your pointer' },
  bands: { fid: 'F-044', title: 'Resonance lattice', draft: DRAFTS + 'F044-spectral-resonance-lattice', how: 'particle speeds in five bands; press a band portal to reinforce it' },
  voice: { fid: 'F-037', title: 'Resonant voice', draft: DRAFTS + 'F037-resonant-voice-lattice-mind', how: 'a lattice that grows toward a spectrum: your voice if you turn the microphone on, else your pointer' },
  spatial: { fid: 'F-048', title: 'Spatial audio', draft: DRAFTS + 'F048-resonant-spatial-audio-mind', how: 'particles set a 4-partial synth; its loud bins pull the particles back' },
  predict: { fid: 'F-042', title: 'Predictive audio', draft: DRAFTS + 'F042-predictive-audio-particle-mind', how: 'a tiny network predicts the next spectrum; its error pushes the particles' }
};
export const ORDER = ['resonance', 'phase', 'bands', 'voice', 'spatial', 'predict'];
export const DEFAULT = 'resonance';
export const BANDS = ['sub', 'low', 'mid', 'high', 'ultra'];

// ---- shared spectral helpers (pure) --------------------------------------------------------------------------------------------
/** the Kuramoto order parameter of phases: { r (0 = scattered, 1 = all in step), psi (mean phase) }. */
export function orderParam(theta) {
  let c = 0, s = 0; const n = theta.length; if (!n) return { r: 0, psi: 0 };
  for (let i = 0; i < n; i++) { c += Math.cos(theta[i]); s += Math.sin(theta[i]); }
  return { r: Math.hypot(c, s) / n, psi: Math.atan2(s, c) };
}
/** one Kuramoto step on a w*h wrapping lattice: each cell's phase moves at its natural frequency (rad/s) plus K/n * sum sin(theta_j - theta_i)
 *  over neighbours within `radius` cells, plus seeded noise. Writes each cell's instantaneous frequency (Hz) into `inst`. Pure on its inputs. */
export function kuramoto(theta, omega, w, h, K, radius, dt, noise, rand, inst) {
  const n = w * h, next = new Float32Array(n), R = Math.max(1, Math.ceil(radius)), lim = (radius + 0.5) * (radius + 0.5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let sum = 0, c = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { if ((!dx && !dy) || dx * dx + dy * dy > lim) continue; sum += Math.sin(theta[idx(x + dx, y + dy, w, h)] - theta[i]); c++; }
    const rate = omega[i] + (c ? (K / c) * sum : 0) + (noise ? (rand() - 0.5) * 2 * noise * TAU : 0);
    next[i] = ((theta[i] + rate * dt) % TAU + TAU) % TAU; if (inst) inst[i] = rate / TAU;
  }
  theta.set(next); return theta;
}
/** shares of values in nb equal bins over [lo, hi] (sum 1; all zero when there are no values). */
export function shares(values, nb, lo, hi) {
  const out = new Float32Array(nb), n = values.length; if (!n) return out;
  for (let i = 0; i < n; i++) out[Math.min(nb - 1, Math.max(0, Math.floor(((values[i] - lo) / (hi - lo || 1)) * nb)))]++;
  for (let b = 0; b < nb; b++) out[b] /= n; return out;
}
/** spectral flatness (geometric mean / arithmetic mean) of a non-negative spectrum: 1 = flat noise, near 0 = a few clear peaks. */
export function flatness(spec) {
  const n = spec.length; if (!n) return 1; let lg = 0, s = 0;
  for (let i = 0; i < n; i++) { const v = Math.max(1e-6, spec[i]); lg += Math.log(v); s += v; }
  return s > 0 ? clamp(Math.exp(lg / n) / (s / n), 0, 1) : 1;
}
/** Shannon entropy of a spectrum's shape, 0..1 (0 = one bin, 1 = even). */
export function spectralEntropy(spec) {
  let s = 0; for (let i = 0; i < spec.length; i++) s += Math.max(0, spec[i]); if (!(s > 0) || spec.length < 2) return 0;
  let h = 0; for (let i = 0; i < spec.length; i++) { const p = Math.max(0, spec[i]) / s; if (p > 0) h -= p * Math.log2(p); }
  return clamp(h / Math.log2(spec.length), 0, 1);
}
/** how peaked a spectrum is: (largest share - even share) / (1 - even share), 0..1. */
export function peakedness(spec) {
  const n = spec.length; let s = 0, m = 0; for (let i = 0; i < n; i++) { s += Math.max(0, spec[i]); m = Math.max(m, spec[i]); }
  return n > 1 && s > 0 ? clamp((m / s - 1 / n) / (1 - 1 / n), 0, 1) : 0;
}
/** a spectrum resampled to nb bins (mean of the bins that fall in each) and scaled so its loudest bin is 1. */
export function resample(spec, nb) {
  const out = new Float32Array(nb), n = spec ? spec.length : 0; if (!n) return out; let mx = 0;
  for (let b = 0; b < nb; b++) { const a = Math.floor((b * n) / nb), z = Math.max(a + 1, Math.floor(((b + 1) * n) / nb)); let t = 0; for (let i = a; i < z; i++) t += +spec[i] || 0; out[b] = t / (z - a); mx = Math.max(mx, out[b]); }
  if (mx > 0) for (let b = 0; b < nb; b++) out[b] /= mx; return out;
}
/** the rhythm of a pointer path in Hz (F-027): mean crossings of its busier axis, two per cycle, over the time it took. null when too short or still. */
export function rhythmOf(xs, ys, dts) {
  const n = Math.min(xs.length, ys.length, dts.length); if (n < 8) return null;
  const varOf = (a) => { let m = 0; for (let i = 0; i < n; i++) m += a[i]; m /= n; let v = 0; for (let i = 0; i < n; i++) v += (a[i] - m) * (a[i] - m); return { m, v: v / n }; };
  const X = varOf(xs), Y = varOf(ys), a = X.v >= Y.v ? xs : ys, { m, v } = X.v >= Y.v ? X : Y; if (v < 1e-6) return null;
  let c = 0, T = 0; for (let i = 1; i < n; i++) { if ((a[i - 1] - m) * (a[i] - m) < 0) c++; T += dts[i]; }
  return c >= 2 && T > 0 ? clamp(c / (2 * T), 0.1, 4) : null;
}
/** the spectrum a set of partials makes in nb linear bins up to fmax Hz (each partial split between its two nearest bins), loudest bin 1.
 *  The model of what an AnalyserNode would show, so the F-048 loop is testable without one. */
export function synthSpectrum(freqs, gains, nb = 8, fmax = 1600) {
  const out = new Float32Array(nb);
  for (let k = 0; k < freqs.length; k++) { const p = clamp(freqs[k] / fmax, 0, 1) * nb - 0.5, i = Math.floor(p), f = p - i, g = Math.max(0, +gains[k] || 0); if (i >= 0 && i < nb) out[i] += g * (1 - f); if (i + 1 >= 0 && i + 1 < nb) out[i + 1] += g * f; }
  let mx = 0; for (let i = 0; i < nb; i++) mx = Math.max(mx, out[i]); if (mx > 0) for (let i = 0; i < nb; i++) out[i] /= mx; return out;
}
export const HARMONICS = [1, 2, 3, 5];
/** F-048's policy: 6 features through 12 weights to 8 outputs in -1..1 (out[o] = tanh(sum_f w[(o*6+f) % 12] * feat[f])). */
export function policy(w, feat) { const out = new Float32Array(8); for (let o = 0; o < 8; o++) { let s = 0; for (let f = 0; f < 6; f++) s += (w[(o * 6 + f) % 12] || 0) * (feat[f] || 0); out[o] = Math.tanh(s); } return out; }
/** the synth a policy plays: base Hz (80..300), four partials (harmonics 1, 2, 3, 5, detuned up to 5%), gains and pans. */
export function policyAudio(out) {
  const base = 80 + (out[0] * 0.5 + 0.5) * 220, gain = 0.04 + Math.max(0, out[2] * 0.5 + 0.5) * 0.12;
  return { base, freqs: HARMONICS.map((h, i) => base * h * (1 + out[4 + (i % 3)] * 0.05)), gains: HARMONICS.map((h) => gain / h), pans: HARMONICS.map((_, i) => clamp(out[1] + (i - 1.5) * 0.2, -1, 1)) };
}
export const MLP_IN = 8, MLP_HID = 12, MLP_N = MLP_IN * MLP_HID + MLP_HID + MLP_HID * MLP_IN + MLP_IN; // 212 weights
/** F-042's network: 8 inputs, 12 tanh hidden, 8 sigmoid outputs; w is the 212 numbers (w1, b1, w2, b2). */
export function mlp(input, w) {
  const h = new Float32Array(MLP_HID), out = new Float32Array(MLP_IN), b1 = MLP_IN * MLP_HID, w2 = b1 + MLP_HID, b2 = w2 + MLP_HID * MLP_IN;
  for (let i = 0; i < MLP_HID; i++) { let s = w[b1 + i]; for (let j = 0; j < MLP_IN; j++) s += input[j] * w[j * MLP_HID + i]; h[i] = Math.tanh(s); }
  for (let i = 0; i < MLP_IN; i++) { let s = w[b2 + i]; for (let j = 0; j < MLP_HID; j++) s += h[j] * w[w2 + j * MLP_IN + i]; out[i] = 1 / (1 + Math.exp(-s)); }
  return out;
}
/** the drifting spectrum F-042 listens to when there is no microphone: 8 bins at time t, plus a decaying pluck bump. */
export function synthDrift(t, bump = null) { const o = new Float32Array(8); for (let i = 0; i < 8; i++) o[i] = clamp(0.3 + 0.2 * Math.sin(t / 0.8 + i) + (bump ? bump[i] : 0), 0, 1); return o; }

// ---- genomes ---------------------------------------------------------------------------------------------------------------------
const wSpec = (n, lo, hi) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['w' + i, [lo, hi]]));
export const SPECS = {
  resonance: { K: [0.3, 3.3], spread: [0.1, 1], kernel: [0.4, 2.2] },
  phase: { K: [0.2, 3.5], freqLo: [0.2, 1.5], freqHi: [0.6, 3.5], noise: [0.01, 0.2] },
  bands: { diffusion: [0.005, 0.06], attract: [0, 1], resonance: [0, 1], decay: [0.95, 0.999] },
  voice: { diff: [0.05, 0.5], react: [0.05, 0.5], attract: [0, 0.2], decay: [0, 0.3] },
  spatial: wSpec(12, -1, 1),
  predict: wSpec(MLP_N, -1, 1)
};
/** the draft's own starting genome for a variant (the voice draft's decay 0.6 > reaction 0.08 emptied its lattice, so its reaction leads here). */
export function defaultGenome(v, seed = 1) {
  if (v === 'resonance') return { K: 1.8, spread: 0.4, kernel: 1.2 };
  if (v === 'phase') return { K: 1.4, freqLo: 0.8, freqHi: 2.2, noise: 0.05 };
  if (v === 'bands') return { diffusion: 0.02, attract: 0.4, resonance: 0.6, decay: 0.985 };
  if (v === 'voice') return { diff: 0.15, react: 0.25, attract: 0.04, decay: 0.08 };
  if (v === 'spatial') return Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['w' + i, Math.round(0.5 * Math.sin(i + 1) * 1000) / 1000])); // the fixed harmonic policy
  const r = rng(seed * 977 + 42); return Object.fromEntries(Array.from({ length: MLP_N }, (_, i) => ['w' + i, (r() - 0.5) * 0.5]));
}
/** a genome put back in range (unknown keys dropped, missing ones from the default; F-027 keeps freqHi at least 0.3 Hz above freqLo). */
export function fix(v, g, seed = 1) {
  const spec = SPECS[v], d = defaultGenome(v, seed), o = {};
  for (const [k, [lo, hi]] of Object.entries(spec)) { const x = Number(g && g[k]); o[k] = clamp(Number.isFinite(x) ? x : d[k], lo, hi); }
  if (v === 'phase' && o.freqHi < o.freqLo + 0.3) o.freqHi = Math.min(SPECS.phase.freqHi[1], o.freqLo + 0.3);
  return o;
}
const weights = (g, n) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = +g['w' + i] || 0; return w; };

// ---- the six laws ------------------------------------------------------------------------------------------------------------------
const pluckGrid = (s, w, h, x, y, kick, amt, rad) => {
  const cx = x * w, cy = y * h;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d > rad) continue; const f = 1 - d / rad, k = j * w + i; s.theta[k] = (s.theta[k] + kick * f + TAU) % TAU; s.amp[k] = Math.min(1, s.amp[k] + amt * f); }
};
const centreOf = (wts, w, h) => { let m = 0, x = 0, y = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = wts[j * w + i]; m += a; x += a * (i + 0.5) / w; y += a * (j + 0.5) / h; } return m > 1e-6 ? { cx: x / m, cy: y / m } : { cx: 0.5, cy: 0.5 }; };
const centroid = (p) => { let x = 0, y = 0; for (let i = 0; i < p.n; i++) { x += p.x[i]; y += p.y[i]; } return p.n ? { cx: x / p.n, cy: y / p.n } : { cx: 0.5, cy: 0.5 }; };
const meanOf = (a) => { let t = 0; for (let i = 0; i < a.length; i++) t += a[i]; return a.length ? t / a.length : 0; };

const LAWS = {
  // F-034: oscillators set the flow, particles ride the phase gradient
  resonance: {
    W: 8, H: 6, bins: 12,
    init(s, r, n = 240) {
      const N = this.W * this.H; s.theta = makeGrid(this.W, this.H); s.amp = makeGrid(this.W, this.H); s.u = makeGrid(this.W, this.H); s.inst = makeGrid(this.W, this.H);
      for (let i = 0; i < N; i++) { s.theta[i] = r() * TAU; s.u[i] = r(); }
      s.p = makeParticles(Math.min(240, n), r); this.tune(s);
    },
    tune(s) { s.omega = Float32Array.from(s.u, (u) => TAU * (1 + s.genome.spread * (u - 0.5))); },
    step(s, dt, k, input) {
      const g = s.genome, W = this.W, H = this.H, p = s.p;
      if (input.over) { const i = idx(Math.min(W - 1, Math.floor(input.x * W)), Math.min(H - 1, Math.floor(input.y * H)), W, H); s.theta[i] = (s.theta[i] + 0.15 * k) % TAU; s.energy = Math.min(1, s.energy + 0.01 * k); }
      if (input.down && !s.wasDown) { pluckGrid(s, W, H, input.x, input.y, Math.PI, 1, 2.2); s.energy = 1; }
      kuramoto(s.theta, s.omega, W, H, g.K, g.kernel, dt, 0.01, s.rand, s.inst);
      const damp = Math.pow(0.92, k), R2 = 0.15 * 0.15;
      for (let i = 0; i < p.n; i++) {
        const gx = Math.min(W - 1, Math.floor(p.x[i] * W)), gy = Math.min(H - 1, Math.floor(p.y[i] * H)), c = s.theta[gy * W + gx];
        p.vx[i] = p.vx[i] * damp + Math.sin(s.theta[idx(gx + 1, gy, W, H)] - c) * 0.0009 * k; p.vy[i] = p.vy[i] * damp + Math.sin(s.theta[idx(gx, gy + 1, W, H)] - c) * 0.0009 * k;
        if (input.over) { const dx = input.x - p.x[i], dy = input.y - p.y[i], d2 = dx * dx + dy * dy; if (d2 < R2 && d2 > 1e-8) { const d = Math.sqrt(d2); p.vx[i] += (dx / d) * 0.0004 * k; p.vy[i] += (dy / d) * 0.0004 * k; } }
        p.x[i] = wrap01(p.x[i] + p.vx[i] * k); p.y[i] = wrap01(p.y[i] + p.vy[i] * k);
      }
      for (let i = 0; i < s.amp.length; i++) s.amp[i] *= Math.exp(-dt * 1.2);
      s.energy *= Math.exp(-dt * 0.8); s.spec = shares(s.inst, this.bins, 0.4, 1.6);
    },
    measure(s) {
      const coh = orderParam(s.theta).r, spec = spectralEntropy(s.spec), disp = occupancyEntropy(s.p.x, s.p.y, s.p.n, 8), c = centroid(s.p);
      return { entropy: spec, activity: clamp(0.15 + meanOf(s.amp) + s.energy * 0.5, 0, 1), consensus: coh, cx: c.cx, cy: c.cy, resonance: clamp(0.4 * spec + 0.35 * coh + 0.25 * disp, 0, 1), coherence: coh, dispersion: disp };
    },
    fit(m) { return m.resonance; }
  },
  // F-027: a phase lattice tuned to the pointer's rhythm
  phase: {
    W: 16, H: 12, bins: 16,
    init(s, r) { const N = this.W * this.H; s.theta = makeGrid(this.W, this.H); s.amp = makeGrid(this.W, this.H); s.u = makeGrid(this.W, this.H); s.inst = makeGrid(this.W, this.H); for (let i = 0; i < N; i++) { s.theta[i] = r() * TAU; s.u[i] = r(); } s.px = []; s.py = []; s.pdt = []; s.rhythm = null; this.tune(s); },
    tune(s) { const g = s.genome; s.omega = Float32Array.from(s.u, (u) => TAU * (g.freqLo + (g.freqHi - g.freqLo) * u)); },
    step(s, dt, k, input) {
      const g = s.genome, W = this.W, H = this.H;
      if (input.over) { s.px.push(input.x); s.py.push(input.y); s.pdt.push(dt); if (s.px.length > 48) { s.px.shift(); s.py.shift(); s.pdt.shift(); } s.rhythm = rhythmOf(s.px, s.py, s.pdt); pluckGrid(s, W, H, input.x, input.y, 0.08 * k, 0.03 * k, 2.5); }
      if (input.down && !s.wasDown) { pluckGrid(s, W, H, input.x, input.y, Math.PI * 0.8, 1, 3.5); s.energy = 1; }
      if (Number.isFinite(input.rhythm)) s.rhythm = input.rhythm; // the mind's replay holds the rhythm it is judged against
      kuramoto(s.theta, s.omega, W, H, g.K, 1.5, dt, g.noise, s.rand, s.inst);
      for (let i = 0; i < s.amp.length; i++) s.amp[i] *= Math.exp(-dt * 1.5);
      s.energy *= Math.exp(-dt * 0.8); s.spec = shares(s.inst, this.bins, 0, 4);
    },
    match(s) { const g = s.genome; return s.rhythm == null ? 0.5 : 1 - Math.min(1, Math.abs(s.rhythm - (g.freqLo + g.freqHi) / 2) / 2); },
    measure(s) {
      const r = orderParam(s.theta).r, c = centreOf(s.amp, this.W, this.H), match = this.match(s);
      return { entropy: spectralEntropy(s.spec), activity: clamp(0.1 + meanOf(s.amp) * 2 + s.energy * 0.4, 0, 1), consensus: r, cx: c.cx, cy: c.cy, resonance: clamp(0.6 * match + 0.4 * r, 0, 1), order: r, match, rhythm: s.rhythm };
    },
    fit(m) { return m.resonance; }
  },
  // F-044: speeds in five bands, a resonance gene, band portals
  bands: {
    bins: 5,
    init(s, r, n = 240) { s.p = makeParticles(Math.min(240, n), r, 0.002); s.e = new Float32Array(s.p.n).map(() => r()); s.portals = []; s.reinforced = 0; s.dom = 0; s.coh = 0; s.spec = new Float32Array(5); },
    step(s, dt, k, input) {
      const g = s.genome, p = s.p, sp = new Float32Array(p.n); let mx = 1e-6;
      for (let i = 0; i < p.n; i++) { sp[i] = Math.hypot(p.vx[i], p.vy[i]); mx = Math.max(mx, sp[i]); }
      const b = shares(Array.from(sp, (v) => v / mx), 5, 0, 1); s.spec = b; s.coh = peakedness(b);
      let dom = 0; for (let i = 1; i < 5; i++) if (b[i] > b[dom]) dom = i; s.dom = dom;
      const target = ((dom + 0.5) / 5) * mx, decay = Math.pow(g.decay, k), R2 = 0.06 * 0.06;
      for (let i = 0; i < p.n; i++) {
        if (input.over) { const dx = input.x - p.x[i], dy = input.y - p.y[i], d = Math.hypot(dx, dy) || 1; p.vx[i] += (dx / d) * g.attract * 0.00015 * k; p.vy[i] += (dy / d) * g.attract * 0.00015 * k; if (input.down && d * d < R2) s.e[i] = 1; }
        p.vx[i] += (s.rand() - 0.5) * g.diffusion * 0.004 * k; p.vy[i] += (s.rand() - 0.5) * g.diffusion * 0.004 * k;
        if (sp[i] > 1e-7) { const f = 1 + g.resonance * 0.03 * k * (target / sp[i] - 1); p.vx[i] *= clamp(f, 0.5, 1.5); p.vy[i] *= clamp(f, 0.5, 1.5); } // pull each speed toward the loudest band
        p.vx[i] *= decay; p.vy[i] *= decay; s.e[i] *= Math.pow(0.995, k);
        p.x[i] = wrap01(p.x[i] + p.vx[i] * k); p.y[i] = wrap01(p.y[i] + p.vy[i] * k);
      }
      // portals: open while the spectrum is coherent (at most 6, 8 s each); pressing one reinforces the genes toward that band
      for (const o of s.portals) o.ttl -= dt; s.portals = s.portals.filter((o) => o.ttl > 0);
      if (s.portals.length < 6 && s.rand() < 0.012 * s.coh * k) s.portals.push({ x: 0.1 + 0.8 * s.rand(), y: 0.1 + 0.8 * s.rand(), band: dom, ttl: 8 });
      if (input.down && !s.wasDown) { const hit = s.portals.findIndex((o) => Math.hypot(o.x - input.x, o.y - input.y) < 0.07); if (hit >= 0) { s.genome = { ...g, resonance: Math.min(1, g.resonance + 0.08), attract: Math.min(1, g.attract + 0.05) }; s.portals.splice(hit, 1); s.reinforced++; } s.energy = 1; }
      s.energy *= Math.exp(-dt * 0.8);
    },
    measure(s) {
      const p = s.p; let ms = 0, ex = 0, ey = 0, em = 0; for (let i = 0; i < p.n; i++) { ms += Math.hypot(p.vx[i], p.vy[i]); ex += s.e[i] * p.x[i]; ey += s.e[i] * p.y[i]; em += s.e[i]; }
      const act = clamp(ms / (p.n || 1) / 0.004, 0, 1);
      return { entropy: spectralEntropy(s.spec), activity: act, consensus: s.coh, cx: em > 1e-6 ? ex / em : 0.5, cy: em > 1e-6 ? ey / em : 0.5, resonance: s.coh, coherence: s.coh, band: BANDS[s.dom], portals: s.portals.length };
    },
    fit(m) { return 0.6 * m.coherence + 0.4 * (1 - Math.min(1, Math.abs(m.activity - 0.5) * 2)); }
  },
  // F-037: a logistic lattice that grows toward a target spectrum
  voice: {
    W: 40, H: 25, bins: 16,
    init(s, r) { s.f = makeGrid(this.W, this.H); for (let i = 0; i < s.f.length; i++) s.f[i] = r() * 0.2; s.target = new Float32Array(this.bins); s.target[this.bins >> 1] = 1; s.spec = new Float32Array(this.bins); s.res = 0; s.listening = false; },
    step(s, dt, k, input) {
      const g = s.genome, W = this.W, H = this.H, nb = this.bins, h = Math.min(1, k);
      s.listening = !!(input.spectrum && input.spectrum.length);
      if (s.listening) s.target = resample(input.spectrum, nb);
      else if (input.target && input.target.length) s.target = resample(input.target, nb);
      else if (input.over) { const t = new Float32Array(nb); for (let b = 0; b < nb; b++) t[b] = Math.exp(-(((b + 0.5) / nb - input.x) ** 2) / (2 * 0.08 * 0.08)); s.target = t; }
      if (input.over) { const cx = Math.floor(input.x * W), cy = Math.floor(input.y * H), rad = input.down ? 2 : 0, amt = input.down ? 0.4 : 0.08; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const i = idx(cx + dx, cy + dy, W, H); s.f[i] = Math.min(1, s.f[i] + amt); } }
      if (input.down && !s.wasDown) s.energy = 1;
      const f = s.f, nf = new Float32Array(f.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, v = f[i], avg = (f[idx(x - 1, y, W, H)] + f[idx(x + 1, y, W, H)] + f[idx(x, y - 1, W, H)] + f[idx(x, y + 1, W, H)]) / 4, want = s.target[Math.min(nb - 1, Math.floor((x / W) * nb))];
        nf[i] = clamp(v + h * (g.diff * (avg - v) + g.react * v * (1 - v) * want - g.decay * v + g.attract * want * (1 - v) * 0.5), 0, 1); // the lattice grows where the target spectrum is loud
      }
      s.f = nf; s.spec = this.spectrum(s);
      let d = 0; for (let b = 0; b < nb; b++) d += Math.abs(s.target[b] - s.spec[b]); s.res = s.res * 0.8 + (1 - d / nb) * 0.2; s.energy *= Math.exp(-dt * 0.8);
    },
    spectrum(s) { const nb = this.bins, out = new Float32Array(nb); for (let i = 0; i < s.f.length; i++) out[Math.min(nb - 1, Math.floor(((i % this.W) / this.W) * nb))] += s.f[i]; let mx = 0; for (let b = 0; b < nb; b++) mx = Math.max(mx, out[b]); if (mx > 0) for (let b = 0; b < nb; b++) out[b] /= mx; return out; },
    measure(s) { const c = centreOf(s.f, this.W, this.H), mean = meanOf(s.f); return { entropy: entropy(s.f, 16), activity: clamp(mean * 1.5 + s.energy * 0.3, 0, 1), consensus: clamp(s.res, 0, 1), cx: c.cx, cy: c.cy, resonance: clamp(s.res, 0, 1), alive: mean, listening: s.listening }; },
    fit(m) { return m.resonance * (m.alive > 0.03 && m.alive < 0.85 ? 1 : 0.5); }
  },
  // F-048: density -> policy -> synth -> spectrum -> force
  spatial: {
    bins: 8,
    init(s, r, n = 160) { s.p = makeParticles(Math.min(160, n), r, 0.002); s.w = weights(s.genome, 12); s.out = new Float32Array(8); s.audio = policyAudio(s.out); s.spec = new Float32Array(8); s.res = 0.3; s.near = 0; },
    tune(s) { s.w = weights(s.genome, 12); },
    step(s, dt, k, input) {
      const p = s.p, n = p.n, dens = new Float32Array(8); let near = 0, vv = 0, mx = 1;
      for (let i = 0; i < n; i++) { dens[Math.min(7, Math.floor(p.x[i] * 8))]++; vv += p.vx[i] * p.vx[i] + p.vy[i] * p.vy[i]; if (input.over && Math.hypot(p.x[i] - input.x, p.y[i] - input.y) < 0.08) near++; }
      for (let b = 0; b < 8; b++) mx = Math.max(mx, dens[b]);
      s.near = n ? near / n : 0;
      const feat = [meanOf(dens) / mx, s.near, Math.min(1, Math.sqrt(vv / (n || 1)) / 0.004), s.res, Math.sin(s.t), Math.cos(s.t * 0.7)];
      s.out = policy(s.w, feat); s.audio = policyAudio(s.out); s.spec = synthSpectrum(s.audio.freqs, s.audio.gains, 8);
      s.res = clamp(0.7 * peakedness(s.spec) + 0.3 * (1 - flatness(s.spec)), 0, 1);
      const damp = Math.pow(0.98, k), R = 0.02;
      for (let i = 0; i < n; i++) {
        const b = Math.min(7, Math.floor(p.x[i] * 8)); p.vx[i] += (((b + 0.5) / 8) - p.x[i]) * 0.0008 * s.spec[b] * s.res * k * 8; // loud bins hold their particles
        if (input.over && Math.hypot(p.x[i] - input.x, p.y[i] - input.y) < 0.06) { p.vx[i] += (input.x - p.x[i]) * 0.01 * k; p.vy[i] += (input.y - p.y[i]) * 0.01 * k; }
        for (let j = 0; j < n; j++) { if (i === j) continue; const dx = p.x[i] - p.x[j], dy = p.y[i] - p.y[j]; if (Math.abs(dx) > R || Math.abs(dy) > R) continue; const d2 = dx * dx + dy * dy; if (d2 > 1e-9 && d2 < R * R) { p.vx[i] += (dx / d2) * 2e-7 * k; p.vy[i] += (dy / d2) * 2e-7 * k; } }
      }
      for (let i = 0; i < n; i++) {
        p.vx[i] = clamp(p.vx[i] * damp, -0.01, 0.01); p.vy[i] = clamp(p.vy[i] * damp, -0.01, 0.01); p.x[i] += p.vx[i] * k; p.y[i] += p.vy[i] * k;
        if (p.x[i] < 0 || p.x[i] > 1) { p.vx[i] = -p.vx[i]; p.x[i] = clamp(p.x[i], 0, 1); } if (p.y[i] < 0 || p.y[i] > 1) { p.vy[i] = -p.vy[i]; p.y[i] = clamp(p.y[i], 0, 1); }
      }
      if (input.down && !s.wasDown) s.energy = 1; s.energy *= Math.exp(-dt * 0.8);
    },
    measure(s) { const c = centroid(s.p); let vv = 0; for (let i = 0; i < s.p.n; i++) vv += Math.hypot(s.p.vx[i], s.p.vy[i]); let po = 0; for (let i = 0; i < 8; i++) po += s.out[i] * s.out[i];
      return { entropy: occupancyEntropy(s.p.x, s.p.y, s.p.n, 8), activity: clamp(vv / (s.p.n || 1) / 0.003 + s.energy * 0.3, 0, 1), consensus: s.res, cx: c.cx, cy: c.cy, resonance: s.res, near: s.near, calm: 1 - Math.min(1, po / 8), base: Math.round(s.audio.base) }; },
    fit(m, near) { return 0.6 * m.resonance + 0.3 * near + 0.1 * m.calm; }
  },
  // F-042: predict the next spectrum; the residual moves the particles
  predict: {
    bins: 8,
    init(s, r, n = 80) { s.p = makeParticles(Math.min(80, n), r); s.w = weights(s.genome, MLP_N); s.bump = new Float32Array(8); s.spec = synthDrift(0); s.pred = mlp(s.spec, s.w); s.resid = new Float32Array(8); s.acc = 0.5; s.inter = 0; s.hist = [Array.from(s.spec)]; s.listening = false; },
    tune(s) { s.w = weights(s.genome, MLP_N); },
    step(s, dt, k, input) {
      const p = s.p; s.listening = !!(input.spectrum && input.spectrum.length);
      for (let i = 0; i < 8; i++) s.bump[i] *= Math.exp(-dt * 2);
      if (input.down && !s.wasDown) { s.bump[Math.min(7, Math.floor(input.x * 8))] += 0.5; s.energy = 1; }
      const cur = s.listening ? resample(input.spectrum, 8) : synthDrift(s.t, s.bump);
      let err = 0; for (let i = 0; i < 8; i++) { s.resid[i] = s.pred[i] - cur[i]; err += s.resid[i] * s.resid[i]; } err = Math.sqrt(err / 8);
      s.acc = s.acc * 0.9 + (1 - Math.min(1, err * 2)) * 0.1; s.spec = cur; s.pred = mlp(cur, s.w);
      s.hist.push(Array.from(cur)); if (s.hist.length > 32) s.hist.shift();
      const damp = Math.pow(0.92, k), fs = 0.0008 * (1 + err) * k; let near = 0;
      for (let i = 0; i < p.n; i++) {
        const a = (p.x[i] + p.y[i]) * TAU, r = s.resid[Math.min(7, Math.floor(p.x[i] * 8))];
        p.vx[i] = (p.vx[i] + Math.cos(a) * r * fs) * damp; p.vy[i] = (p.vy[i] + Math.sin(a) * r * fs) * damp; p.x[i] = wrap01(p.x[i] + p.vx[i] * k); p.y[i] = wrap01(p.y[i] + p.vy[i] * k);
        if (input.over && Math.hypot(p.x[i] - input.x, p.y[i] - input.y) < 0.06) near++;
      }
      s.inter = Math.min(1, s.inter * Math.pow(0.95, k) + near * 0.02); s.energy *= Math.exp(-dt * 0.8);
    },
    measure(s) { const c = centroid(s.p); return { entropy: spectralEntropy(s.spec), activity: clamp(meanOf(s.resid.map(Math.abs)) * 4 + s.energy * 0.3, 0, 1), consensus: clamp(s.acc, 0, 1), cx: c.cx, cy: c.cy, resonance: clamp(s.acc, 0, 1), accuracy: s.acc, interaction: s.inter, listening: s.listening }; }
  }
};

// ---- the variant API -------------------------------------------------------------------------------------------------------------
/** a new field for a variant (default F-034) from a seed, with the draft's genome unless one is given. Deterministic by seed. */
export function create(seed = 1, variant = DEFAULT, genome = null, { n } = {}) {
  const v = VARIANTS[variant] ? variant : DEFAULT, rand = rng((seed | 0) * 31 + ORDER.indexOf(v) + 1);
  const s = { variant: v, fid: VARIANTS[v].fid, seed, rand, t: 0, genome: fix(v, genome || defaultGenome(v, seed), seed), energy: 0, wasDown: false, spec: new Float32Array(LAWS[v].bins) };
  LAWS[v].init(s, rand, n); return s;
}
/** one step: dt in seconds; input { x, y (0..1), over, down, spectrum? (a microphone's bins, only when the person turned it on), target?, rhythm? }. */
export function step(s, dt = 1 / 60, input = {}) {
  const k = clamp(dt * 60, 0.25, 3); LAWS[s.variant].step(s, dt, k, input || {}); s.wasDown = !!(input && input.down); s.t += dt; return s;
}
/** the kit's metrics (entropy, activity, consensus, cx, cy, each 0..1) plus resonance (0..1) and the variant's own numbers. */
export function metrics(s) { const m = LAWS[s.variant].measure(s); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy', 'resonance']) m[k] = clamp(Number.isFinite(m[k]) ? m[k] : 0.5, 0, 1); return m; }
/** the spectrum the card draws under the field (loudest bin 1). */
export function spectrumOf(s) { const sp = s.spec || []; let mx = 0; for (let i = 0; i < sp.length; i++) mx = Math.max(mx, sp[i]); return Array.from(sp, (v) => (mx > 0 ? v / mx : 0)); }
/** swap in a genome (the mind's answer); the field keeps going. */
export function setGenome(s, g) { s.genome = fix(s.variant, g, s.seed); const L = LAWS[s.variant]; if (L.tune) L.tune(s); return s; }
/** the facts a seal keeps: the variant, its F-id and its genome rounded (never the pointer's path, never a sound). The predictive network's
 *  212 weights are kept as a short fingerprint instead. */
export function params(s) {
  const g = s.genome, keys = Object.keys(g), round = (v) => Math.round(v * 1000) / 1000;
  const genome = keys.length > 16 ? { weights: keys.length, sum: round(keys.reduce((t, k) => t + Math.abs(g[k]), 0)) } : Object.fromEntries(keys.map((k) => [k, round(g[k])]));
  return { variant: s.variant, fid: s.fid, genome };
}
/** what the mind judges a genome against right now (plain numbers, safe to post to a Worker). */
export function contextOf(s, input = {}) {
  return { variant: s.variant, seed: s.seed, rhythm: s.rhythm == null ? null : s.rhythm, pointer: input.over ? { x: input.x, y: input.y } : null, target: s.target ? Array.from(s.target) : null, hist: s.hist ? s.hist.map((h) => Array.from(h)) : null };
}
/** a genome's fitness, 0..1, by replaying TRIAL steps from the same seed under ctx (F-042: by its real prediction error over ctx.hist). Pure. */
export function fitness(variant, genome, ctx = {}) {
  const v = VARIANTS[variant] ? variant : DEFAULT, seed = ctx.seed || 1;
  if (v === 'predict') {
    const w = weights(fix(v, genome, seed), MLP_N), hist = ctx.hist && ctx.hist.length >= 4 ? ctx.hist : Array.from({ length: 16 }, (_, i) => Array.from(synthDrift(i / 30)));
    let e = 0; for (let i = 0; i + 1 < hist.length; i++) { const p = mlp(hist[i], w); let q = 0; for (let b = 0; b < 8; b++) q += (p[b] - hist[i + 1][b]) ** 2; e += Math.sqrt(q / 8); }
    return Math.round(clamp(1 - (e / (hist.length - 1)) * 2, 0, 1) * 1e4) / 1e4;
  }
  const s = create(seed, v, genome, { n: 60 }), input = ctx.pointer ? { over: true, x: ctx.pointer.x, y: ctx.pointer.y } : {};
  if (v === 'phase' && Number.isFinite(ctx.rhythm)) input.rhythm = ctx.rhythm;
  if (v === 'voice' && ctx.target) input.target = ctx.target;
  let near = 0; for (let i = 0; i < TRIAL; i++) { step(s, 1 / 30, input); near += s.near || 0; }
  return Math.round(clamp(LAWS[v].fit(metrics(s), near / TRIAL), 0, 1) * 1e4) / 1e4;
}
/** one generation, for a Worker or the page: arg { variant, pop?, ctx, seed, gen } -> { variant, pop, best, fitness, gen }. Every genome is
 *  judged on the same ctx, the best two are kept, the rest are bred (lib/field-kit.js evolveStep). Synchronous and deterministic. */
export function evolveResonance(arg = {}) {
  const v = VARIANTS[arg.variant] ? arg.variant : DEFAULT, seed = arg.seed || 1, spec = SPECS[v], r = rng(seed * 7919 + (arg.gen || 0) * 104729 + ORDER.indexOf(v));
  const pop = (arg.pop && arg.pop.length ? arg.pop : [defaultGenome(v, seed), ...Array.from({ length: POP - 1 }, () => randomGenome(spec, r))]).map((g) => fix(v, g, seed));
  const ctx = { ...(arg.ctx || {}), seed }, fits = pop.map((g) => fitness(v, g, ctx));
  let bi = 0; fits.forEach((f, i) => { if (f > fits[bi]) bi = i; });
  const big = Object.keys(spec).length > 16;
  return { variant: v, pop: evolveStep(pop, fits, spec, r, { elite: 2, rate: big ? 0.15 : 0.3, sigma: big ? 0.08 : 0.12 }).map((g) => fix(v, g, seed)), best: pop[bi], fitness: fits[bi], gen: (arg.gen || 0) + 1 };
}
/** which variant an ask names (null when it names none). */
export function variantOf(text) {
  const t = String(text || '').toLowerCase();
  if (/voice|hum|sing/.test(t)) return 'voice';
  if (/predict|anticipat/.test(t)) return 'predict';
  if (/spatial|audio particle|sound field/.test(t)) return 'spatial';
  if (/phase/.test(t)) return 'phase';
  if (/band|spectral resonance lattice|resonance lattice/.test(t)) return 'bands';
  if (/spectral resonance|oscillator/.test(t)) return 'resonance';
  return null;
}
