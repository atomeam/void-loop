// F-231 Taste Oracle core: Gaussian-process preference learning (Bradley-Terry
// likelihood, Laplace approximation) + optimistic dueling acquisition.
// Pure ES module, runs in Node and the browser.
export const DIM = 6; // blob, twist, spikes, hue, symmetry, smooth

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const sig = (z) => 1 / (1 + Math.exp(-z));

// Solve A x = b (A n×n row-major array of arrays), partial pivoting. Returns new arrays.
function solve(A, B) { // B: n×m
  const n = A.length, m = B[0].length;
  const M = A.map((r, i) => r.concat(B[i]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / d; if (!f) continue;
      const Rr = M[r], Rc = M[c];
      for (let k = c; k < n + m; k++) Rr[k] -= f * Rc[k];
    }
  }
  return M.map((r, i) => r.slice(n).map((v) => v / M[i][i]));
}

export class TasteGP {
  constructor({ ell = 0.5, sf = 2.0, noise = 0.3 } = {}) {
    this.ell = ell; this.sf2 = sf * sf; this.noise = noise;
    this.X = []; this.duels = []; // {w, l} indices into X
    this.f = []; this.dirty = true; this.radius = 0.15; this.lastPair = null;
  }
  k(a, b) { let d = 0; for (let i = 0; i < a.length; i++) { const t = a[i] - b[i]; d += t * t; } return this.sf2 * Math.exp(-d / (2 * this.ell * this.ell)); }
  index(x) {
    for (let i = 0; i < this.X.length; i++) { let same = true; for (let j = 0; j < DIM; j++) if (Math.abs(this.X[i][j] - x[j]) > 1e-9) { same = false; break; } if (same) return i; }
    this.X.push(x.slice()); this.f.push(0); return this.X.length - 1;
  }
  addDuel(winner, loser) { this.duels.push({ w: this.index(winner), l: this.index(loser) }); this.dirty = true; }
  // Laplace mode via Newton: f <- K (I + W K)^-1 (W f + g)
  fit(iters = 30) {
    if (!this.dirty) return; const n = this.X.length;
    if (!n) { this.dirty = false; return; }
    const K = this.X.map((a) => this.X.map((b) => this.k(a, b)));
    for (let i = 0; i < n; i++) K[i][i] += 1e-6;
    let f = this.f.slice(0, n); while (f.length < n) f.push(0);
    let W, g;
    const s = this.noise;
    for (let it = 0; it < iters; it++) {
      W = Array.from({ length: n }, () => new Array(n).fill(0)); g = new Array(n).fill(0);
      for (const { w, l } of this.duels) {
        const p = sig((f[w] - f[l]) / s), gr = (1 - p) / s, h = p * (1 - p) / (s * s);
        g[w] += gr; g[l] -= gr;
        W[w][w] += h; W[l][l] += h; W[w][l] -= h; W[l][w] -= h;
      }
      const B = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) + W[i].reduce((acc, v, t) => acc + v * K[t][j], 0)));
      const rhs = f.map((fi, i) => [W[i].reduce((acc, v, t) => acc + v * f[t], 0) + g[i]]);
      const a = solve(B, rhs).map((r) => r[0]);
      const fn = K.map((row) => row.reduce((acc, v, t) => acc + v * a[t], 0));
      let delta = 0; for (let i = 0; i < n; i++) delta = Math.max(delta, Math.abs(fn[i] - f[i]));
      f = fn; if (delta < 1e-6) break;
    }
    // recompute W, g at mode and cache predictive pieces
    W = Array.from({ length: n }, () => new Array(n).fill(0)); g = new Array(n).fill(0);
    for (const { w, l } of this.duels) {
      const p = sig((f[w] - f[l]) / s), gr = (1 - p) / s, h = p * (1 - p) / (s * s);
      g[w] += gr; g[l] -= gr; W[w][w] += h; W[l][l] += h; W[w][l] -= h; W[l][w] -= h;
    }
    const IWK = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) + W[i].reduce((acc, v, t) => acc + v * K[t][j], 0)));
    this.C = solve(IWK, W); // (I + W K)^-1 W, n×n
    this.f = f; this.g = g; this.dirty = false;
  }
  predict(x) {
    this.fit(); const n = this.X.length;
    if (!n) return { mu: 0, sd: Math.sqrt(this.sf2) };
    const ks = this.X.map((a) => this.k(a, x));
    let mu = 0; for (let i = 0; i < n; i++) mu += ks[i] * this.g[i];
    let q = 0; for (let i = 0; i < n; i++) { let r = 0; const Ci = this.C[i]; for (let j = 0; j < n; j++) r += Ci[j] * ks[j]; q += ks[i] * r; }
    return { mu, sd: Math.sqrt(Math.max(1e-9, this.sf2 - q)) };
  }
  // Best observed design by posterior mean.
  // Conservative pick: highest mean minus kappa*sd among observed designs.
  incumbent(kappa = this.kappa ?? 1) {
    this.fit(); let b = 0, bs = -Infinity;
    for (let i = 0; i < this.X.length; i++) { const { mu, sd } = this.predict(this.X[i]); const s = mu - kappa * sd; if (s > bs) { bs = s; b = i; } }
    return this.X[b];
  }
  // Next duel: incumbent vs the point maximising mean + beta*sd inside a trust
  // region around the incumbent (a GP-screened hill climb). The region grows
  // after the challenger wins and shrinks after it loses; random global points
  // are only a small share of the pool, so far-away uncertainty can't dominate.
  propose(r, { beta = 1.0, pool = 30, globalShare = 0.05 } = {}) {
    const rand = () => Array.from({ length: DIM }, r);
    if (!this.X.length) return (this.lastPair = [rand(), rand()]);
    const inc = this.incumbent(), L = this.radius;
    let best = null, bestS = -Infinity;
    for (let t = 0; t < pool; t++) {
      const x = r() < globalShare ? rand() : inc.map((v) => clamp01(v + gauss(r) * L));
      let d = 0; for (let i = 0; i < DIM; i++) d += (x[i] - inc[i]) ** 2; if (d < 1e-5) continue;
      const { mu, sd } = this.predict(x); const s = mu + beta * sd;
      if (s > bestS) { bestS = s; best = x; }
    }
    this.lastPair = [inc, best];
    return [inc, best];
  }
  // Record a duel from propose() and adapt the trust region.
  answer(choice) {
    const [a, b] = this.lastPair; choice === 0 ? this.addDuel(a, b) : this.addDuel(b, a);
    this.radius = choice === 1 ? Math.min(0.5, this.radius * 1.25) : Math.max(0.03, this.radius * 0.85);
  }
}
export const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Simulated taster with a hidden utility made of Gaussian bumps.
export function makeTaster(seed, { bumps = 3, width = 0.4, temp = 0.08 } = {}) {
  const r = rng(seed * 7919 + 3);
  const B = Array.from({ length: bumps }, (_, i) => ({ c: Array.from({ length: DIM }, () => 0.1 + 0.8 * r()), h: i === 0 ? 1 : 0.4 + 0.4 * r() }));
  const u = (x) => B.reduce((a, b) => { let d = 0; for (let i = 0; i < DIM; i++) d += (x[i] - b.c[i]) ** 2; return a + b.h * Math.exp(-d / (2 * width * width)); }, 0);
  // estimate max by local search from each bump centre
  let umax = 0; for (const b of B) { let x = b.c.slice(), ux = u(x); for (let t = 0; t < 3000; t++) { const y = x.map((v) => clamp01(v + (r() - 0.5) * 0.02)); const uy = u(y); if (uy > ux) { x = y; ux = uy; } } umax = Math.max(umax, ux); }
  return { u, umax, choose: (a, b, rr) => (rr() < sig((u(a) - u(b)) / temp) ? 0 : 1) };
}
