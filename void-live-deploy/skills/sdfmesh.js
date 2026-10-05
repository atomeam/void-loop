/**
 * sdfmesh — smooth bodies for the stage figures (figures3d.js). Not a skill: plain JS, no three.js, no network.
 * A body is a few simple shapes (spheres, ellipsoids, capsules, cones) blended with a smooth minimum, so a head flows into
 * a neck and a neck into a torso instead of balls stuck together. The blended distance field is turned into one mesh with
 * surface nets (a vertex per surface cell, a quad per crossing edge), and normals come from the field's gradient, so the
 * shading is smooth everywhere. One mesh per body shape; figures3d builds it once and reuses it for every figure.
 *
 *   field(shapes, k)            -> (x, y, z) => signed distance (negative inside)
 *   mesh(f, bounds, cell)       -> { positions: Float32Array, normals: Float32Array, indices: Uint32Array }
 *   PERSON(R), ANIMAL(R)        -> shape lists for the two living bodies, in figure units (R = body radius)
 */
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

// signed distance to each primitive
export function sdSphere(p, c, r) { return len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r; }
export function sdEllipsoid(p, c, r) { // a good, cheap bound (Quilez)
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = len3(x, y, z), k1 = len3(x / r[0], y / r[1], z / r[2]);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
}
export function sdCapsule(p, a, b, ra, rb = ra) { // a tapered capsule from a (radius ra) to b (radius rb)
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz || 1)));
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
// polynomial smooth minimum: k is how wide the blend between two shapes is
export function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

export function field(shapes, k) {
  const fns = shapes.map((s) => s.type === 'sphere' ? (p) => sdSphere(p, s.c, s.r)
    : s.type === 'ellipsoid' ? (p) => sdEllipsoid(p, s.c, s.r)
    : (p) => sdCapsule(p, s.a, s.b, s.ra, s.rb ?? s.ra));
  const ks = shapes.map((s) => s.k ?? k), p = [0, 0, 0];
  return (x, y, z) => { p[0] = x; p[1] = y; p[2] = z; let d = fns[0](p); for (let i = 1; i < fns.length; i++) d = smin(d, fns[i](p), ks[i]); return d; };
}

/** Surface nets over a grid covering bounds = { min:[x,y,z], max:[x,y,z] } with the given cell size. */
export function mesh(f, bounds, cell) {
  const nx = Math.ceil((bounds.max[0] - bounds.min[0]) / cell) + 1, ny = Math.ceil((bounds.max[1] - bounds.min[1]) / cell) + 1, nz = Math.ceil((bounds.max[2] - bounds.min[2]) / cell) + 1;
  const ox = bounds.min[0], oy = bounds.min[1], oz = bounds.min[2];
  const at = (i, j, k) => (k * ny + j) * nx + i;
  const d = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) d[at(i, j, k)] = f(ox + i * cell, oy + j * cell, oz + k * cell);
  // one vertex per cell the surface passes through: the mean of the edge crossings
  const vid = new Int32Array(nx * ny * nz).fill(-1), pos = [], nrm = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8), e = cell * 0.5;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { v[c] = d[at(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    const x = ox + (i + sx / n) * cell, y = oy + (j + sy / n) * cell, z = oz + (k + sz / n) * cell;
    vid[at(i, j, k)] = pos.length / 3; pos.push(x, y, z);
    // the field's gradient is the outward normal: smooth shading with no seams
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), gl = len3(gx, gy, gz) || 1;
    nrm.push(gx / gl, gy / gl, gz / gl);
  }
  // a quad for every grid edge the surface crosses, joining the four cells around it, wound to face outward
  const idx = [];
  const quad = (a, b, c, dd, flip) => { if (a < 0 || b < 0 || c < 0 || dd < 0) return; if (flip) idx.push(a, c, b, a, dd, c); else idx.push(a, b, c, a, c, dd); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { // x edges
    const a = d[at(i, j, k)] < 0, b = d[at(i + 1, j, k)] < 0; if (a === b) continue;
    quad(vid[at(i, j - 1, k - 1)], vid[at(i, j, k - 1)], vid[at(i, j, k)], vid[at(i, j - 1, k)], b);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // y edges
    const a = d[at(i, j, k)] < 0, b = d[at(i, j + 1, k)] < 0; if (a === b) continue;
    quad(vid[at(i - 1, j, k - 1)], vid[at(i - 1, j, k)], vid[at(i, j, k)], vid[at(i, j, k - 1)], b);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // z edges
    const a = d[at(i, j, k)] < 0, b = d[at(i, j, k + 1)] < 0; if (a === b) continue;
    quad(vid[at(i - 1, j - 1, k)], vid[at(i, j - 1, k)], vid[at(i, j, k)], vid[at(i - 1, j, k)], b);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}

// ---------- the bodies, in figure units (R = body radius; y up, z toward the viewer) ----------
// a person: head, neck, torso with shoulders and hips, two legs; the arms stay separate pieces so they can swing and wave
export function PERSON(R) {
  return [
    { type: 'ellipsoid', c: [0, -R * 0.12, 0], r: [R * 0.58, R * 0.78, R * 0.46] },                 // torso
    { type: 'capsule', a: [-R * 0.42, R * 0.38, 0], b: [R * 0.42, R * 0.38, 0], ra: R * 0.2, k: R * 0.3 }, // shoulders
    { type: 'capsule', a: [0, R * 0.45, 0], b: [0, R * 0.62, 0], ra: R * 0.16, k: R * 0.22 },           // neck
    { type: 'ellipsoid', c: [0, R * 0.98, R * 0.02], r: [R * 0.46, R * 0.5, R * 0.44], k: R * 0.18 },   // head
    { type: 'capsule', a: [-R * 0.27, -R * 0.65, 0], b: [-R * 0.3, -R * 1.32, R * 0.02], ra: R * 0.17, rb: R * 0.14, k: R * 0.22 }, // legs
    { type: 'capsule', a: [R * 0.27, -R * 0.65, 0], b: [R * 0.3, -R * 1.32, R * 0.02], ra: R * 0.17, rb: R * 0.14, k: R * 0.22 },
    { type: 'ellipsoid', c: [-R * 0.3, -R * 1.42, R * 0.1], r: [R * 0.15, R * 0.09, R * 0.22], k: R * 0.1 }, // feet
    { type: 'ellipsoid', c: [R * 0.3, -R * 1.42, R * 0.1], r: [R * 0.15, R * 0.09, R * 0.22], k: R * 0.1 },
  ];
}
// a four-legged animal facing +x: body, chest, neck into the head, snout, ears, four legs, the root of the tail
export function ANIMAL(R) {
  const legs = [[0.5, 0.28], [0.5, -0.28], [-0.55, 0.28], [-0.55, -0.28]].map(([x, z]) =>
    ({ type: 'capsule', a: [R * x, -R * 0.25, R * z], b: [R * x * 1.02, -R * 0.95, R * z], ra: R * 0.17, rb: R * 0.13, k: R * 0.2 }));
  return [
    { type: 'ellipsoid', c: [0, 0, 0], r: [R * 0.95, R * 0.55, R * 0.5] },                              // body
    { type: 'ellipsoid', c: [R * 0.45, R * 0.05, 0], r: [R * 0.5, R * 0.52, R * 0.48], k: R * 0.3 },   // chest
    { type: 'capsule', a: [R * 0.7, R * 0.2, 0], b: [R * 0.95, R * 0.5, 0], ra: R * 0.24, k: R * 0.22 }, // neck
    { type: 'ellipsoid', c: [R * 1.05, R * 0.62, 0], r: [R * 0.4, R * 0.36, R * 0.36], k: R * 0.18 },  // head
    { type: 'ellipsoid', c: [R * 1.38, R * 0.52, 0], r: [R * 0.2, R * 0.15, R * 0.17], k: R * 0.14 }, // snout
    { type: 'capsule', a: [R * 0.98, R * 0.85, R * 0.18], b: [R * 0.92, R * 1.15, R * 0.24], ra: R * 0.09, rb: R * 0.03, k: R * 0.08 }, // ears
    { type: 'capsule', a: [R * 0.98, R * 0.85, -R * 0.18], b: [R * 0.92, R * 1.15, -R * 0.24], ra: R * 0.09, rb: R * 0.03, k: R * 0.08 },
    ...legs,
    { type: 'capsule', a: [-R * 0.85, R * 0.15, 0], b: [-R * 1.15, R * 0.42, 0], ra: R * 0.12, rb: R * 0.07, k: R * 0.15 }, // tail root
  ];
}
// grid bounds that hold a shape list, with a margin for the blends
export function boundsOf(shapes, margin) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const grow = (c, r) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - r); max[i] = Math.max(max[i], c[i] + r); } };
  for (const s of shapes) {
    if (s.type === 'sphere') grow(s.c, s.r);
    else if (s.type === 'ellipsoid') grow(s.c, Math.max(...s.r));
    else { grow(s.a, s.ra); grow(s.b, s.rb ?? s.ra); }
  }
  return { min: min.map((v) => v - margin), max: max.map((v) => v + margin) };
}
/** One call: a smooth body mesh for a shape list. cells ~ the grid's longest side in cells (detail vs build time). */
export function bodyMesh(shapes, R, cells = 56) {
  const b = boundsOf(shapes, R * 0.25), span = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
  return mesh(field(shapes, R * 0.2), b, span / cells);
}
