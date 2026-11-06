// Colours from a photo (lab/photo-palette/). Pure, no DOM. Pixels are grouped in OKLab, where distance follows how different two colours look,
// by k-means with a seeded start, so the same photo always gives the same palette. Each colour comes with the share of the photo it covers.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
/** [r,g,b] 0..255 -> [L,a,b] OKLab (Björn Ottosson's matrices). */
export function toLab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function fromLab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
export const hexOf = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** RGBA pixel bytes -> OKLab points, skipping see-through pixels and taking every `stride`th one. */
export function pointsOf(rgba, stride = 1) {
  const out = [];
  for (let i = 0; i < rgba.length; i += 4 * stride) if (rgba[i + 3] >= 128) out.push(toLab([rgba[i], rgba[i + 1], rgba[i + 2]]));
  return out;
}
/** k-means (k-means++ start, seeded): the k colours of a photo, largest share first, as [{ hex, rgb, share }] with shares adding to 1. */
export function paletteOf(points, k = 6, seed = 7) {
  if (!points.length) return [];
  k = Math.max(1, Math.min(k, points.length)); const r = rng(seed), C = [points[Math.floor(r() * points.length)]], dist = new Float64Array(points.length).fill(Infinity);
  while (C.length < k) {
    let sum = 0; const last = C[C.length - 1];
    for (let i = 0; i < points.length; i++) { dist[i] = Math.min(dist[i], d2(points[i], last)); sum += dist[i]; }
    if (!sum) break; let t = r() * sum, j = 0; while (j < points.length - 1 && (t -= dist[j]) > 0) j++; C.push(points[j]);
  }
  const own = new Int32Array(points.length);
  for (let round = 0; round < 24; round++) {
    let moved = 0; const acc = C.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity; for (let c = 0; c < C.length; c++) { const v = d2(points[i], C[c]); if (v < bd) { bd = v; best = c; } }
      if (own[i] !== best) { own[i] = best; moved++; } const a = acc[best]; a[0] += points[i][0]; a[1] += points[i][1]; a[2] += points[i][2]; a[3]++;
    }
    for (let c = 0; c < C.length; c++) if (acc[c][3]) C[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
    if (round && !moved) break;
  }
  const count = C.map(() => 0); for (let i = 0; i < points.length; i++) count[own[i]]++;
  return C.map((c, i) => { const rgb = fromLab(c); return { hex: hexOf(rgb), rgb, share: count[i] / points.length, L: c[0] }; })
    .filter((x) => x.share > 0).sort((a, b) => b.share - a.share);
}
/** the palette as CSS custom properties: --photo-1: #…; */
export const cssOf = (pal) => ':root {\n' + pal.map((p, i) => '  --photo-' + (i + 1) + ': ' + p.hex + ';').join('\n') + '\n}';
/** a percentage that reads well: 0.4 % shows as "<1%". */
export const pctOf = (share) => (share < 0.01 ? '<1%' : Math.round(share * 100) + '%');
