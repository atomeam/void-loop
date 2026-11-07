// The seamless pattern maker's sums (lab/pattern/). Pure, no DOM. Gray-Scott reaction-diffusion on a grid that wraps at every edge, so the
// picture it grows tiles with no seam: wallpaper, a fabric print, a game texture, a background. A seed and a preset always grow the same pattern,
// which is what lets a link carry it. The lab's Turing-pattern experiments grew these as screensavers; this grows one you keep.
export const PRESETS = Object.freeze({
  spots: { name: 'Spots', f: 0.0367, k: 0.0649 },
  coral: { name: 'Coral', f: 0.0545, k: 0.062 },
  maze: { name: 'Maze', f: 0.029, k: 0.057 },
  worms: { name: 'Worms', f: 0.046, k: 0.0594 },
  holes: { name: 'Holes', f: 0.039, k: 0.058 },
});
export const SIZE = 128, STEPS = 6000;

/** a small seeded random: the same seed gives the same numbers on every device. */
export function rng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** the starting field: all A, with a few squares of B dropped where the seed says. */
export function seedGrid(seed, n = SIZE) {
  const A = new Float32Array(n * n).fill(1), B = new Float32Array(n * n), r = rng(seed), drops = 6 + Math.floor(r() * 10);
  for (let d = 0; d < drops; d++) {
    const cx = Math.floor(r() * n), cy = Math.floor(r() * n), s = 3 + Math.floor(r() * 5);
    for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) { const i = ((cy + y + n) % n) * n + ((cx + x + n) % n); A[i] = 0.5; B[i] = 0.25; }
  }
  return { n, A, B, A2: new Float32Array(n * n), B2: new Float32Array(n * n), done: 0 };
}
/** run the reaction a number of steps; the edges wrap, which is what makes the tile seamless. */
export function step(g, preset, steps = 1) {
  const { n } = g, { f, k } = preset;
  for (let s = 0; s < steps; s++) {
    const { A, B, A2, B2 } = g;
    for (let y = 0; y < n; y++) {
      const up = ((y + n - 1) % n) * n, row = y * n, dn = ((y + 1) % n) * n;
      for (let x = 0; x < n; x++) {
        const l = (x + n - 1) % n, r = (x + 1) % n, i = row + x;
        const lapA = -A[i] + 0.2 * (A[row + l] + A[row + r] + A[up + x] + A[dn + x]) + 0.05 * (A[up + l] + A[up + r] + A[dn + l] + A[dn + r]);
        const lapB = -B[i] + 0.2 * (B[row + l] + B[row + r] + B[up + x] + B[dn + x]) + 0.05 * (B[up + l] + B[up + r] + B[dn + l] + B[dn + r]);
        const a = A[i], b = B[i], abb = a * b * b;
        A2[i] = Math.min(1, Math.max(0, a + lapA - abb + f * (1 - a)));
        B2[i] = Math.min(1, Math.max(0, b + 0.5 * lapB + abb - (k + f) * b));
      }
    }
    g.A = A2; g.B = B2; g.A2 = A; g.B2 = B; g.done++;
  }
  return g;
}
const hexRGB = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const v = m ? parseInt(m[1], 16) : 0; return [v >> 16, (v >> 8) & 255, v & 255]; };
/** B (0..1) -> a 0..1 shade, stretched so the pattern fills the range whatever the preset. */
export function shades(g) {
  const { B } = g; let lo = 1, hi = 0;
  for (let i = 0; i < B.length; i++) { if (B[i] < lo) lo = B[i]; if (B[i] > hi) hi = B[i]; }
  const span = hi - lo || 1, out = new Float32Array(B.length);
  for (let i = 0; i < B.length; i++) out[i] = (B[i] - lo) / span;
  return out;
}
/** paint a tile of `size` pixels from the shades, between two colours; the upscale wraps too, so a big tile still has no seam. */
export function paint(sh, n, size, back, ink) {
  const c0 = hexRGB(back), c1 = hexRGB(ink), px = new Uint8ClampedArray(size * size * 4), sc = n / size;
  for (let y = 0; y < size; y++) {
    const fy = y * sc, y0 = Math.floor(fy), ty = fy - y0, ya = (y0 % n) * n, yb = ((y0 + 1) % n) * n;
    for (let x = 0; x < size; x++) {
      const fx = x * sc, x0 = Math.floor(fx), tx = fx - x0, xa = x0 % n, xb = (x0 + 1) % n;
      const v = (sh[ya + xa] * (1 - tx) + sh[ya + xb] * tx) * (1 - ty) + (sh[yb + xa] * (1 - tx) + sh[yb + xb] * tx) * ty;
      const t = v * v * (3 - 2 * v), o = (y * size + x) * 4;
      px[o] = c0[0] + (c1[0] - c0[0]) * t; px[o + 1] = c0[1] + (c1[1] - c0[1]) * t; px[o + 2] = c0[2] + (c1[2] - c0[2]) * t; px[o + 3] = 255;
    }
  }
  return px;
}
/** what a share link carries: preset, seed and the two colours, as "coral.1234.0b0a10.a58bff". */
export const linkOf = (s) => [s.preset, s.seed >>> 0, s.back.replace('#', ''), s.ink.replace('#', '')].join('.');
export function fromLink(text) {
  const m = /^#?(?:p=)?([a-z]+)\.(\d{1,10})\.([0-9a-f]{6})\.([0-9a-f]{6})$/i.exec(String(text || '').trim());
  if (!m || !PRESETS[m[1].toLowerCase()]) return null;
  return { preset: m[1].toLowerCase(), seed: Number(m[2]) >>> 0, back: '#' + m[3].toLowerCase(), ink: '#' + m[4].toLowerCase() };
}
