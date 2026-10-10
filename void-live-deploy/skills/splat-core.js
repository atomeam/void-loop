/**
 * splat-core — the pure half of the splat viewer (skills/splat.js): reading a .splat file, the maths of a 3D Gaussian seen from a camera,
 * the camera itself, depth ordering, and a procedural demo scene. No DOM, no WebGL, no network, so every number here is tested in node.
 *
 * The .splat layout and the projection follow antimatter15/splat (MIT): 32 bytes per splat — position (3 × float32), scale (3 × float32),
 * colour (RGBA, 4 × uint8), rotation (a quaternion w, x, y, z as 4 × uint8, value = byte / 128 - 1). A splat is the Gaussian with
 * covariance Σ = M Mᵀ, M = R S; on screen it is the 2D Gaussian J W Σ Wᵀ Jᵀ (J: the perspective's Jacobian at the splat, W: the view's rotation).
 */
export const ROW = 32;
export const MAX_SPLATS = 150000; // more than this is thinned evenly, so a big scan opens instead of freezing the page
export const MAX_BYTES = 48 * 1024 * 1024;

const finite = (x) => Number.isFinite(x);

/**
 * Reads a .splat file. Returns { count, total, step, center: Float32Array(3n), sigma: Float32Array(6n: xx xy xz yy yz zz), color: Uint8Array(4n) }
 * or { error } saying why not. A splat with a position or scale that is not a finite number is dropped, not trusted.
 */
export function parseSplat(buffer) {
  if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) return { error: 'that is not a file I can read' };
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (bytes.length > MAX_BYTES) return { error: 'that file is larger than ' + Math.round(MAX_BYTES / 1048576) + ' MB; try a smaller or thinned-out scan' };
  if (bytes.length >= 3 && bytes[0] === 0x70 && bytes[1] === 0x6c && bytes[2] === 0x79) return { error: 'that is a .ply file; I read .splat files (the .ply a training run writes can be converted to .splat first)' };
  if (bytes.length === 0 || bytes.length % ROW !== 0) return { error: 'that does not look like a .splat file: its size is not a whole number of 32-byte splats' };
  const total = bytes.length / ROW, step = Math.max(1, Math.ceil(total / MAX_SPLATS));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.ceil(total / step);
  const center = new Float32Array(3 * n), sigma = new Float32Array(6 * n), color = new Uint8Array(4 * n);
  let k = 0;
  for (let i = 0; i < total; i += step) {
    const o = i * ROW;
    const px = view.getFloat32(o, true), py = view.getFloat32(o + 4, true), pz = view.getFloat32(o + 8, true);
    const sx = view.getFloat32(o + 12, true), sy = view.getFloat32(o + 16, true), sz = view.getFloat32(o + 20, true);
    if (![px, py, pz, sx, sy, sz].every(finite) || Math.abs(px) + Math.abs(py) + Math.abs(pz) > 1e7) continue;
    let w = bytes[o + 28] / 128 - 1, x = bytes[o + 29] / 128 - 1, y = bytes[o + 30] / 128 - 1, z = bytes[o + 31] / 128 - 1;
    const len = Math.hypot(w, x, y, z) || 1; w /= len; x /= len; y /= len; z /= len;
    const s = covariance(w, x, y, z, Math.abs(sx), Math.abs(sy), Math.abs(sz));
    center.set([px, py, pz], 3 * k); sigma.set(s, 6 * k); color.set([bytes[o + 24], bytes[o + 25], bytes[o + 26], bytes[o + 27]], 4 * k);
    k++;
  }
  return { count: k, total, step, center: center.subarray(0, 3 * k), sigma: sigma.subarray(0, 6 * k), color: color.subarray(0, 4 * k) };
}

/** Σ = (R S)(R S)ᵀ for the unit quaternion (w, x, y, z) and the scales: [xx, xy, xz, yy, yz, zz]. */
export function covariance(w, x, y, z, sx, sy, sz) {
  const r = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
  const m = [r[0] * sx, r[1] * sy, r[2] * sz, r[3] * sx, r[4] * sy, r[5] * sz, r[6] * sx, r[7] * sy, r[8] * sz]; // R with its columns scaled
  const dot = (a, b) => m[a] * m[b] + m[a + 1] * m[b + 1] + m[a + 2] * m[b + 2];
  return [dot(0, 0), dot(0, 3), dot(0, 6), dot(3, 3), dot(3, 6), dot(6, 6)];
}

// ---- the camera: column-major 4×4 matrices as WebGL wants them, looking down −z ----
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
export function lookAt(eye, target, up = [0, 1, 0]) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1];
}
/** An orbit camera: yaw and pitch (radians) around `target` at `dist`. Pitch is kept off the poles. */
export function orbitEye({ yaw, pitch, dist, target = [0, 0, 0] }) {
  const p = Math.max(-1.45, Math.min(1.45, pitch));
  return [target[0] + dist * Math.cos(p) * Math.sin(yaw), target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(p) * Math.cos(yaw)];
}
export function viewOf(cam) { return lookAt(orbitEye(cam), cam.target || [0, 0, 0]); }

/** Where a world point lands in camera space (x right, y up, z negative in front). */
export function toCamera(view, p) {
  return [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]];
}

/**
 * The splat on screen: its 2D covariance in pixels² (a, b, c = xx, xy, yy) at camera-space centre `c`, for a viewport and a focal length in
 * pixels. Null when it is behind the camera. A 0.3 px² is added to the diagonal so a splat smaller than a pixel still shows (the usual low-pass).
 * The shader (skills/splat.js) does the same sum on the GPU; this is the same maths for the 2D fallback and for the tests.
 */
export function project(sigma, view, c, fx, fy) {
  const d = -c[2]; if (!(d > 0.01)) return null;
  const j = [[fx / d, 0, (fx * c[0]) / (c[2] * c[2])], [0, fy / d, (fy * c[1]) / (c[2] * c[2])]];
  const w = [[view[0], view[4], view[8]], [view[1], view[5], view[9]], [view[2], view[6], view[10]]]; // the view's rotation, rows
  const t = j.map((row) => [0, 1, 2].map((k) => row[0] * w[0][k] + row[1] * w[1][k] + row[2] * w[2][k])); // J W (2×3)
  const S = [[sigma[0], sigma[1], sigma[2]], [sigma[1], sigma[3], sigma[4]], [sigma[2], sigma[4], sigma[5]]];
  const q = (u, v) => { let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += t[u][a] * S[a][b] * t[v][b]; return s; };
  return { a: q(0, 0) + 0.3, b: q(0, 1), c: q(1, 1) + 0.3, depth: d };
}

/** The ellipse of a 2D covariance: semi-axes (√λ1, √λ2) and the angle of the major axis. */
export function ellipse(a, b, c) {
  const mid = (a + c) / 2, rad = Math.hypot((a - c) / 2, b), l1 = mid + rad, l2 = Math.max(mid - rad, 1e-6);
  return { r1: Math.sqrt(l1), r2: Math.sqrt(l2), angle: 0.5 * Math.atan2(2 * b, a - c) };
}

/** Indices far to near for this view (alpha blending wants the far ones first). A 16-bit counting sort: O(n), fine at 150 000. */
export function depthOrder(view, center, count = center.length / 3) {
  const keys = new Float32Array(count); let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < count; i++) { const d = -(view[2] * center[3 * i] + view[6] * center[3 * i + 1] + view[10] * center[3 * i + 2] + view[14]); keys[i] = d; if (d < lo) lo = d; if (d > hi) hi = d; }
  const span = hi - lo || 1, bins = 65536, hist = new Uint32Array(bins + 1), bin = new Uint32Array(count);
  for (let i = 0; i < count; i++) { const b = Math.min(bins - 1, Math.floor(((keys[i] - lo) / span) * (bins - 1))); bin[i] = b; hist[b + 1]++; }
  for (let b = 1; b <= bins; b++) hist[b] += hist[b - 1];
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[hist[bin[i]]++] = i; // near first, by bin...
  order.reverse(); // ...so far first
  return order;
}

/** What to look at: the middle of the splats (the median of each axis, so a stray one does not drag it) and a distance that fits 98% of them. */
export function fit(center, count = center.length / 3) {
  if (!count) return { target: [0, 0, 0], dist: 4 };
  const m = [0, 1, 2].map((k) => { const v = new Float32Array(count); for (let i = 0; i < count; i++) v[i] = center[3 * i + k]; v.sort(); return v[count >> 1]; });
  const ds = new Float32Array(count); for (let i = 0; i < count; i++) ds[i] = Math.hypot(center[3 * i] - m[0], center[3 * i + 1] - m[1], center[3 * i + 2] - m[2]);
  ds.sort(); const r = ds[Math.min(count - 1, Math.floor(count * 0.98))] || 1;
  return { target: m, dist: Math.max(0.5, r * 2.4) };
}

// ---- a scene made of nothing: a small spiral galaxy, written in the .splat layout so it goes through the same parser as a real file ----
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function demoSplat(n = 6000, seed = 7) {
  const buf = new ArrayBuffer(n * ROW), dv = new DataView(buf), u8 = new Uint8Array(buf), rand = rng(seed);
  for (let i = 0; i < n; i++) {
    const arm = i % 3, t = rand(), r = 0.15 + t * 2.6, a = arm * 2.094 + r * 1.7 + (rand() - 0.5) * 0.55, y = (rand() - 0.5) * 0.18 * (1.2 - t);
    const o = i * ROW, s = 0.025 + rand() * 0.05;
    dv.setFloat32(o, Math.cos(a) * r, true); dv.setFloat32(o + 4, y, true); dv.setFloat32(o + 8, Math.sin(a) * r, true);
    dv.setFloat32(o + 12, s, true); dv.setFloat32(o + 16, s * 0.6, true); dv.setFloat32(o + 20, s, true);
    const warm = 1 - t; // the core is warm, the arms blue-white
    u8[o + 24] = Math.round(120 + 135 * warm); u8[o + 25] = Math.round(150 + 80 * warm * (1 - 0.3 * t)); u8[o + 26] = Math.round(255 - 130 * warm); u8[o + 27] = Math.round(150 + 90 * rand());
    u8[o + 28] = 255; u8[o + 29] = 128; u8[o + 30] = 128; u8[o + 31] = 128; // the identity rotation (w = 1)
  }
  return buf;
}
