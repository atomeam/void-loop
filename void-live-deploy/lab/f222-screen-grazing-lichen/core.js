// F-222 Screen-Grazing Lichen — core (UMD, no deps).
// A per-cell online predictor of the next frame of whatever is on the user's screen,
// with a fixed LEARNING BUDGET: only cells under an agent get a learning step each frame.
// Agents are drawn to surprise (prediction error), so they spend the budget where the world model is wrong.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Lichen = factory(); })(this, function () {
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const NF = 7; // features: cur, prev, up, down, left, right (current frame), bias
  class Model {
    constructor(W, H, opt = {}) {
      this.W = W; this.H = H; const N = W * H;
      this.w = new Float32Array(N * NF); for (let i = 0; i < N; i++) this.w[i * NF] = 1; // start as persistence predictor
      this.cur = new Float32Array(N); this.prev = new Float32Array(N); this.pred = new Float32Array(N);
      this.surprise = new Float32Array(N); this.repel = new Float32Array(N);
      this.lr = opt.lr || 0.5; this.frames = 0; this.err = 0; this.errHist = [];
      this.learnMask = new Uint8Array(N); this.updates = 0;
    }
    feat(i, out) {
      const W = this.W, H = this.H, x = i % W, y = (i / W) | 0, c = this.cur, p = this.prev;
      const l = x > 0 ? i - 1 : i, r = x < W - 1 ? i + 1 : i, u = y > 0 ? i - W : i, d = y < H - 1 ? i + W : i;
      out[0] = c[i]; out[1] = p[i]; out[2] = c[u]; out[3] = c[d]; out[4] = c[l]; out[5] = c[r]; out[6] = 1;
    }
    // Ingest a new luminance frame (Float32Array 0..1). Scores the previous prediction, learns on masked cells, predicts next.
    ingest(frame) {
      const N = this.W * this.H, f = new Float32Array(NF), w = this.w; let e = 0;
      if (this.frames > 1) {
        for (let i = 0; i < N; i++) {
          const err = frame[i] - this.pred[i], a = Math.abs(err); e += a;
          this.surprise[i] = this.surprise[i] * 0.8 + a * 0.2;
          if (this.learnMask[i]) { // normalized LMS on the features that produced pred[i]
            this.feat(i, f); let n = 1e-3; for (let k = 0; k < NF; k++) n += f[k] * f[k];
            const g = this.lr * err / n; for (let k = 0; k < NF; k++) w[i * NF + k] += g * f[k]; this.updates++;
          }
        }
        this.err = e / N; this.errHist.push(this.err);
      }
      this.prev.set(this.cur); this.cur.set(frame); this.frames++;
      for (let i = 0; i < N; i++) { this.feat(i, f); let s = 0; for (let k = 0; k < NF; k++) s += w[i * NF + k] * f[k]; this.pred[i] = s < 0 ? 0 : s > 1 ? 1 : s; }
      this.learnMask.fill(0);
    }
  }
  // Agents: physarum-style sensors on the surprise map. mode: 'surprise' | 'random' | 'sweep'
  class Colony {
    constructor(model, n, opt = {}) {
      this.m = model; this.n = n; this.mode = opt.mode || 'surprise'; this.r = rng(opt.seed || 1); this.patch = opt.patch == null ? 1 : opt.patch;
      this.x = new Float32Array(n); this.y = new Float32Array(n); this.a = new Float32Array(n); this.energy = new Float32Array(n);
      for (let i = 0; i < n; i++) { this.x[i] = this.r() * model.W; this.y[i] = this.r() * model.H; this.a[i] = this.r() * 6.283; }
      this.sweep = 0; this.eaten = 0;
    }
    at(x, y) { const m = this.m; x = Math.max(0, Math.min(m.W - 1, x | 0)); y = Math.max(0, Math.min(m.H - 1, y | 0)); const i = y * m.W + x; return m.surprise[i] - 0.5 * m.repel[i]; }
    step() {
      const m = this.m, W = m.W, H = m.H, P = this.patch, mask = m.learnMask;
      for (let i = 0; i < this.n; i++) {
        let cx, cy;
        if (this.mode === 'random') { cx = (this.r() * W) | 0; cy = (this.r() * H) | 0; }
        else if (this.mode === 'sweep') { const s = (this.sweep++ * (2 * P + 1) * (2 * P + 1)) % (W * H); cx = s % W; cy = (s / W) | 0; }
        else {
          const SD = 4, SA = 0.6, a = this.a[i], x = this.x[i], y = this.y[i];
          const f = this.at(x + Math.cos(a) * SD, y + Math.sin(a) * SD), l = this.at(x + Math.cos(a - SA) * SD, y + Math.sin(a - SA) * SD), r = this.at(x + Math.cos(a + SA) * SD, y + Math.sin(a + SA) * SD);
          if (f >= l && f >= r) {} else if (l > r) this.a[i] -= 0.45; else this.a[i] += 0.45;
          if (Math.max(f, l, r) < 0.004) this.a[i] += (this.r() - 0.5) * 1.5; // nothing surprising nearby: wander
          const sp = 1.2; let nx = x + Math.cos(this.a[i]) * sp, ny = y + Math.sin(this.a[i]) * sp;
          if (nx < 0 || nx >= W) { this.a[i] = Math.PI - this.a[i]; nx = Math.max(0, Math.min(W - 0.01, nx)); }
          if (ny < 0 || ny >= H) { this.a[i] = -this.a[i]; ny = Math.max(0, Math.min(H - 0.01, ny)); }
          this.x[i] = nx; this.y[i] = ny; cx = nx | 0; cy = ny | 0;
          const g = this.at(cx, cy); this.energy[i] += g; this.eaten += g;
        }
        if (this.mode !== 'surprise') { this.x[i] = cx + 0.5; this.y[i] = cy + 0.5; }
        for (let dy = -P; dy <= P; dy++) for (let dx = -P; dx <= P; dx++) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = 1; }
      }
    }
  }
  // Deterministic synthetic "screens" for tests and for the no-permission demo.
  function scene(kind, W, H, t, out) {
    out = out || new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // static "text" background: fixed hashed glyph texture
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; out[y * W + x] = (y % 6 < 4 && (h % 7) < 3) ? 0.15 : 0.92;
    }
    if (kind === 'scroll' || kind === 'mixed') { // a scrolling column (feed/chat) in the right third
      const x0 = (W * 0.62) | 0;
      for (let y = 0; y < H; y++) for (let x = x0; x < W - 2; x++) { const yy = y + t; const h = ((x * 2654435761) ^ (((yy / 1) | 0) * 40503)) >>> 0; out[y * W + x] = (yy % 5 < 3 && (h % 5) < 2) ? 0.1 : 0.85; }
    }
    if (kind === 'ball' || kind === 'mixed') { // two bouncing cursors/balls
      for (const [vx, vy, ph, r] of [[0.9, 0.6, 0, 3], [0.55, 1.1, 40, 2.5]]) {
        const span = (v, L) => { const p = (ph + v * t) % (2 * L); return p < L ? p : 2 * L - p; };
        const bx = span(vx, W * 0.55), by = span(vy, H - 1);
        for (let y = Math.max(0, by - r - 1) | 0; y < Math.min(H, by + r + 2); y++) for (let x = Math.max(0, bx - r - 1) | 0; x < Math.min(W, bx + r + 2); x++) if ((x - bx) ** 2 + (y - by) ** 2 < r * r) out[y * W + x] = 0.02;
      }
    }
    if (kind === 'video' || kind === 'mixed') { // a small "video" rectangle with a drifting periodic pattern
      const x0 = 4, y0 = (H * 0.55) | 0, w = (W * 0.3) | 0, h = (H * 0.35) | 0;
      for (let y = y0; y < Math.min(H, y0 + h); y++) for (let x = x0; x < x0 + w; x++) out[y * W + x] = 0.5 + 0.45 * Math.sin((x + t * 0.7) * 0.6) * Math.cos((y - t * 0.3) * 0.5);
    }
    return out;
  }
  return { Model, Colony, scene, rng };
});
