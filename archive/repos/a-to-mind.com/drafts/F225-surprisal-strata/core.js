// F-225 Surprisal Strata — core (works in Node and browser)
// A blended order-0..N character model (PPM-flavoured, method-C escapes, exclusion-free blend)
// that learns online from whatever is typed, reports per-char surprisal in bits,
// and proposes the most likely continuation.
(function (root) {
  const ALPHA = 256; // byte-ish alphabet (char codes clipped)
  function code(c) { const k = c.charCodeAt(0); return k < ALPHA ? k : 63; }
  class PPM {
    constructor(order = 4) { this.order = order; this.ctx = new Map(); this.hist = ''; this.seen = new Set(); }
    _table(key) { let t = this.ctx.get(key); if (!t) { t = { total: 0, sym: new Map() }; this.ctx.set(key, t); } return t; }
    // probability of char c given history h, blended across orders with method-C escape weights
    prob(c, h = this.hist) {
      let p = 1 / ALPHA; // order -1 uniform
      for (let n = 0; n <= this.order; n++) {
        if (h.length < n) break;
        const t = this.ctx.get(h.slice(h.length - n));
        if (!t || t.total === 0) continue;
        const d = t.sym.size; // distinct symbols
        const lam = t.total / (t.total + d); // method C confidence
        p = lam * ((t.sym.get(c) || 0) / t.total) + (1 - lam) * p;
      }
      return p;
    }
    surprisal(c, h) { return -Math.log2(this.prob(c, h)); }
    learn(c) {
      const h = this.hist;
      for (let n = 0; n <= this.order; n++) {
        if (h.length < n) break;
        const t = this._table(h.slice(h.length - n));
        t.total++; t.sym.set(c, (t.sym.get(c) || 0) + 1);
      }
      this.hist = (h + c).slice(-this.order);
      this.seen.add(c);
    }
    // feed a char: returns surprisal (bits) BEFORE learning it — honest online coding cost
    feed(c) { const s = this.surprisal(c); this.learn(c); return s; }
    reset() { this.hist = ''; }
    // greedy continuation, stops at confidence floor or a space after a word
    predict(maxLen = 16, floor = 0.35) {
      let h = this.hist, out = '';
      const cands = [...this.seen];
      for (let i = 0; i < maxLen; i++) {
        let best = null, bp = 0;
        for (const c of cands) { const p = this.prob(c, h); if (p > bp) { bp = p; best = c; } }
        if (!best || bp < floor) break;
        out += best; h = (h + best).slice(-this.order);
        if (best === ' ' && out.trim().length) break;
      }
      return out;
    }
    get contexts() { return this.ctx.size; }
  }
  // Pearson correlation helper
  function pearson(a, b) {
    const n = Math.min(a.length, b.length); if (n < 3) return 0;
    let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }
  // Terrain: each written line deposits a stratum. Column x = char index within line (wrapped to W),
  // height added = surprisal, smeared with a gaussian so ridges form where writing was surprising.
  class Strata {
    constructor(W = 96, D = 64) { this.W = W; this.D = D; this.h = new Float32Array(W * D); this.layer = new Uint8Array(W * D); this.row = 0; this.col = 0; this.n = 0; }
    deposit(bits) {
      const { W, D } = this, cx = this.col % W, cz = this.row % D;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) {
        const x = (cx + dx + W) % W, z = (cz + dz + D) % D, g = Math.exp(-(dx * dx) / 4 - (dz * dz) / 2);
        this.h[z * W + x] += bits * g * 0.04; this.layer[z * W + x] = this.n % 8;
      }
      this.col++;
    }
    newline() { this.row++; this.col = 0; this.n++; }
    erode(k = 0.999) { for (let i = 0; i < this.h.length; i++) this.h[i] *= k; }
  }
  const api = { PPM, Strata, pearson };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.F225 = api;
})(typeof window !== 'undefined' ? window : globalThis);
