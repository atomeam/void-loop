// F-306 Slime Rail Planner core: Physarum transport sim + network extraction + ES. Shared by page, Worker and Node.
(function (root) {
  'use strict';
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  // genome in [0,1]^6 -> physics
  function decode(g) {
    return {
      SA: 0.15 + g[0] * 1.0,      // sensor angle (rad)
      RA: 0.10 + g[1] * 0.9,      // rotate angle (rad)
      SO: 2 + g[2] * 12,          // sensor offset (cells)
      decay: 0.80 + g[3] * 0.19,  // trail kept per step
      food: 2 + g[4] * 30,        // city deposit strength
      k: 0.5 + g[5] * 4.0,        // extraction threshold = k * mean trail
    };
  }
  function makeCities(n, W, H, seed) {
    const r = rng(seed * 7919 + 3), c = [];
    let guard = 0;
    while (c.length < n && guard++ < 5000) {
      const x = 0.12 * W + r() * 0.76 * W, y = 0.12 * H + r() * 0.76 * H;
      if (c.every(p => Math.hypot(p.x - x, p.y - y) > Math.min(W, H) * 0.16)) c.push({ x, y });
    }
    return c;
  }
  function World(W, H, nAgents, cities, genome, seed) {
    this.W = W; this.H = H; this.cities = cities; this.r = rng(seed || 1);
    this.trail = new Float32Array(W * H); this.tmp = new Float32Array(W * H);
    this.n = nAgents; this.ax = new Float32Array(nAgents); this.ay = new Float32Array(nAgents); this.ah = new Float32Array(nAgents);
    this.setGenome(genome);
    for (let i = 0; i < nAgents; i++) this.respawn(i);
  }
  World.prototype.setGenome = function (g) { this.g = g.slice(); this.p = decode(g); };
  World.prototype.respawn = function (i) {
    const r = this.r, c = this.cities[(r() * this.cities.length) | 0];
    const a = r() * 6.2832, d = r() * 4;
    this.ax[i] = c.x + Math.cos(a) * d; this.ay[i] = c.y + Math.sin(a) * d; this.ah[i] = r() * 6.2832;
  };
  World.prototype.sense = function (x, y, h) {
    const W = this.W, H = this.H, so = this.p.SO;
    let sx = (x + Math.cos(h) * so) | 0, sy = (y + Math.sin(h) * so) | 0;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return -1;
    return this.trail[sy * W + sx];
  };
  World.prototype.step = function () {
    const W = this.W, H = this.H, t = this.trail, p = this.p, r = this.r;
    for (let i = 0; i < this.n; i++) {
      let x = this.ax[i], y = this.ay[i], h = this.ah[i];
      const f = this.sense(x, y, h), L = this.sense(x, y, h - p.SA), R = this.sense(x, y, h + p.SA);
      if (f >= L && f >= R) {} else if (L > R) h -= p.RA; else if (R > L) h += p.RA; else h += (r() - 0.5) * 2 * p.RA;
      x += Math.cos(h); y += Math.sin(h);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { this.respawn(i); continue; }
      this.ax[i] = x; this.ay[i] = y; this.ah[i] = h;
      t[(y | 0) * W + (x | 0)] += 1;
    }
    for (const c of this.cities) { // food sources
      const cx = c.x | 0, cy = c.y | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t[(cy + dy) * W + cx + dx] += p.food;
    }
    // 3x3 blur + decay
    const o = this.tmp, d = p.decay;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      o[k] = d * (t[k - W - 1] + t[k - W] + t[k - W + 1] + t[k - 1] + t[k] + t[k + 1] + t[k + W - 1] + t[k + W] + t[k + W + 1]) / 9;
    }
    this.trail = o; this.tmp = t;
  };
  // network extraction: threshold the trail, then BFS between cities over the mask
  function extract(trail, W, H, cities, k) {
    let s = 0, s2 = 0, n = W * H;
    for (let i = 0; i < n; i++) { s += trail[i]; s2 += trail[i] * trail[i]; }
    const mean = s / n, th = k * mean;
    const mask = new Uint8Array(n); let cost = 0;
    for (let i = 0; i < n; i++) if (trail[i] > th) { mask[i] = 1; cost++; }
    const idx = cities.map(c => (c.y | 0) * W + (c.x | 0));
    for (const i of idx) mask[i] = 1;
    const dist = []; // grid BFS distance from each city (8-connected, unit steps)
    for (const src of idx) {
      const D = new Int32Array(n).fill(-1), q = new Int32Array(n); let h = 0, tl = 0; D[src] = 0; q[tl++] = src;
      while (h < tl) { const u = q[h++], ux = u % W, uy = (u / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue;
          const vx = ux + dx, vy = uy + dy; if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue; const v = vy * W + vx;
          if (mask[v] && D[v] < 0) { D[v] = D[u] + 1; q[tl++] = v; } } }
      dist.push(idx.map(j => D[j]));
    }
    return { mask, cost, th, dist };
  }
  function mstLength(c) { // Prim on euclid (chebyshev-ish grid length ~ euclid)
    const n = c.length, inT = new Array(n).fill(false), best = new Array(n).fill(Infinity); best[0] = 0; let tot = 0;
    for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i;
      inT[u] = true; tot += best[u]; for (let v = 0; v < n; v++) if (!inT[v]) best[v] = Math.min(best[v], Math.hypot(c[u].x - c[v].x, c[u].y - c[v].y)); }
    return tot;
  }
  function score(net, cities) {
    const n = cities.length; let pairs = 0, conn = 0, stretch = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { pairs++; const d = net.dist[i][j];
      if (d > 0) { conn++; const e = Math.max(Math.abs(cities[i].x - cities[j].x), Math.abs(cities[i].y - cities[j].y)); stretch += d / Math.max(1, e); } }
    const connFrac = conn / pairs, meanStretch = conn ? stretch / conn : 9, costRatio = net.cost / mstLength(cities);
    // reward connection, penalise rail laid (in MST lengths) and detours
    const fitness = 3 * connFrac - 0.08 * costRatio - 1.0 * Math.max(0, meanStretch - 1) * connFrac;
    return { fitness, connFrac, meanStretch, costRatio };
  }
  function evaluate(genome, seeds, opt) {
    opt = opt || {}; const W = opt.W || 112, H = opt.H || 112, steps = opt.steps || 260, nA = opt.agents || 3000, nc = opt.cities || 7;
    let tot = 0; const det = [];
    for (const sd of seeds) { const cities = makeCities(nc, W, H, sd), w = new World(W, H, nA, cities, genome, sd * 31 + 1);
      for (let s = 0; s < steps; s++) w.step();
      const sc = score(extract(w.trail, W, H, cities, w.p.k), cities); tot += sc.fitness; det.push(sc); }
    return { fitness: tot / seeds.length, det };
  }
  // antithetic, rank-shaped ES
  function ES(seed, sigma, lr) { this.r = rng(seed); this.mu = [0.5, 0.4, 0.4, 0.6, 0.4, 0.4]; this.sigma = sigma || 0.18; this.lr = lr || 0.6; this.best = null; this.bestF = -1e9; }
  ES.prototype.gauss = function () { const u = this.r() || 1e-9, v = this.r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
  ES.prototype.generation = function (pairs, fit) {
    const D = this.mu.length, eps = [], cand = [];
    for (let i = 0; i < pairs; i++) { const e = []; for (let d = 0; d < D; d++) e.push(this.gauss()); eps.push(e, e.map(v => -v)); }
    for (const e of eps) cand.push(this.mu.map((m, d) => Math.min(1, Math.max(0, m + this.sigma * e[d]))));
    const f = cand.map(fit), order = f.map((v, i) => i).sort((a, b) => f[a] - f[b]), rank = new Array(f.length);
    order.forEach((i, r) => rank[i] = r / (f.length - 1) - 0.5);
    for (let d = 0; d < D; d++) { let g = 0; for (let i = 0; i < f.length; i++) g += rank[i] * eps[i][d]; this.mu[d] = Math.min(1, Math.max(0, this.mu[d] + this.lr * g / f.length)); }
    f.forEach((v, i) => { if (v > this.bestF) { this.bestF = v; this.best = cand[i]; } });
    return { mean: f.reduce((a, b) => a + b) / f.length, best: this.bestF, step: this.lr };
  }
  const api = { rng, decode, makeCities, World, extract, score, mstLength, evaluate, ES };
  if (typeof module !== 'undefined') module.exports = api; else root.SlimeCore = api;
})(typeof self !== 'undefined' ? self : this);
