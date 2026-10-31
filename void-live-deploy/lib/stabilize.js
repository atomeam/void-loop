// Stabilize Video (2026-10-30, /converter/): the shake of a video found from its own pictures and taken out. Pure: no DOM.
// 1. Each picture is made small and gray (gray(), workSize()).
// 2. motion(a, b): how picture b moved from picture a, as one similarity transform (a move, a turn and a change of size). First a coarse move
//    of the whole picture on a 4 times smaller copy, then a grid of blocks, each matched near that move with a sub-pixel fit, then the
//    transform that best fits the block moves. Blocks with too little detail to match, or far from the fit, are left out.
// 3. plan(): the moves added up give the path of the camera; the path is averaged over a Gaussian window (the level sets how long), and each
//    picture gets the correction that puts it on the smooth path. One zoom for the whole video hides the edges that the corrections move into
//    view; where a picture would need more zoom than the level allows, its correction is made smaller, smoothly.
// A transform is { a, b, tx, ty }: x' = a x - b y + tx, y' = b x + a y + ty, about the centre of the picture, in pixels of the small picture.

export const IDENT = Object.freeze({ a: 1, b: 0, tx: 0, ty: 0 });
// the 5 levels of onlineconverter.com's Stabilize Video, as Verse does them: how long the path is averaged over (the Gaussian's sigma, in
// seconds) and the most the picture is zoomed in to hide the edges
export const LEVELS = Object.freeze({
  1: { name: 'Stable', sigma: 0.25, zoom: 1.06 },
  2: { name: 'More Stable', sigma: 0.5, zoom: 1.08 },
  3: { name: 'Very Stable', sigma: 1, zoom: 1.12 },
  4: { name: 'Super Stable', sigma: 2, zoom: 1.16 },
  5: { name: 'Most Stable', sigma: 4, zoom: 1.2 },
});
export const WORK = 256; // the width the pictures are made for the motion search

export const compose = (m2, m1) => ({ a: m2.a * m1.a - m2.b * m1.b, b: m2.a * m1.b + m2.b * m1.a, tx: m2.a * m1.tx - m2.b * m1.ty + m2.tx, ty: m2.b * m1.tx + m2.a * m1.ty + m2.ty });
export const invert = (m) => { const d = m.a * m.a + m.b * m.b, a = m.a / d, b = -m.b / d; return { a, b, tx: -(a * m.tx - b * m.ty), ty: -(b * m.tx + a * m.ty) }; };
export const apply = (m, x, y) => [m.a * x - m.b * y + m.tx, m.b * x + m.a * y + m.ty];
/** a transform as [turn (radians), log of the size, move x, move y], and back */
export const params = (m) => [Math.atan2(m.b, m.a), Math.log(Math.hypot(m.a, m.b)), m.tx, m.ty];
export const fromParams = ([r, ls, tx, ty]) => { const s = Math.exp(ls); return { a: s * Math.cos(r), b: s * Math.sin(r), tx, ty }; };

/** the size of the small picture: WORK pixels wide (fewer for a small video), the height in proportion */
export function workSize(w, h) { const k = Math.min(1, WORK / Math.max(w, h)); return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))]; }
/** RGBA bytes to a gray picture (0-255) */
export function gray(rgba, w, h) { const g = new Float32Array(w * h); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]; return g; }
function half(g, w, h) { const W = w >> 1, H = h >> 1, o = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 2 * y * w + 2 * x; o[y * W + x] = (g[i] + g[i + 1] + g[i + w] + g[i + w + 1]) / 4; } return [o, W, H]; }

// the mean absolute difference of a and b moved by (dx, dy), over the part where they overlap, and how much overlaps
function meanDiff(a, b, w, h, dx, dy, step = 1) {
  let s = 0, n = 0; const x0 = Math.max(0, -dx), x1 = Math.min(w, w - dx), y0 = Math.max(0, -dy), y1 = Math.min(h, h - dy);
  for (let y = y0; y < y1; y += step) { const ra = y * w, rb = (y + dy) * w + dx; for (let x = x0; x < x1; x += step) { s += Math.abs(a[ra + x] - b[rb + x]); n++; } }
  return [n ? s / n : Infinity, n];
}
// the minimum of a parabola through 3 values, as an offset from the middle one (-0.5 to 0.5)
const vertex = (l, c, r) => { const d = l - 2 * c + r; return d > 1e-9 ? Math.max(-0.5, Math.min(0.5, (l - r) / (2 * d))) : 0; };
// the transform that best fits pairs [x, y, x', y'] (least squares)
function fit(pairs) {
  const n = pairs.length; let mx = 0, my = 0, ux = 0, uy = 0;
  for (const [x, y, X, Y] of pairs) { mx += x; my += y; ux += X; uy += Y; }
  mx /= n; my /= n; ux /= n; uy /= n; let sxx = 0, p = 0, q = 0;
  for (const [x, y, X, Y] of pairs) { const xs = x - mx, ys = y - my, xd = X - ux, yd = Y - uy; sxx += xs * xs + ys * ys; p += xs * xd + ys * yd; q += xs * yd - ys * xd; }
  if (sxx < 1e-9) return { a: 1, b: 0, tx: ux - mx, ty: uy - my };
  const a = p / sxx, b = q / sxx; return { a, b, tx: ux - (a * mx - b * my), ty: uy - (b * mx + a * my) };
}
const median = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

/** how gray picture b (w x h) moved from gray picture a: a transform m with (a point in b) = m(the same point in a), about the centre, and
 *  how many blocks it rests on. A picture with no detail to match (a plain colour) gives no move. */
export function motion(a, b, w, h) {
  // 1. the coarse move: on a 4 times smaller copy, every move of up to 6 of its pixels (24 here) is tried over the whole picture
  const [a1, w1, h1] = half(a, w, h), [b1] = half(b, w, h), [a2, w2, h2] = half(a1, w1, h1), [b2] = half(b1, w1, h1);
  let best = Infinity, cx = 0, cy = 0; const R = 6, minN = w2 * h2 * 0.4;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const [d, n] = meanDiff(a2, b2, w2, h2, dx, dy), e = d + 1e-3 * (Math.abs(dx) + Math.abs(dy)); if (n >= minN && e < best) { best = e; cx = dx; cy = dy; } } // on a tie, the smaller move
  cx *= 4; cy *= 4;
  // 2. blocks of 16 x 16 on a grid; each is looked for within 5 pixels of the coarse move, then placed to a part of a pixel
  const B = 16, S = 5, pairs = [];
  for (let by = B; by + 2 * B <= h; by += B) for (let bx = B; bx + 2 * B <= w; bx += B) {
    const ox = cx, oy = cy;
    if (bx + ox - S - 1 < 0 || by + oy - S - 1 < 0 || bx + B + ox + S + 1 > w || by + B + oy + S + 1 > h) continue;
    let m = 0, m2 = 0; for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) { const v = a[y * w + x]; m += v; m2 += v * v; }
    m /= B * B; if (m2 / (B * B) - m * m < 25) continue; // too little detail to match (a standard deviation under 5 of 255)
    const sad = new Float32Array((2 * S + 3) ** 2), side = 2 * S + 3; let bi = -1, bv = Infinity, sum = 0;
    for (let dy = -S - 1; dy <= S + 1; dy++) for (let dx = -S - 1; dx <= S + 1; dx++) {
      let s = 0; for (let y = 0; y < B; y++) { const ra = (by + y) * w + bx, rb = (by + y + oy + dy) * w + bx + ox + dx; for (let x = 0; x < B; x++) s += Math.abs(a[ra + x] - b[rb + x]); }
      const k = (dy + S + 1) * side + dx + S + 1; sad[k] = s; sum += s;
      if (Math.abs(dx) <= S && Math.abs(dy) <= S && s < bv) { bv = s; bi = k; }
    }
    // a match no better than most places (a repeating pattern, an edge along the move) says nothing
    if (bv > 0.7 * sum / sad.length) continue;
    const ix = bi % side, iy = (bi / side) | 0, fx = vertex(sad[bi - 1], bv, sad[bi + 1]), fy = vertex(sad[bi - side], bv, sad[bi + side]);
    const dx = ox + ix - S - 1 + fx, dy = oy + iy - S - 1 + fy, px = bx + B / 2 - w / 2, py = by + B / 2 - h / 2;
    pairs.push([px, py, px + dx, py + dy]);
  }
  if (pairs.length < 6) return pairs.length ? { m: { a: 1, b: 0, tx: median(pairs.map((p) => p[2] - p[0])), ty: median(pairs.map((p) => p[3] - p[1])) }, blocks: pairs.length } : { m: { ...IDENT, tx: cx, ty: cy }, blocks: 0 };
  // 3. the best fit, then twice: blocks far from it (a thing that moves on its own) are left out and it is fitted again
  let use = pairs, m = fit(use);
  for (let k = 0; k < 2; k++) {
    const res = pairs.map(([x, y, X, Y]) => { const [u, v] = apply(m, x, y); return Math.hypot(u - X, v - Y); }), lim = Math.max(0.5, 2.5 * median(res));
    const keep = pairs.filter((_, i) => res[i] <= lim); if (keep.length < 6) break; use = keep; m = fit(use);
  }
  // 4. the fit made exact on the whole picture (Gauss-Newton on the gray levels), with pixels that do not agree (a thing that moves on its
  // own) counting less; a step that makes the difference larger is not taken
  m = refine(a, b, w, h, m);
  // a hand-held camera does not change its size by more than 10% from one picture to the next: such a fit is a wrong match, and the size is kept
  const s = Math.hypot(m.a, m.b); if (s < 0.9 || s > 1.1) m = fromParams([Math.atan2(m.b, m.a), 0, m.tx, m.ty]);
  return { m, blocks: use.length };
}

// b at (x, y) (pixel centres at whole numbers), with its slope in x and y; null outside
function sample(b, w, h, x, y) {
  if (x < 1 || y < 1 || x > w - 2 || y > h - 2) return null;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * w + x0;
  const p = b[i], q = b[i + 1], r = b[i + w], t = b[i + w + 1];
  return [p + (q - p) * fx + (r - p) * fy + (p - q - r + t) * fx * fy, (q - p) * (1 - fy) + (t - r) * fy, (r - p) * (1 - fx) + (t - q) * fx];
}
function refine(a, b, w, h, m0) {
  let m = { ...m0 }, err = Infinity; const cx = w / 2 - 0.5, cy = h / 2 - 0.5;
  const cost = (mm) => { let s = 0, n = 0; for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) { const px = x - cx, py = y - cy, [u, v] = apply(mm, px, py), g = sample(b, w, h, u + cx, v + cy); if (!g) continue; const r = g[0] - a[y * w + x]; s += r * r / (1 + r * r / 100); n++; } return n > w * h / 16 ? s / n : Infinity; };
  err = cost(m);
  for (let it = 0; it < 8; it++) {
    const A = new Float64Array(16), B = new Float64Array(4);
    for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) {
      const px = x - cx, py = y - cy, [u, v] = apply(m, px, py), g = sample(b, w, h, u + cx, v + cy); if (!g) continue;
      const r = g[0] - a[y * w + x], k = 1 / (1 + r * r / 100), gx = g[1], gy = g[2];
      const J = [gx * px + gy * py, -gx * py + gy * px, gx, gy];
      for (let i = 0; i < 4; i++) { B[i] -= k * J[i] * r; for (let j = 0; j < 4; j++) A[i * 4 + j] += k * J[i] * J[j]; }
    }
    const d = solve4(A, B); if (!d) break;
    const next = { a: m.a + d[0], b: m.b + d[1], tx: m.tx + d[2], ty: m.ty + d[3] }, e = cost(next);
    if (!(e < err)) break; m = next; const small = Math.abs(d[2]) + Math.abs(d[3]) < 1e-3; err = e; if (small) break;
  }
  return m;
}
// A x = B for 4 x 4 (Gaussian elimination with pivots); null if A has no inverse
function solve4(A, B) {
  const M = [0, 1, 2, 3].map((i) => [A[i * 4], A[i * 4 + 1], A[i * 4 + 2], A[i * 4 + 3], B[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[4] / row[i]);
}

// does the picture, moved by m and zoomed by z about the centre, cover all of the output (both w x h)?
function covers(m, z, w, h) {
  const inv = invert({ a: m.a * z, b: m.b * z, tx: m.tx * z, ty: m.ty * z }), e = 1e-6;
  for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) { const [u, v] = apply(inv, x, y); if (Math.abs(u) > w / 2 + e || Math.abs(v) > h / 2 + e) return false; }
  return true;
}
/** the least zoom (1 or more) with which m covers the output, or Infinity if more than `most` */
export function zoomFor(m, w, h, most) {
  if (covers(m, 1, w, h)) return 1; if (!covers(m, most, w, h)) return Infinity;
  let lo = 1, hi = most; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (covers(m, mid, w, h)) hi = mid; else lo = mid; } return hi;
}

/** the corrections for a video. times: each picture's time (seconds, in order); moves: each picture's motion() from the one before (the
 *  first: IDENT); w, h: the small picture's size; level: 1-5. Returns { fix: [a transform for each picture, in the small picture's pixels],
 *  zoom, cut (how many pictures got a smaller correction than the shake needed), sigma }. Output pixel = zoom x fix(picture pixel). */
export function plan(times, moves, w, h, level = 3) {
  const L = LEVELS[level] || LEVELS[3], n = times.length;
  // the camera's path: where a point of the first picture is in each picture
  const path = []; let p = IDENT; for (let i = 0; i < n; i++) { if (i) p = compose(moves[i], p); path.push(p); }
  const P = path.map(params), sig = L.sigma;
  // the path averaged over a Gaussian window of the picture times. Past the start and the end, the path goes on as the straight line that
  // best fits its first or last 2 sigma seconds, so that a steady pan stays a steady pan to the last picture and is not pulled flat there
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) || 1 / 30 : 1 / 30;
  const line = (vals, from, to) => { let st = 0, sv = 0, stt = 0, stv = 0, k = 0; for (let j = from; j <= to; j++) { st += times[j]; sv += vals[j]; stt += times[j] ** 2; stv += times[j] * vals[j]; k++; } const d = k * stt - st * st, slope = k > 1 && Math.abs(d) > 1e-12 ? (k * stv - st * sv) / d : 0; return (t) => (sv - slope * st) / k + slope * t; };
  const smooth = (vals, r = 3 * sig) => {
    let a = 0; while (a < n - 1 && times[a + 1] - times[0] <= 2 * sig) a++; let z = n - 1; while (z > 0 && times[n - 1] - times[z - 1] <= 2 * sig) z--;
    const head = line(vals, 0, a), tail = line(vals, z, n - 1);
    return vals.map((_, i) => {
      let s = 0, ws = 0; const add = (d, v) => { const g = Math.exp(-(d * d) / (2 * sig * sig)); s += g * v; ws += g; };
      for (let j = i; j >= 0 && times[i] - times[j] <= r; j--) add(times[i] - times[j], vals[j]);
      for (let j = i + 1; j < n && times[j] - times[i] <= r; j++) add(times[j] - times[i], vals[j]);
      for (let t = times[0] - dt; times[i] - t <= r; t -= dt) add(times[i] - t, head(t));
      for (let t = times[n - 1] + dt; t - times[i] <= r; t += dt) add(t - times[i], tail(t));
      return s / ws;
    });
  };
  // the turn is unwrapped first, so that a path through 180 degrees does not jump
  for (let i = 1; i < n; i++) while (P[i][0] - P[i - 1][0] > Math.PI) P[i][0] -= 2 * Math.PI; for (let i = 1; i < n; i++) while (P[i][0] - P[i - 1][0] < -Math.PI) P[i][0] += 2 * Math.PI;
  const S = [0, 1, 2, 3].map((k) => smooth(P.map((x) => x[k])));
  const full = path.map((m, i) => compose(fromParams([S[0][i], S[1][i], S[2][i], S[3][i]]), invert(m)));
  // where a correction needs more zoom than the level allows, it is made smaller (lam: 0 none, 1 all of it); lam is then the least over a
  // window and averaged, so that it changes smoothly and is never more than a picture can take
  const part = (m, lam) => fromParams(params(m).map((x) => x * lam));
  const lam = full.map((m) => { if (zoomFor(m, w, h, L.zoom) < Infinity) return 1; let lo = 0, hi = 1; for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (zoomFor(part(m, mid), w, h, L.zoom) < Infinity) lo = mid; else hi = mid; } return lo; });
  const r = Math.max(sig, 0.1), low = lam.map((_, i) => { let x = lam[i]; for (let j = i; j >= 0 && times[i] - times[j] <= r; j--) x = Math.min(x, lam[j]); for (let j = i + 1; j < n && times[j] - times[i] <= r; j++) x = Math.min(x, lam[j]); return x; });
  const gentle = low.map((_, i) => {
    let s = 0, ws = 0; const add = (j) => { const d = times[i] - times[j], k = Math.exp(-(d * d) / (2 * sig * sig)); s += k * low[j]; ws += k; };
    for (let j = i; j >= 0 && times[i] - times[j] <= r; j--) add(j); for (let j = i + 1; j < n && times[j] - times[i] <= r; j++) add(j);
    return Math.min(lam[i], s / ws);
  });
  const fix = full.map((m, i) => (gentle[i] >= 1 - 1e-9 ? m : part(m, gentle[i])));
  let zoom = 1; for (const m of fix) zoom = Math.max(zoom, Math.min(L.zoom, zoomFor(m, w, h, L.zoom + 1e-6)));
  return { fix, zoom, cut: gentle.filter((x) => x < 0.999).length, sigma: sig, path };
}

/** the correction for a time between two pictures (a picture the second play shows that the first did not): the nearer picture's */
export function fixAt(times, fix, t) {
  let lo = 0, hi = times.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
  return Math.abs(times[hi] - t) < Math.abs(times[lo] - t) ? fix[hi] : fix[lo];
}
