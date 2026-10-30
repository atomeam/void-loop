// F-304 Lenia Gait Evolver — shared core (browser main thread, Worker, and Node test)
(function (root) {
  'use strict';
  // Genome lives in [0,1]^6 and maps to Lenia physics.
  const RANGES = [
    ['mu', 0.10, 0.35], ['sigma', 0.012, 0.060], ['dt', 0.05, 0.20],
    ['b2', 0.0, 1.0], ['b3', 0.0, 1.0], ['shift', 0.0, 0.40]
  ];
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function decode(g) {
    const p = {};
    RANGES.forEach(([k, lo, hi], i) => { p[k] = lo + clamp01(g[i]) * (hi - lo); });
    return p;
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  // Radial shell kernel value at normalized radius q in [0,1).
  function shell(q, betas) {
    if (q <= 0 || q >= 1) return 0;
    const n = betas.length, s = q * n, i = Math.min(n - 1, Math.floor(s)), f = s - i;
    return betas[i] * Math.exp(4 - 1 / (f * (1 - f) + 1e-9));
  }
  // Kernel as a sparse offset list; sensing is displaced by (sx,sy) cells, which breaks symmetry and makes a gait.
  function kernel(p, R, dirX, dirY) {
    const betas = [1, p.b2, p.b3], sx = -p.shift * R * dirX, sy = -p.shift * R * dirY;
    const offs = [], ext = Math.ceil(R + Math.abs(sx) + Math.abs(sy)) + 1; let sum = 0;
    for (let dy = -ext; dy <= ext; dy++) for (let dx = -ext; dx <= ext; dx++) {
      const q = Math.hypot(dx - sx, dy - sy) / R, w = shell(q, betas);
      if (w > 1e-4) { offs.push(dx, dy, w); sum += w; }
    }
    for (let i = 2; i < offs.length; i += 3) offs[i] /= sum;
    return offs;
  }
  function growth(u, p) { const d = u - p.mu; return 2 * Math.exp(-d * d / (2 * p.sigma * p.sigma)) - 1; }
  function step(A, B, N, offs, p) {
    const n = offs.length;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let u = 0;
      for (let k = 0; k < n; k += 3) {
        const xx = (x + offs[k] + N) % N, yy = (y + offs[k + 1] + N) % N;
        u += A[yy * N + xx] * offs[k + 2];
      }
      const v = A[y * N + x] + p.dt * growth(u, p);
      B[y * N + x] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  function seedBlob(A, N, R, seed, cx, cy) {
    const r = rng(seed), rad = R * 1.3; cx = cx == null ? N / 2 : cx; cy = cy == null ? N / 2 : cy;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < rad) A[y * N + x] = Math.max(A[y * N + x], r() * (1 - d / rad) * 1.2 > 0.25 ? r() * 0.9 + 0.1 : 0);
    }
  }
  // Circular (torus-aware) centre of mass.
  function com(A, N) {
    let m = 0, cx = 0, sx = 0, cy = 0, sy = 0; const t = 2 * Math.PI / N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const a = A[y * N + x]; if (!a) continue; m += a;
      cx += a * Math.cos(x * t); sx += a * Math.sin(x * t); cy += a * Math.cos(y * t); sy += a * Math.sin(y * t);
    }
    const ax = (Math.atan2(-sx, -cx) + Math.PI) / t, ay = (Math.atan2(-sy, -cy) + Math.PI) / t;
    return { m, x: ax, y: ay };
  }
  function wrapD(d, N) { return d - N * Math.round(d / N); }
  // Fitness: survive as a compact creature and travel along +x (the steer direction) in T steps.
  function evaluate(g, opts) {
    opts = opts || {}; const N = opts.N || 48, R = opts.R || 7, T = opts.T || 90, seeds = opts.seeds || [1, 2];
    const p = decode(g), offs = kernel(p, R, 1, 0); let total = 0;
    for (const sd of seeds) {
      let A = new Float32Array(N * N), B = new Float32Array(N * N);
      seedBlob(A, N, R, sd); let c0 = com(A, N); const m0 = c0.m; let px = c0.x, travel = 0, f = null;
      for (let t = 0; t < T; t++) {
        step(A, B, N, offs, p); const tmp = A; A = B; B = tmp;
        if (t % 3 === 2 || t === T - 1) {
          const c = com(A, N);
          if (c.m < 0.15 * m0 || c.m > 2.5 * m0) { f = -1 + t / T; break; }
          travel += wrapD(c.x - px, N); px = c.x;
        }
      }
      if (f === null) {
        const c = com(A, N); // compactness: mass must not smear over the world
        let spread = 0; for (let i = 0; i < N * N; i++) if (A[i] > 0.05) spread++;
        const smear = spread / (N * N);
        const grow = c.m / m0; // a creature must keep its body, not flood the world
        f = 1 + 2 * travel / R - (smear > 0.25 ? (smear - 0.25) * 8 : 0) - (grow > 1.6 ? (grow - 1.6) * 4 : 0);
      }
      total += f;
    }
    return total / seeds.length;
  }
  // Antithetic, rank-shaped evolution strategy (OpenAI-ES style).
  function makeES(dim, seed, opts) {
    opts = opts || {}; const r = rng(seed), mean = [], pop = opts.pop || 12, sig = opts.sigma || 0.12, lr = opts.lr || 0.35;
    for (let i = 0; i < dim; i++) mean.push(opts.init ? opts.init[i] : r());
    return {
      mean, best: null, bestFit: -Infinity, gen: 0, gradNorm: 0,
      ask() { const eps = []; for (let i = 0; i < pop / 2; i++) { const e = []; for (let d = 0; d < dim; d++) e.push(gauss(r)); eps.push(e, e.map(v => -v)); }
        this._eps = eps; return eps.map(e => mean.map((m, d) => clamp01(m + sig * e[d]))); },
      tell(genomes, fits) {
        const idx = fits.map((f, i) => i).sort((a, b) => fits[a] - fits[b]), w = new Array(fits.length);
        idx.forEach((i, rank) => { w[i] = rank / (fits.length - 1) - 0.5; });
        let gn = 0;
        for (let d = 0; d < dim; d++) { let gsum = 0; for (let i = 0; i < fits.length; i++) gsum += w[i] * this._eps[i][d];
          const step = lr * gsum / (fits.length * sig) * sig; mean[d] = clamp01(mean[d] + step); gn += step * step; }
        this.gradNorm = Math.sqrt(gn);
        fits.forEach((f, i) => { if (f > this.bestFit) { this.bestFit = f; this.best = genomes[i].slice(); } });
        this.gen++;
      }
    };
  }
  const api = { RANGES, decode, rng, kernel, growth, step, seedBlob, com, evaluate, makeES, shell, wrapD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LeniaCore = api;
})(typeof self !== 'undefined' ? self : this);
