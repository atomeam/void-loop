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
 *   ZOMBIE(R, seed), zombieMesh -> a seeded zombie: every proportion, wound and torn hem from mulberry32(seed); meshes cached by seed
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

const sdOf = (s) => s.type === 'sphere' ? (p) => sdSphere(p, s.c, s.r)
  : s.type === 'ellipsoid' ? (p) => sdEllipsoid(p, s.c, s.r)
  : (p) => sdCapsule(p, s.a, s.b, s.ra, s.rb ?? s.ra);
// Shapes marked cut:true are carved out after every other shape is blended (a bite, a missing ear). A list may carry
// .lumps = { amp, f:[fx,fy,fz], ph:[a,b,c] }: low-frequency waves added to the distance, so skin reads lumpy, not polished.
export function field(shapes, k) {
  const adds = shapes.filter((s) => !s.cut), cuts = shapes.filter((s) => s.cut);
  const fns = adds.map(sdOf), ks = adds.map((s) => s.k ?? k), cfs = cuts.map(sdOf), cks = cuts.map((s) => s.k ?? k * 0.4), p = [0, 0, 0];
  const L = shapes.lumps;
  return (x, y, z) => {
    p[0] = x; p[1] = y; p[2] = z; let d = fns[0](p);
    for (let i = 1; i < fns.length; i++) d = smin(d, fns[i](p), ks[i]);
    for (let i = 0; i < cfs.length; i++) d = -smin(-d, cfs[i](p), cks[i]); // smooth subtraction
    if (L) d += L.amp * (Math.sin(x * L.f[0] + L.ph[0]) * Math.sin(y * L.f[1] + L.ph[1]) + Math.sin(z * L.f[2] + L.ph[2] + x * L.f[1] * 0.5) * 0.6);
    return d;
  };
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
/** A small seeded PRNG (mulberry32): the same seed always gives the same stream, so a zombie can be cloned exactly. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// desaturated skins (grey-green, ashen, jaundiced, blue-grey) and worn, dull clothes: realistic, never candy colours
const SKINS = [0x8b9579, 0x98a0a0, 0xa29d7e, 0x7f8f74, 0x9c958d, 0x878f86, 0xa8a291, 0x7b8780];
const SHIRTS = [0xaaa494, 0x45536b, 0x6e3b35, 0x575a3d, 0x626262, 0x7f6c3a, 0x4a706b, 0x56465a, 0x8d8272];
const PANTS = [0x2f3a4e, 0x47392b, 0x2a2a2d, 0x645c48, 0x394536, 0x4a4552];
/**
 * A zombie: an adult person-like shape list (head about 1/7 of the height) where every proportion is drawn from
 * mulberry32(seed), so no two seeds share a silhouette and one seed always rebuilds the same body. Height, build, hunch
 * and side lean, head tilt, a higher shoulder, arms reaching or one hanging, a bent dragged leg, a slack jaw, sunken
 * cheeks and eye sockets, a bite, a lost ear and torn clothes all vary. Shapes carry part: 'body' | 'head' | 'armL' |
 * 'armR' so the head can loll and the arms sway (zombieMesh meshes each part on its own); cuts carve every part.
 * The list also carries .lumps (lumpy skin) and .rig (pivots, eyes, gait, clothes) for the 3D layer.
 */
export function ZOMBIE(R, seed) {
  const rnd = mulberry32(seed), u = (a, b) => a + (b - a) * rnd(), side = () => (rnd() < 0.5 ? -1 : 1), pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  // every draw happens here, in a fixed order, so a seed always means the same zombie
  const hunch = u(0.08, 0.5), lean = u(-0.12, 0.12), height = u(0.88, 1.08), build = u(0.84, 1.16), gaunt = u(0.68, 1), belly = rnd() < 0.3 ? u(0.06, 0.16) : 0;
  const shY = u(0.04, 0.14), shSide = side(), headR = u(0.17, 0.195), headLong = u(1.12, 1.26), tilt = side() * u(0.12, 0.42), jaw = u(0.08, 0.2);
  const armLen = u(0.92, 1.1), armT = u(0.055, 0.075), legT = u(0.085, 0.11);
  const hang = rnd() < 0.4 ? side() : 0, pitch = [u(-0.15, 0.45), u(-0.15, 0.45)], spread = [u(-0.12, 0.22), u(-0.12, 0.22)], droop = [u(0.2, 0.7), u(0.2, 0.7)];
  const drag = side(), dragK = u(0.45, 1), biteSide = side(), biteR = u(0.09, 0.14), earGone = rnd() < 0.6 ? side() : 0, chunk = rnd() < 0.55;
  const lumps = { amp: R * u(0.012, 0.024), f: [u(3, 5) / R, u(3, 5) / R, u(3, 5) / R], ph: [u(0, 6.3), u(0, 6.3), u(0, 6.3)] };
  const eyeKind = Math.floor(rnd() * 3), skin = pick(SKINS), shirt = pick(SHIRTS), pants = pick(PANTS);
  const shirtBottom = u(-0.05, 0.38), waist = u(0.22, 0.34), sleeve = [rnd() < 0.3 ? 0 : u(0.25, 1), rnd() < 0.3 ? 0 : u(0.25, 1)], cuff = [u(-1.32, -0.75), u(-1.32, -0.75)];
  const holes = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ x: u(-0.3, 0.3), y: u(0.15, 0.8), z: rnd() < 0.7 ? 0.25 : -0.25, r: u(0.05, 0.11) }));
  const rag = [u(7, 13), u(0, 6.3), u(0.04, 0.08)], gait = { limp: u(0.35, 1), pace: u(0.7, 1.05), loll: u(0.08, 0.2), sway: u(0.04, 0.1), phase: u(0, 6.3) };
  const turn = side() * u(0.2, 0.45), mottle = { f: [u(5, 9) / R, u(5, 9) / R, u(5, 9) / R], ph: [u(0, 6.3), u(0, 6.3), u(0, 6.3)], hue: Math.floor(rnd() * 3), stain: u(0.3, 0.7) };
  // ---- the skeleton, in figure units (y up, z toward the viewer); taller or shorter, the feet stay on PERSON's ground
  const Y = (y) => ((y + 1.5) * height - 1.5) * R, V = (x, y, z) => [x * R * build, Y(y), z * R], gw = 0.85 + 0.15 * gaunt;
  const add = (x, y, w) => [x[0] + y * w[0], x[1] + y * w[1], x[2] + y * w[2]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const pelvis = V(lean * 0.3, 0.12, 0), chest = V(lean, 0.62, hunch * 0.28);
  const shL = V(-0.42 + lean, 0.93 + (shSide < 0 ? shY : 0), hunch * 0.36), shR = V(0.42 + lean, 0.93 + (shSide > 0 ? shY : 0), hunch * 0.36);
  const neck = V(lean * 1.2, 0.98, hunch * 0.42), h0 = V(lean * 1.3, 1.1 - hunch * 0.2, hunch * 0.78 + 0.02);
  const st = Math.sin(tilt), ct = Math.cos(tilt), hr = headR * R;
  const hc = [h0[0] + st * hr * 1.0, h0[1] + ct * hr * 1.0, h0[2] + 0.03 * R];
  const hp = (ox, oy, oz) => [hc[0] + (ox * ct + oy * st) * hr, hc[1] + (-ox * st + oy * ct) * hr, hc[2] + oz * hr]; // head-local, tilted
  const shapes = [
    { part: 'body', type: 'ellipsoid', c: pelvis, r: [R * 0.34 * gw * build, R * 0.22, R * 0.22] },
    { part: 'body', type: 'ellipsoid', c: chest, r: [R * (0.3 * gaunt + 0.08) * build, R * 0.34 * height, R * (0.19 * gaunt + 0.06)], k: R * 0.22 },
    { part: 'body', type: 'capsule', a: pelvis, b: chest, ra: R * 0.24 * gw, rb: R * (0.18 * gaunt + 0.06), k: R * 0.2 },
    { part: 'body', type: 'capsule', a: shL, b: shR, ra: R * 0.1, k: R * 0.2 },
    { part: 'body', type: 'capsule', a: neck, b: h0, ra: R * 0.075, rb: R * 0.065, k: R * 0.12 },
  ];
  if (belly) shapes.push({ part: 'body', type: 'ellipsoid', c: V(lean * 0.5, 0.3, 0.1 + belly), r: [R * 0.28 * build, R * 0.24, R * (0.18 + belly)], k: R * 0.2 });
  // the head: long, a heavy brow, hard cheekbones over hollow cheeks, a slack jaw, a nose; one ear may be gone
  shapes.push(
    { part: 'head', type: 'capsule', a: neck, b: h0, ra: R * 0.065, k: R * 0.08 },
    { part: 'head', type: 'ellipsoid', c: hc, r: [hr * 0.86, hr * headLong, hr * 0.96], k: R * 0.08 },
    { part: 'head', type: 'ellipsoid', c: hp(0, 0.3, 0.72), r: [hr * 0.84, hr * 0.18, hr * 0.3], k: R * 0.05 },
    { part: 'head', type: 'ellipsoid', c: hp(0, -0.72 - jaw * 1.6, 0.34), r: [hr * 0.6, hr * 0.32, hr * 0.5], k: R * 0.07 },
    { part: 'head', type: 'ellipsoid', c: hp(0, -0.08, 0.96), r: [hr * 0.15, hr * 0.3, hr * 0.2], k: R * 0.03 },
  );
  for (const s of [-1, 1]) shapes.push({ part: 'head', type: 'ellipsoid', c: hp(s * 0.56, -0.08, 0.6), r: [hr * 0.22, hr * 0.15, hr * 0.22], k: R * 0.03 }); // cheekbones
  for (const s of [-1, 1]) if (s !== earGone) shapes.push({ part: 'head', type: 'ellipsoid', c: hp(s * 0.88, 0, -0.05), r: [hr * 0.14, hr * 0.32, hr * 0.22], k: R * 0.03 });
  // the arms: reaching forward (pitched down a little, the hand drooping at the wrist), or one hanging at the side
  const hands = [], elbows = [];
  [[-1, shL], [1, shR]].forEach(([s, S], i) => {
    const part = s < 0 ? 'armL' : 'armR', L = armLen * R * height, hangs = hang === s;
    const dir = hangs ? norm([s * 0.1, -1, 0.1]) : norm([s * spread[i], -Math.sin(pitch[i]), Math.cos(pitch[i])]);
    const dir2 = hangs ? norm([0, -1, 0.35]) : norm([dir[0], dir[1] - droop[i] * 0.5, dir[2]]);
    const el = add(S, 0.58 * L, dir), wr = add(el, 0.5 * L, dir2), dh = hangs ? dir2 : norm([dir2[0], dir2[1] - droop[i], dir2[2]]);
    const hand = add(wr, 0.07 * R, dh), tip = add(hand, 0.12 * R, norm([dh[0], dh[1] - 0.5, dh[2]]));
    shapes.push(
      { part, type: 'sphere', c: S, r: R * 0.1, k: R * 0.06 },
      { part, type: 'capsule', a: S, b: el, ra: R * armT * 1.25, rb: R * armT * 0.95, k: R * 0.05 },
      { part, type: 'capsule', a: el, b: wr, ra: R * armT, rb: R * armT * 0.72, k: R * 0.04 },
      { part, type: 'ellipsoid', c: hand, r: [R * 0.07, R * 0.04, R * 0.08], k: R * 0.04 },
      { part, type: 'capsule', a: hand, b: tip, ra: R * 0.035, rb: R * 0.02, k: R * 0.03 }, // curled fingers
    );
    hands.push(hand); elbows.push(el);
  });
  // the legs: one straight, one bent at the knee with the foot dragging behind, toe down and turned in
  for (const s of [-1, 1]) {
    const hip = V(s * 0.18, 0.05, 0), dr = s === drag;
    const knee = dr ? V(s * (0.22 + 0.04 * dragK), -0.7, 0.12 * dragK) : V(s * 0.2, -0.72, 0.03);
    const ankle = dr ? V(s * 0.2, -1.36 + 0.05 * dragK, -0.32 * dragK) : V(s * 0.22, -1.38, 0);
    const toe = dr ? add(ankle, R, [-s * 0.06, -0.1, 0.1]) : add(ankle, R, [0, -0.08, 0.2]);
    shapes.push(
      { part: 'body', type: 'capsule', a: hip, b: knee, ra: R * legT * 1.4, rb: R * legT, k: R * 0.14 },
      { part: 'body', type: 'capsule', a: knee, b: ankle, ra: R * legT, rb: R * legT * 0.65, k: R * 0.05 },
      { part: 'body', type: 'capsule', a: ankle, b: toe, ra: R * 0.07, rb: R * 0.06, k: R * 0.05 },
    );
  }
  // what is missing: a bite out of one shoulder, maybe a chunk from the side, the lost ear; then the sunken eye
  // sockets, the hollow cheeks and the open mouth
  const S = biteSide < 0 ? shL : shR;
  const wounds = [{ c: [S[0] - biteSide * 0.03 * R, S[1] + 0.09 * R, S[2] + 0.07 * R], r: biteR * R }];
  if (chunk) wounds.push({ c: V(-biteSide * 0.33 + lean, 0.45, 0.13 + hunch * 0.2), r: R * 0.09 });
  if (earGone) wounds.push({ c: hp(earGone * 0.92, 0, -0.05), r: hr * 0.3 });
  for (const w of wounds) shapes.push({ cut: true, type: 'sphere', c: w.c, r: w.r, k: R * 0.03 });
  const eyes = [-1, 1].map((s) => hp(s * 0.36, 0.1, 0.88)), sockets = eyes.map((c) => ({ c, r: hr * 0.27 }));
  const mouth = hp(0, -0.55 - jaw * 1.1, 0.88), mouthR = [hr * 0.34, hr * (0.06 + jaw * 0.7), hr * 0.3];
  for (const w of sockets) shapes.push({ cut: true, type: 'sphere', c: w.c, r: w.r, k: R * 0.02 });
  for (const s of [-1, 1]) shapes.push({ cut: true, type: 'sphere', c: hp(s * 0.66, -0.42, 0.62), r: hr * 0.24, k: R * 0.03 }); // sunken cheeks
  shapes.push({ cut: true, type: 'ellipsoid', c: mouth, r: mouthR, k: R * 0.02 });
  shapes.lumps = lumps;
  shapes.rig = { R, seed: seed >>> 0, hunch, tilt, height, build, neck: h0, head: hc, headR: hr, eyes, eyeKind, shoulders: [shL, shR], elbows, hands,
    armLen: armLen * R * height * 1.08, hang, drag, turn, gait, skin, shirt, pants, mottle, rag,
    neckline: Math.min(shL[1], shR[1]) + 0.03 * R, shirtBottom: Y(shirtBottom), waist: Y(waist), sleeve, cuff: cuff.map(Y),
    holes: holes.map((h) => ({ c: V(h.x + lean, h.y, h.z + hunch * 0.2), r: h.r * R })),
    wounds: wounds.map((w) => ({ c: w.c, r: w.r * 1.15 })).concat(sockets.map((w) => ({ c: w.c, r: w.r * 0.95 })), [{ c: mouth, r: Math.max(...mouthR) * 1.05 }]) };
  return shapes;
}
// Meshing costs time (tens of ms), so each seed's meshes are kept; a dozen covers a full stage (6) plus clones.
const ZCACHE = new Map();
/** The four part meshes of one zombie (body, head, armL, armR) on one shared grid, plus its rig. Cached by seed. */
export function zombieMesh(R, seed, cells = 52) {
  const key = (seed >>> 0) + ':' + R + ':' + cells;
  if (ZCACHE.has(key)) { const m = ZCACHE.get(key); ZCACHE.delete(key); ZCACHE.set(key, m); return m; }
  const shapes = ZOMBIE(R, seed >>> 0), all = boundsOf(shapes, R * 0.25);
  const cell = Math.max(all.max[0] - all.min[0], all.max[1] - all.min[1], all.max[2] - all.min[2]) / cells, out = { rig: shapes.rig };
  for (const part of ['body', 'head', 'armL', 'armR']) {
    const own = shapes.filter((s) => s.part === part), sub = own.concat(shapes.filter((s) => s.cut)); sub.lumps = shapes.lumps;
    // the head and the thin arms are small next to the body: a finer grid there keeps the face (brow, sockets, jaw) and the hands readable
    out[part] = mesh(field(sub, R * 0.2), boundsOf(own, R * 0.12), part === 'head' ? cell * 0.45 : part === 'body' ? cell : cell * 0.6);
  }
  ZCACHE.set(key, out); while (ZCACHE.size > 12) ZCACHE.delete(ZCACHE.keys().next().value);
  return out;
}
/**
 * Which material each triangle of a zombie part gets: 0 skin, 1 shirt, 2 trousers, 3 raw (bites, sockets, the mouth),
 * as indices regrouped by material plus groups [{ start, count, mat }] for a three.js multi-material mesh; and a colour
 * per vertex (multiplied into each material): mottled blotches on the skin, stains and grime rising from the feet.
 * Hems are ragged (a fast wave around the body for fraying, a slow one for the tear) and the shirt has holes.
 */
export function zombieGroups(rig, part, m) {
  const P = m.positions, I = m.indices, buckets = [[], [], [], []], [rk, rp, ra] = rig.rag, R = rig.R, M = rig.mottle;
  const near = (x, y, z, list, f) => list.some((w) => Math.hypot(x - w.c[0], y - w.c[1], z - w.c[2]) < w.r * f);
  for (let t = 0; t < I.length; t += 3) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 3; j++) { const v = I[t + j] * 3; x += P[v]; y += P[v + 1]; z += P[v + 2]; }
    x /= 3; y /= 3; z /= 3;
    const a = Math.atan2(z, x), wave = (Math.sin(a * rk + rp) * ra + Math.sin(a * 3 + rp * 2) * ra * 0.8 + Math.sin(a * 31 + y) * 0.015) * R;
    let mat = 0;
    if (near(x, y, z, rig.wounds, 1)) mat = 3;
    else if (part === 'body') {
      if (y < rig.neckline + wave * 0.5 && y > rig.shirtBottom + wave && !near(x, y, z, rig.holes, 1)) mat = 1;
      else if (y < rig.waist + wave * 0.3 && y > rig.cuff[x < 0 ? 0 : 1] + wave) mat = 2;
    } else if (part === 'armL' || part === 'armR') {
      const i = part === 'armL' ? 0 : 1, s = rig.shoulders[i];
      if (rig.sleeve[i] > 0 && Math.hypot(x - s[0], y - s[1], z - s[2]) < rig.sleeve[i] * rig.armLen + wave) mat = 1;
    }
    buckets[mat].push(I[t], I[t + 1], I[t + 2]);
  }
  const indices = new Uint32Array(I.length), groups = []; let at = 0;
  buckets.forEach((b, mat) => { if (b.length) { indices.set(b, at); groups.push({ start: at, count: b.length, mat }); at += b.length; } });
  // per-vertex tint: blotches (bruise purple, bile green or grey) and grime that thickens toward the ground
  const tint = [[0.86, 0.72, 0.84], [0.8, 0.86, 0.62], [0.7, 0.7, 0.72]][M.hue], colors = new Float32Array(P.length);
  for (let v = 0; v < P.length; v += 3) {
    const x = P[v], y = P[v + 1], z = P[v + 2];
    const n = Math.sin(x * M.f[0] + M.ph[0]) * Math.sin(y * M.f[1] + M.ph[1]) * Math.sin(z * M.f[2] + M.ph[2]) + Math.sin((x + y) * M.f[2] * 1.7 + M.ph[1]) * 0.4;
    const blot = Math.max(0, n) * 0.9, dirt = Math.max(0, Math.min(1, (-y / R - 0.4) / 1.1)) * M.stain;
    for (let c = 0; c < 3; c++) colors[v + c] = (1 - blot * (1 - tint[c])) * (1 - dirt * [0.35, 0.45, 0.55][c]);
  }
  return { indices, groups, colors };
}
/**
 * A brain: two hemispheres with a deep fissure between them, a ridged cerebellum underneath at the back and the brainstem,
 * the cortex folded into meandering gyri. The folds are grooves along the zero set of a seeded, domain-warped wave sum,
 * so every seed folds differently and one seed always folds the same. Returns { positions, normals, indices, colors }:
 * the colours darken the grooves (sulci), as real tissue reads. Cached by seed.
 */
const BCACHE = new Map();
export function brainField(R, seed) {
  const r = mulberry32(seed), u = (a, b) => a + (b - a) * r();
  const ph = [u(0, 6.3), u(0, 6.3), u(0, 6.3), u(0, 6.3)], f = u(15, 18) / R, warp = u(1.4, 1.9), amp = R * u(0.04, 0.05);
  const wide = u(0.95, 1.06), long = u(0.96, 1.05), tall = u(0.94, 1.04);
  const hemi = (x, y, z, s) => sdEllipsoid([x, y, z], [s * R * 0.25 * wide, R * 0.06, R * 0.02], [R * 0.3 * wide, R * 0.4 * tall, R * 0.62 * long]);
  const cereb = (x, y, z) => sdEllipsoid([x, y, z], [0, -R * 0.26, -R * 0.4 * long], [R * 0.4 * wide, R * 0.17, R * 0.22]);
  const stem = (x, y, z) => sdCapsule([x, y, z], [0, -R * 0.2, -R * 0.22], [0, -R * 0.62, -R * 0.3], R * 0.1, R * 0.075);
  const fold = (x, y, z) => { // 0 on a ridge, up to 1 in a groove
    const n = Math.sin(f * x + warp * Math.sin(f * 0.8 * y + ph[0])) + Math.sin(f * y + warp * Math.sin(f * 0.8 * z + ph[1])) + Math.sin(f * z + warp * Math.sin(f * 0.8 * x + ph[2]));
    return Math.max(0, 1 - Math.abs(n) / 0.42);
  };
  const ridges = (y, z) => Math.max(0, 1 - Math.abs(Math.sin((y + z * 0.4) * f * 1.6 + ph[3])) / 0.5); // the cerebellum's fine parallel folds
  const d = (x, y, z) => {
    let c = smin(hemi(x, y, z, -1), hemi(x, y, z, 1), R * 0.05);
    if (y > -R * 0.12) c = Math.max(c, -(Math.abs(x) - R * 0.018)); // the longitudinal fissure splits the top
    c += amp * fold(x, y, z);
    let cb = cereb(x, y, z) + amp * 0.5 * ridges(y, z);
    return smin(smin(c, cb, R * 0.04), stem(x, y, z), R * 0.06);
  };
  return { d, fold, bounds: { min: [-R * 0.75, -R * 0.75, -R * 0.8], max: [R * 0.75, R * 0.55, R * 0.8] } };
}
export function brainMesh(R, seed, cells = 72) {
  const key = (seed >>> 0) + ':' + R + ':' + cells;
  if (BCACHE.has(key)) return BCACHE.get(key);
  const B = brainField(R, seed >>> 0), span = Math.max(...[0, 1, 2].map((i) => B.bounds.max[i] - B.bounds.min[i]));
  const m = mesh(B.d, B.bounds, span / cells), P = m.positions, colors = new Float32Array(P.length);
  for (let v = 0; v < P.length; v += 3) { const g = B.fold(P[v], P[v + 1], P[v + 2]); colors[v] = 1 - g * 0.42; colors[v + 1] = 1 - g * 0.5; colors[v + 2] = 1 - g * 0.46; }
  const out = { ...m, colors }; BCACHE.set(key, out); while (BCACHE.size > 8) BCACHE.delete(BCACHE.keys().next().value);
  return out;
}
// grid bounds that hold a shape list, with a margin for the blends (a carved shape only takes away, so it never grows them)
export function boundsOf(shapes, margin) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const grow = (c, r) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - r); max[i] = Math.max(max[i], c[i] + r); } };
  for (const s of shapes) {
    if (s.cut) continue;
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
