// F-227 core: a hyperdimensional (VSA) tile mind + wave-function-collapse dreamer.
// No weights, no downloads. Runs in the browser and in Node (ES module).
export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], OPP = [2, 3, 0, 1];
function popcnt(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }

// TileMind: one random hypervector per tile; per direction d an integer accumulator
// holding the bundle of bind(T[a], perm_d(T[b])) over every observed a->b adjacency.
// Observations can be added and removed (sign -1), so painting edits the memory in place.
export class TileMind {
  constructor(nTiles, D = 8192, seed = 7) {
    this.n = nTiles; this.D = D; this.W = D >>> 5;
    const r = rng(seed);
    this.T = []; for (let i = 0; i < nTiles; i++) { const v = new Uint32Array(this.W); for (let w = 0; w < this.W; w++) v[w] = (r() * 4294967296) >>> 0; this.T.push(v); }
    // perm_d = rotate by (d+1)*k words (a fixed permutation per direction)
    this.PT = [0, 1, 2, 3].map(d => this.T.map(v => { const k = ((d + 1) * 37) % this.W, o = new Uint32Array(this.W); for (let w = 0; w < this.W; w++) o[(w + k) % this.W] = v[w]; return o; }));
    this.acc = [0, 1, 2, 3].map(() => new Int32Array(D));
    this.freq = new Float64Array(nTiles);
    this.nObs = 0;
    this.damage = new Uint8Array(D); this.damageP = 0;
  }
  observe(a, d, b, sign = 1) {
    const acc = this.acc[d], A = this.T[a], B = this.PT[d][b];
    for (let w = 0; w < this.W; w++) { const k = A[w] ^ B[w], base = w << 5; for (let i = 0; i < 32; i++) acc[base + i] += ((k >>> i) & 1) ? sign : -sign; }
    this.nObs += sign;
  }
  learnMap(map, W, H, sign = 1) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = map[y * W + x]; this.freq[a] += sign;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; this.observe(a, d, map[ny * W + nx], sign); }
    }
  }
  // edit one cell of a learned map: unlearn old relations, learn new ones
  edit(map, W, H, x, y, t) {
    const old = map[y * W + x]; if (old === t) return false;
    const touch = (sign) => {
      const a = map[y * W + x]; this.freq[a] += sign;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const b = map[ny * W + nx]; this.observe(a, d, b, sign); this.observe(b, OPP[d], a, sign); }
    };
    touch(-1); map[y * W + x] = t; touch(1); return true;
  }
  setDamage(p, seed = 99) { const r = rng(seed); this.damageP = p; for (let i = 0; i < this.D; i++) this.damage[i] = r() < p ? 1 : 0; }
  // Decode the bundle by matching pursuit ("explaining away"): repeatedly find the key
  // hypervector bind(T[a], perm_d(T[b])) that best explains the residual memory, estimate
  // its count, subtract it, and stop when the best remaining key is within crosstalk noise.
  // Dots are updated through the keys' Gram matrix, so each peel costs O(keys), not O(D).
  keys() {
    if (this._keys) return this._keys;
    const n = this.n, D = this.D, K = [];
    for (let d = 0; d < 4; d++) { const kd = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const v = new Int8Array(D), A = this.T[a], B = this.PT[d][b];
      for (let w = 0; w < this.W; w++) { const k = A[w] ^ B[w], base = w << 5; for (let i = 0; i < 32; i++) v[base + i] = ((k >>> i) & 1) ? 1 : -1; }
      kd.push(v); } K.push(kd); }
    const G = K.map(kd => { const m = kd.length, g = new Float64Array(m * m); for (let i = 0; i < m; i++) for (let j = i; j < m; j++) { let s = 0; const x = kd[i], y = kd[j]; for (let t = 0; t < D; t++) s += x[t] * y[t]; g[i * m + j] = g[j * m + i] = s; } return g; });
    return (this._keys = { K, G });
  }
  decode(mode = 'acc', z = 4, maxPeel = 200) {
    const n = this.n, D = this.D, m = n * n, { K, G } = this.keys(), coef = [], trace = [];
    for (let d = 0; d < 4; d++) {
      const acc = this.acc[d], dm = this.damage, eff = new Float64Array(D); let rr = 0;
      for (let i = 0; i < D; i++) { let v = acc[i]; if (dm[i]) v = -v; if (mode === 'bin') v = v > 0 ? 1 : v < 0 ? -1 : (((i * 2654435761) >>> 0) & 1 ? 1 : -1); eff[i] = v; rr += v * v; }
      const dots = new Float64Array(m); for (let k = 0; k < m; k++) { const key = K[d][k]; let s = 0; for (let i = 0; i < D; i++) s += key[i] * eff[i]; dots[k] = s; }
      const c = new Float64Array(m); let peels = 0;
      while (peels++ < maxPeel && rr > 1e-9) {
        let best = -1, bz = 0; const sd = Math.sqrt(rr);
        for (let k = 0; k < m; k++) { const zk = dots[k] / sd; if (zk > bz) { bz = zk; best = k; } }
        if (best < 0 || bz < z) break;
        const amt = dots[best] / D; c[best] += amt;
        rr = Math.max(0, rr - 2 * amt * dots[best] + amt * amt * D);
        for (let k = 0; k < m; k++) dots[k] -= amt * G[d][best * m + k];
      }
      coef.push(c); trace.push(peels - 1);
    }
    return { coef, peels: trace };
  }
  // symmetric allowed-neighbour masks: allowed[d][a] = bitmask of b that may sit at direction d of a
  rules(mode = 'acc', z = 4) {
    const { coef, peels } = this.decode(mode, z), n = this.n, allowed = [0, 1, 2, 3].map(() => new Uint32Array(n)), Z = [0, 1, 2, 3].map(() => new Float64Array(n * n));
    let scale = 1; if (mode === 'bin') { let mx = 0; for (const c of coef) for (const v of c) mx = Math.max(mx, v); scale = mx > 0 ? 1 / mx : 1; }
    for (let d = 0; d < 4; d++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const s = Math.max(coef[d][a * n + b], coef[OPP[d]][b * n + a]) * scale; Z[d][a * n + b] = s;
      if (s > 0 && this.freq[a] > 0 && this.freq[b] > 0) allowed[d][a] |= 1 << b;
    }
    return { allowed, Z, peels };
  }
}

export function exactRules(map, W, H, n) {
  const allowed = [0, 1, 2, 3].map(() => new Uint32Array(n)), count = [0, 1, 2, 3].map(() => new Float64Array(n * n));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let d = 0; d < 4; d++) {
    const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const a = map[y * W + x], b = map[ny * W + nx]; allowed[d][a] |= 1 << b; count[d][a * n + b]++;
  }
  return { allowed, count };
}

// Wave function collapse over bitmask cells with local repair instead of global restart.
export class WFC {
  constructor(W, H, n, allowed, weights, seed = 1) {
    this.W = W; this.H = H; this.n = n; this.allowed = allowed; this.wt = weights; this.r = rng(seed);
    let full = 0; for (let t = 0; t < n; t++) if (weights[t] > 0) full |= 1 << t; this.full = full;
    this.cell = new Uint32Array(W * H).fill(full); this.done = 0; this.repairs = 0; this.failed = false; this.order = [];
  }
  support(mask, d) { let s = 0; for (let a = 0; a < this.n; a++) if (mask & (1 << a)) s |= this.allowed[d][a]; return s; }
  propagate(stack) {
    const { W, H, cell } = this;
    while (stack.length) {
      const c = stack.pop(), x = c % W, y = (c / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx, m = cell[ni] & this.support(cell[c], d);
        if (m !== cell[ni]) { cell[ni] = m; if (!m) return ni; stack.push(ni); }
      }
    }
    return -1;
  }
  repair(at, R = 3) {
    this.repairs++; const { W, H, cell } = this, x0 = at % W, y0 = (at / W) | 0, stack = [];
    for (let y = Math.max(0, y0 - R); y <= Math.min(H - 1, y0 + R); y++) for (let x = Math.max(0, x0 - R); x <= Math.min(W - 1, x0 + R); x++) cell[y * W + x] = this.full;
    // re-impose constraints from everything outside the hole, then from inside
    for (let y = Math.max(0, y0 - R - 1); y <= Math.min(H - 1, y0 + R + 1); y++) for (let x = Math.max(0, x0 - R - 1); x <= Math.min(W - 1, x0 + R + 1); x++) {
      const inside = Math.abs(x - x0) <= R && Math.abs(y - y0) <= R; if (!inside) stack.push(y * W + x);
    }
    const bad = this.propagate(stack); this.recount(); return bad;
  }
  recount() { let k = 0; for (const m of this.cell) if (m && !(m & (m - 1))) k++; this.done = k; }
  entropy(m) { let s = 0, sl = 0; for (let t = 0; t < this.n; t++) if (m & (1 << t)) { const w = this.wt[t]; s += w; sl += w * Math.log(w); } return s > 0 ? Math.log(s) - sl / s : 0; }
  step() {
    if (this.failed) return false;
    const { cell } = this; let best = -1, be = Infinity;
    for (let i = 0; i < cell.length; i++) { const m = cell[i]; if (m & (m - 1)) { const e = this.entropy(m) + this.r() * 1e-6; if (e < be) { be = e; best = i; } } }
    if (best < 0) { this.recount(); return false; }
    const m = cell[best]; let tot = 0; for (let t = 0; t < this.n; t++) if (m & (1 << t)) tot += this.wt[t];
    let r = this.r() * tot, pick = 0; for (let t = 0; t < this.n; t++) if (m & (1 << t)) { r -= this.wt[t]; if (r <= 0) { pick = t; break; } pick = t; }
    cell[best] = 1 << pick; this.order.push(best);
    let bad = this.propagate([best]), guard = 0;
    while (bad >= 0) { if (++guard > 20 || this.repairs > 400) { this.failed = true; return false; } bad = this.repair(bad, 2 + Math.min(guard, 4)); }
    this.recount(); return true;
  }
  run(maxSteps = 1e6) { let s = 0; while (s++ < maxSteps && this.step()); this.recount(); return this; }
  tiles() { return Array.from(this.cell, m => m ? 31 - Math.clz32(m & -m) : -1); }
}

export function violations(tiles, W, H, exactAllowed) {
  let bad = 0, tot = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let d = 0; d < 2; d++) {
    const nx = x + DX[d], ny = y + DY[d]; if (nx >= W || ny >= H) continue;
    const a = tiles[y * W + x], b = tiles[ny * W + nx]; tot++; if (a < 0 || b < 0 || !(exactAllowed[d][a] & (1 << b))) bad++;
  }
  return { bad, tot, rate: bad / tot };
}

// Procedural example: smooth value-noise heightmap quantised into terrain bands
export const TILES = [
  { name: 'deep', color: [0.07, 0.16, 0.42], h: 0.15 }, { name: 'water', color: [0.16, 0.38, 0.72], h: 0.25 },
  { name: 'sand', color: [0.86, 0.79, 0.52], h: 0.4 }, { name: 'grass', color: [0.36, 0.66, 0.29], h: 0.55 },
  { name: 'forest', color: [0.13, 0.42, 0.2], h: 0.9 }, { name: 'rock', color: [0.5, 0.48, 0.47], h: 1.4 },
  { name: 'snow', color: [0.95, 0.96, 1.0], h: 1.9 }, { name: 'road', color: [0.35, 0.27, 0.2], h: 0.5 },
];
export function sampleMap(W, H, seed = 3) {
  const r = rng(seed), G = 6, g = Array.from({ length: (G + 1) * (G + 1) }, () => r());
  const v = (x, y) => { const gx = x / W * G, gy = y / H * G, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, s = t => t * t * (3 - 2 * t), at = (i, j) => g[Math.min(G, j) * (G + 1) + Math.min(G, i)];
    return (at(ix, iy) * (1 - s(fx)) + at(ix + 1, iy) * s(fx)) * (1 - s(fy)) + (at(ix, iy + 1) * (1 - s(fx)) + at(ix + 1, iy + 1) * s(fx)) * s(fy); };
  const cut = [0.22, 0.35, 0.42, 0.58, 0.7, 0.8], map = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = v(x, y); let t = 0; while (t < cut.length && h > cut[t]) t++; map[y * W + x] = t; }
  // a road along one grass/forest row, only on mid bands
  const ry = (H * 0.6) | 0; for (let x = 0; x < W; x++) { const t = map[ry * W + x]; if (t === 3 || t === 4) map[ry * W + x] = 7; }
  return map;
}
