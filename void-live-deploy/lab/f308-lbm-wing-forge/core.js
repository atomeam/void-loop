// F-308 LBM Wing Forge core: D2Q9 lattice-Boltzmann wind tunnel + parametric wing + ES.
// Shared verbatim by the page, the Worker and the Node test.
export const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1]; // +y is DOWN on screen
export const W9 = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
export const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
export const GENES = ['angle', 'camber', 'camberPos', 'thickness', 'flap'];
export const DEFAULT_GENOME = [0.25, 0, 0.4, 0.4, 0.286]; // symmetric NACA 0012-ish, 0 deg, no flap

export function decode(g) {
  const c = (v) => Math.min(1, Math.max(0, v));
  return {
    aoa: (-5 + 20 * c(g[0])) * Math.PI / 180,          // -5..15 deg
    m: 0.09 * c(g[1]),                                 // max camber
    p: 0.2 + 0.5 * c(g[2]),                            // camber position
    t: 0.06 + 0.15 * c(g[3]),                          // thickness
    flap: (-10 + 35 * c(g[4])) * Math.PI / 180,        // -10..25 deg, trailing 25%
  };
}

// NACA-4 style section with a hinged trailing flap, rotated by AoA about quarter chord.
export function wingMask(W, H, g, chord, cx, cy) {
  const d = decode(g); const mask = new Uint8Array(W * H);
  const ca = Math.cos(d.aoa), sa = Math.sin(d.aoa);
  const tf = Math.tan(d.flap);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // screen -> wing frame (wing y up). Pitch up (positive aoa) lifts the leading edge.
    const dx = (x + 0.5 - cx) / chord, dy = -(y + 0.5 - cy) / chord;
    const u = dx * ca - dy * sa + 0.25, v = dx * sa + dy * ca;
    if (u < 0 || u > 1) continue;
    let yc = u < d.p ? d.m / (d.p * d.p) * (2 * d.p * u - u * u)
      : d.m / ((1 - d.p) * (1 - d.p)) * ((1 - 2 * d.p) + 2 * d.p * u - u * u);
    if (u > 0.75) yc -= (u - 0.75) * tf;
    const yt = 5 * d.t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);
    if (Math.abs(v - yc) <= Math.max(yt, 0.6 / chord)) mask[y * W + x] = 1;
  }
  return mask;
}

export function makeTunnel(W, H, u0 = 0.1, tau = 0.6) {
  const N = W * H;
  const t = { W, H, u0, tau, f: new Float32Array(N * 9), g: new Float32Array(N * 9),
    solid: new Uint8Array(N), body: new Uint8Array(N), rho: new Float32Array(N),
    ux: new Float32Array(N), uy: new Float32Array(N), fx: 0, fy: 0, steps: 0 };
  for (let n = 0; n < N; n++) setEq(t.f, n, 1, u0, 0);
  return t;
}

function setEq(f, n, rho, ux, uy) {
  const uu = 1.5 * (ux * ux + uy * uy);
  for (let i = 0; i < 9; i++) {
    const eu = 3 * (EX[i] * ux + EY[i] * uy);
    f[n * 9 + i] = W9[i] * rho * (1 + eu + 0.5 * eu * eu - uu);
  }
}

// body = cells whose force we measure (the wing); solid = body + painted rocks.
export function setObstacles(t, body, rocks) {
  for (let n = 0; n < t.W * t.H; n++) {
    const was = t.solid[n]; t.body[n] = body[n]; t.solid[n] = body[n] || (rocks ? rocks[n] : 0);
    if (was && !t.solid[n]) setEq(t.f, n, 1, 0, 0); // uncovered cells re-enter as still air (else rho=0 -> NaN)
  }
}

// One BGK collide + push-stream with halfway bounce-back. Momentum exchange on body links.
export function step(t) {
  const { W, H, f, g, solid, body, rho, ux, uy } = t; const om = 1 / t.tau;
  let fx = 0, fy = 0;
  g.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = y * W + x, b = n * 9;
    if (solid[n]) { rho[n] = 1; ux[n] = uy[n] = 0; continue; }
    let r = 0, mx = 0, my = 0;
    for (let i = 0; i < 9; i++) { const v = f[b + i]; r += v; mx += v * EX[i]; my += v * EY[i]; }
    const vx = mx / r, vy = my / r; rho[n] = r; ux[n] = vx; uy[n] = vy;
    const uu = 1.5 * (vx * vx + vy * vy);
    for (let i = 0; i < 9; i++) {
      const eu = 3 * (EX[i] * vx + EY[i] * vy);
      const post = f[b + i] - om * (f[b + i] - W9[i] * r * (1 + eu + 0.5 * eu * eu - uu));
      const nx = x + EX[i]; let ny = y + EY[i];
      if (ny < 0) ny += H; else if (ny >= H) ny -= H; // periodic top/bottom
      if (nx < 0 || nx >= W) continue;
      const m = ny * W + nx;
      if (solid[m]) {
        g[b + OPP[i]] += post;
        if (body[m]) { fx += 2 * post * EX[i]; fy += 2 * post * EY[i]; }
      } else g[m * 9 + i] += post;
    }
  }
  for (let y = 0; y < H; y++) { // inlet = equilibrium, outlet = zero-gradient copy
    setEq(g, y * W, 1, t.u0, 0);
    const a = (y * W + W - 1) * 9, s = (y * W + W - 2) * 9;
    for (let i = 0; i < 9; i++) g[a + i] = g[s + i];
  }
  t.f = g; t.g = f; t.fx = fx; t.fy = fy; t.steps++;
}

export const SPEC = { W: 120, H: 60, chord: 34, cx: 38, cy: 30, warm: 700, measure: 500 };

// Lift (up) and drag, averaged over the measure window, in units normalised by u0^2 * chord.
export function evaluate(genome, cond, rocks = null, spec = SPEC) {
  const t = makeTunnel(spec.W, spec.H, cond.u0, cond.tau);
  setObstacles(t, wingMask(spec.W, spec.H, genome, spec.chord, spec.cx, spec.cy), rocks);
  let L = 0, D = 0;
  for (let s = 0; s < spec.warm + spec.measure; s++) {
    step(t);
    if (s >= spec.warm) { L += -t.fy; D += t.fx; }
  }
  const k = 1 / (spec.measure * 0.5 * cond.u0 * cond.u0 * spec.chord);
  return { cl: L * k, cd: D * k };
}

// Score: lift-to-drag with a lift floor so the ES cannot win by shrinking drag alone.
export function score(r) { return r.cl / Math.max(r.cd, 0.05) - 2 * Math.max(0, 0.3 - r.cl); }

export function fitness(genome, conds, rocks = null, spec = SPEC) {
  let s = 0; for (const c of conds) s += score(evaluate(genome, c, rocks, spec));
  return s / conds.length;
}

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

// Antithetic rank-shaped ES step; returns new mean and best seen.
export function esStep(mean, sigma, lr, pairs, evalFn, r) {
  const G = mean.length, noises = [], fits = [];
  for (let p = 0; p < pairs; p++) {
    const e = Array.from({ length: G }, () => gauss(r));
    for (const sg of [1, -1]) {
      const cand = mean.map((m, i) => Math.min(1, Math.max(0, m + sg * sigma * e[i])));
      noises.push(e.map((v) => v * sg)); fits.push({ f: evalFn(cand), cand });
    }
  }
  const order = fits.map((_, i) => i).sort((a, b) => fits[a].f - fits[b].f);
  const util = new Array(fits.length); order.forEach((idx, rank) => { util[idx] = rank / (fits.length - 1) - 0.5; });
  const next = mean.slice();
  for (let i = 0; i < G; i++) { let s = 0; for (let k = 0; k < fits.length; k++) s += util[k] * noises[k][i]; next[i] = Math.min(1, Math.max(0, mean[i] + lr * s / fits.length)); }
  const best = fits.reduce((a, b) => (b.f > a.f ? b : a));
  return { mean: next, best };
}
