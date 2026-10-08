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
/**
 * Real animals: a cat, a dog, a mouse or a rabbit with the build its species has (a cat's small round head, upright
 * pointed ears and long tail; a dog's long muzzle, deep chest and ears that stand or flop; a mouse's big round ears and
 * bare tail; a rabbit's hunched body, long ears and big hind legs), each proportion nudged by the seed so no two match,
 * and a coat drawn from the seed (tabby stripes, calico or dog patches, agouti brown). Facing +x, feet on y = -0.95R.
 * Parts: body (torso, neck, head), four legs (pivot at the hip or shoulder) and the tail (pivot at its root).
 */
export const CREATURE_KINDS = ['cat', 'dog', 'mouse', 'rabbit', 'monkey'];
const COATS = {
  cat: [['#d9893c', 'tabby'], ['#8a8a8a', 'tabby'], ['#2a2724', 'solid'], ['#f1ece4', 'solid'], ['#7a6048', 'tabby'], ['#efe7dc', 'calico']],
  dog: [['#c49a63', 'solid'], ['#2b2522', 'solid'], ['#7a4a2a', 'solid'], ['#f0ebe2', 'patches'], ['#d8b07a', 'patches'], ['#3a3330', 'tan']],
  mouse: [['#8d8378', 'solid'], ['#6e5a48', 'solid'], ['#eeeae4', 'solid'], ['#a4998c', 'solid']],
  rabbit: [['#8a6e52', 'agouti'], ['#efebe5', 'solid'], ['#8f8a86', 'agouti'], ['#4a3a2e', 'solid']],
  monkey: [['#8a6a48', 'face'], ['#6e5a44', 'face'], ['#a08868', 'face'], ['#4e3e30', 'face']],
};
export function CREATURE(R, seed, kind) {
  const rnd = mulberry32(seed), u = (a, b) => a + (b - a) * rnd(), jit = (v, k = 0.08) => v * u(1 - k, 1 + k);
  const sp = {
    cat:    { len: 0.82, leg: 0.4, tr: 0.24, head: 0.18, muz: 0.05, neck: 0.1, tail: 0.8, tailR: 0.06, legR: 0.06, ear: 'point', earL: 0.14 },
    dog:    { len: 1.0, leg: 0.6, tr: 0.25, head: 0.19, muz: u(0.14, 0.24), neck: 0.2, tail: u(0.4, 0.6), tailR: 0.055, legR: 0.075, ear: rnd() < 0.5 ? 'flop' : 'up', earL: 0.17 },
    mouse:  { len: 0.5, leg: 0.12, tr: 0.17, head: 0.12, muz: 0.11, neck: 0.04, tail: 0.85, tailR: 0.016, legR: 0.03, ear: 'round', earL: 0.1 },
    rabbit: { len: 0.62, leg: 0.22, tr: 0.27, head: 0.15, muz: 0.06, neck: 0.06, tail: 0.1, tailR: 0.075, legR: 0.06, ear: 'long', earL: 0.45 },
    monkey: { len: 0.6, leg: 0.4, tr: 0.21, head: 0.2, muz: 0.03, neck: 0.06, tail: 0.9, tailR: 0.035, legR: 0.055, ear: 'side', earL: 0.07, lift: 0.15 },
  }[kind] || null;
  if (!sp) return null;
  const len = jit(sp.len), leg = jit(sp.leg), tr = jit(sp.tr, 0.12), hr = jit(sp.head, 0.06), muz = jit(sp.muz, 0.12), legR = jit(sp.legR, 0.1);
  const ground = -0.95, ty = ground + leg + tr * 0.75, X = (v) => v * R, P = (x, y, z) => [X(x), X(y), X(z)];
  const hunch = kind === 'rabbit' ? 0.12 : 0, front = len / 2, back = -len / 2;
  const shapes = [
    { part: 'body', type: 'ellipsoid', c: P(back * 0.35, ty + hunch, 0), r: [X(len * 0.42), X(tr * (kind === 'rabbit' ? 1.05 : 0.9)), X(tr * 0.85)] },
    { part: 'body', type: 'ellipsoid', c: P(front * 0.55, ty + tr * 0.08, 0), r: [X(len * 0.32), X(tr * (kind === 'dog' ? 1.05 : 0.92)), X(tr * 0.8)], k: X(0.12) },
  ];
  const neckTop = P(front + sp.neck * 0.55, ty + tr * 0.55 + sp.neck * 0.6, 0), hc = [neckTop[0] + X(hr * 0.35), neckTop[1] + X(hr * 0.35), 0];
  shapes.push({ part: 'body', type: 'capsule', a: P(front * 0.75, ty + tr * 0.25, 0), b: neckTop, ra: X(tr * 0.55), rb: X(hr * 0.75), k: X(0.08) });
  shapes.push({ part: 'body', type: 'ellipsoid', c: hc, r: [X(hr * (kind === 'dog' ? 1.05 : 1)), X(hr * 0.92), X(hr * 0.9)], k: X(0.06) });
  const muzTip = [hc[0] + X(hr * 0.75 + muz), hc[1] - X(hr * (kind === 'mouse' ? 0.15 : 0.3)), 0];
  shapes.push({ part: 'body', type: 'capsule', a: [hc[0] + X(hr * 0.4), hc[1] - X(hr * 0.2), 0], b: muzTip, ra: X(hr * (kind === 'dog' ? 0.5 : 0.45)), rb: X(hr * (kind === 'mouse' ? 0.12 : 0.3)), k: X(0.05) });
  for (const zs of [-1, 1]) { // ears
    const base = [hc[0] - X(hr * 0.15), hc[1] + X(hr * 0.7), X(zs * hr * 0.5)];
    if (sp.ear === 'point') shapes.push({ part: 'body', type: 'capsule', a: base, b: [base[0] + X(0.01), base[1] + X(sp.earL), base[2] + X(zs * 0.03)], ra: X(hr * 0.38), rb: X(0.008), k: X(0.03) });
    else if (sp.ear === 'up') shapes.push({ part: 'body', type: 'capsule', a: base, b: [base[0] - X(0.01), base[1] + X(sp.earL), base[2] + X(zs * 0.04)], ra: X(hr * 0.32), rb: X(0.012), k: X(0.03) });
    else if (sp.ear === 'flop') shapes.push({ part: 'body', type: 'capsule', a: [base[0], base[1] - X(0.02), X(zs * hr * 0.75)], b: [base[0] + X(0.02), base[1] - X(sp.earL), X(zs * hr * 1.0)], ra: X(hr * 0.3), rb: X(hr * 0.25), k: X(0.03) });
    else if (sp.ear === 'round') shapes.push({ part: 'body', type: 'ellipsoid', c: [base[0] - X(0.02), base[1] + X(sp.earL * 0.6), base[2] + X(zs * 0.04)], r: [X(sp.earL * 0.25), X(sp.earL), X(sp.earL)], k: X(0.02) });
    else if (sp.ear === 'side') shapes.push({ part: 'body', type: 'ellipsoid', c: [hc[0] - X(hr * 0.1), hc[1] + X(hr * 0.1), X(zs * hr * 1.0)], r: [X(sp.earL * 0.6), X(sp.earL), X(sp.earL * 0.25)], k: X(0.02) });
    else shapes.push({ part: 'body', type: 'capsule', a: base, b: [base[0] - X(0.08), base[1] + X(jit(sp.earL)), base[2] + X(zs * 0.05)], ra: X(hr * 0.33), rb: X(hr * 0.22), k: X(0.03) });
  }
  // legs: the pivot at the top, the foot on the ground; a rabbit's hind legs are long and folded
  const legs = [];
  [[front * 0.7, 1, 'legFL'], [front * 0.7, -1, 'legFR'], [back * 0.65, 1, 'legBL'], [back * 0.65, -1, 'legBR']].forEach(([x, zs, part]) => {
    const hind = x < 0, top = P(x, ty - tr * 0.3, zs * tr * 0.55), foot = P(x + (hind && kind === 'rabbit' ? 0.12 : 0.02), ground + legR * 0.6, zs * tr * 0.55);
    const r0 = X(legR * (hind ? (kind === 'rabbit' ? 2.2 : 1.35) : 1.15)), knee = [(top[0] + foot[0]) / 2 + X(hind ? -0.05 : 0.01), (top[1] + foot[1]) / 2, top[2]];
    shapes.push({ part, type: 'capsule', a: top, b: knee, ra: r0, rb: X(legR * 0.9), k: X(0.05) }, { part, type: 'capsule', a: knee, b: foot, ra: X(legR * 0.85), rb: X(legR * 0.7), k: X(0.03) },
      { part, type: 'ellipsoid', c: [foot[0] + X(legR * 0.6), foot[1], foot[2]], r: [X(legR * (kind === 'rabbit' && hind ? 2.4 : 1.3)), X(legR * 0.6), X(legR * 0.9)], k: X(0.03) });
    legs.push({ part, pivot: top });
  });
  // the tail: long and curving up for a cat, out and up for a dog, bare and trailing for a mouse, a puff for a rabbit
  const root = P(back - 0.02, ty + tr * 0.35, 0), tl = jit(sp.tail, 0.1), curl = u(0.3, 0.9);
  if (kind === 'rabbit') shapes.push({ part: 'tail', type: 'sphere', c: [root[0] - X(0.03), root[1], 0], r: X(sp.tailR) });
  else {
    const mid = [root[0] - X(tl * 0.5), root[1] + X(kind === 'mouse' ? -0.12 : tl * 0.15 * curl), 0], tip = [root[0] - X(tl * (kind === 'cat' ? 0.7 : 0.95)), root[1] + X(kind === 'mouse' ? -0.18 : tl * (kind === 'cat' ? 0.6 : kind === 'monkey' ? 0.75 : 0.35) * curl), 0];
    shapes.push({ part: 'tail', type: 'capsule', a: root, b: mid, ra: X(sp.tailR * 1.2), rb: X(sp.tailR), k: X(0.03) }, { part: 'tail', type: 'capsule', a: mid, b: tip, ra: X(sp.tailR), rb: X(sp.tailR * (kind === 'mouse' ? 0.4 : 0.75)), k: X(0.02) });
  }
  // a monkey stands higher at the shoulders (its arms are longer): lift everything toward the front, feet stay down
  if (sp.lift) { const lift = (p) => { if (p[1] > X(ground + 0.08)) p[1] += X(sp.lift) * Math.max(0, Math.min(1, (p[0] / X(front) + 0.3) / 1.3)); };
    for (const sh of shapes) if (sh.part !== 'tail') for (const k of ['c', 'a', 'b']) if (sh[k]) lift(sh[k]);
    lift(hc); lift(muzTip); for (const l of legs) lift(l.pivot); }
  const coats = COATS[kind], [coat, pattern] = coats[Math.floor(rnd() * coats.length) % coats.length];
  const eyes = [-1, 1].map((zs) => [hc[0] + X(hr * 0.55), hc[1] + X(hr * 0.2), X(zs * hr * 0.55)]);
  shapes.rig = { R, seed: seed >>> 0, kind, coat, pattern, head: hc, headR: X(hr), eyes, eyeR: X(hr * (kind === 'mouse' ? 0.2 : 0.14)), nose: muzTip, legs, tailRoot: root,
    stripes: u(14, 22) / R, ph: [u(0, 6.3), u(0, 6.3), u(0, 6.3)], patch: [u(4, 7) / R, u(4, 7) / R], belly: ty - tr * 0.4, gait: { pace: u(0.85, 1.15), phase: u(0, 6.3) } };
  return shapes;
}
// the coat as vertex colours (multiplied into the coat colour): tabby stripes, calico or dog patches, agouti ticking,
// a paler belly and muzzle where the species has one
export function coatColors(rig, P) {
  const out = new Float32Array(P.length), R = rig.R, base = rig.coat;
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255], b = hex(base);
  const tint = (c) => [c[0] / Math.max(0.05, b[0]), c[1] / Math.max(0.05, b[1]), c[2] / Math.max(0.05, b[2])];
  const dark = tint(b.map((v) => v * 0.45)), orange = tint(hex('#d9893c')), black = tint(hex('#2a2724')), white = tint(hex('#f2eee8')), tan = tint(hex('#b07a45'));
  for (let v = 0; v < P.length; v += 3) {
    const x = P[v], y = P[v + 1], z = P[v + 2]; let c = [1, 1, 1];
    const n = Math.sin(x * rig.patch[0] + rig.ph[0]) * Math.sin(z * rig.patch[1] + y * rig.patch[0] * 0.7 + rig.ph[1]) + Math.sin((x - y) * rig.patch[1] * 1.3 + rig.ph[2]) * 0.5;
    if (rig.pattern === 'tabby' && Math.sin(x * rig.stripes + Math.sin(y * rig.stripes * 0.3 + rig.ph[0]) * 1.5 + rig.ph[1]) > 0.45) c = dark;
    else if (rig.pattern === 'calico') c = n > 0.45 ? orange : n < -0.55 ? black : [1, 1, 1];
    else if (rig.pattern === 'patches') c = n > 0.35 ? (rig.ph[2] > 3 ? black : tan) : [1, 1, 1];
    else if (rig.pattern === 'tan') c = y < rig.belly + R * 0.05 || x > rig.nose[0] - R * 0.12 ? tan : [1, 1, 1];
    else if (rig.pattern === 'face') c = x > rig.head[0] + rig.headR * 0.3 && Math.hypot(x - rig.head[0], y - rig.head[1], z) < rig.headR * 1.4 ? tint(hex('#e2c2aa')) : [1, 1, 1]; // a bare, paler face
    else if (rig.pattern === 'agouti') { const t = Math.sin(x * 61 / R + z * 47 / R + y * 53 / R); c = t > 0.6 ? [1.25, 1.18, 1.08] : t < -0.6 ? [0.75, 0.72, 0.7] : [1, 1, 1]; }
    if (rig.pattern !== 'solid' && rig.pattern !== 'tan' && rig.pattern !== 'face' && y < rig.belly - R * 0.02) c = c.map((q, i) => (q + white[i]) / 2); // paler belly
    out[v] = c[0]; out[v + 1] = c[1]; out[v + 2] = c[2];
  }
  return out;
}
const CCACHE = new Map();
export function creatureMesh(R, seed, kind, cells = 60) {
  const key = kind + ':' + (seed >>> 0) + ':' + R + ':' + cells;
  if (CCACHE.has(key)) return CCACHE.get(key);
  const shapes = CREATURE(R, seed >>> 0, kind); if (!shapes) return null;
  const all = boundsOf(shapes, R * 0.15), cell = Math.max(all.max[0] - all.min[0], all.max[1] - all.min[1], all.max[2] - all.min[2]) / cells, out = { rig: shapes.rig };
  for (const part of ['body', 'legFL', 'legFR', 'legBL', 'legBR', 'tail']) {
    const own = shapes.filter((s) => s.part === part); if (!own.length) continue;
    const m = mesh(field(own, R * 0.12), boundsOf(own, R * 0.08), part === 'body' ? cell : cell * 0.6);
    out[part] = { ...m, colors: coatColors(shapes.rig, m.positions) };
  }
  CCACHE.set(key, out); while (CCACHE.size > 16) CCACHE.delete(CCACHE.keys().next().value);
  return out;
}
/**
 * Real foods, as seeded fields with their own surface colour: a bone (a femur: a shaft flaring into two knobbed ends),
 * a wedge of cheese (a holed wedge with a waxed rind), a carrot (a tapering, ringed root with its green tops) and a
 * banana (a curved, five-sided fruit, green-tinged at the stem, brown at the tip, freckled when ripe). Each seed changes
 * size, curve, holes and ripeness, so no two match; a seed always rebuilds the same one. Resting on y = -0.95R.
 */
export const FOOD_KINDS = ['bone', 'cheese', 'carrot', 'banana'];
const sdBox = (p, c, h) => { const qx = Math.abs(p[0] - c[0]) - h[0], qy = Math.abs(p[1] - c[1]) - h[1], qz = Math.abs(p[2] - c[2]) - h[2]; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
export function foodField(R, seed, kind) {
  const r = mulberry32(seed), u = (a, b) => a + (b - a) * r(), g = -0.95 * R, P = [0, 0, 0];
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  if (kind === 'bone') {
    const L = R * u(0.75, 0.95), sh = R * u(0.075, 0.095), k = R * u(0.11, 0.14), y = g + k * 1.1;
    const d = (x, yy, z) => { P[0] = x; P[1] = yy; P[2] = z; let v = sdCapsule(P, [-L, y, 0], [L, y, 0], sh, sh);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) v = smin(v, sdSphere(P, [sx * L, y, sz * k * 0.62], k), R * 0.07);
      return v + R * 0.004 * Math.sin(x * 40 / R) * Math.sin(z * 37 / R); };
    const base = hex('#ece3cf');
    return { d, bounds: { min: [-L - k * 2, g - R * 0.05, -k * 2], max: [L + k * 2, y + k * 1.6, k * 2] }, color: (x, yy) => { const t = 0.92 + 0.08 * Math.sin(x * 9 / R + yy * 7 / R); return base.map((c, i) => c * t * (i === 2 ? 0.97 : 1)); } };
  }
  if (kind === 'cheese') {
    const w = R * u(0.55, 0.75), h = R * u(0.3, 0.42), depth = R * u(0.38, 0.5), y0 = g + h, slope = h / w;
    const topAt = (x) => y0 + h - (x + w) * slope * 0.9 / 0.7 * 0.7; // the sloped top's height above x
    const holes = Array.from({ length: 7 + Math.floor(r() * 6) }, (_, i) => { const x = u(-w * 0.85, w * 0.6), face = i % 3; // the two cut sides and the sloped top
      return { c: face === 2 ? [x, topAt(x), u(-depth * 0.7, depth * 0.7)] : [x, g + u(0.15, 0.85) * (topAt(x) - g), face ? depth : -depth], r: R * u(0.06, 0.12) }; });
    const d = (x, yy, z) => { P[0] = x; P[1] = yy; P[2] = z; let v = sdBox(P, [0, y0, 0], [w, h, depth]);
      const top = (yy - y0 - h) + (x + w) * slope * 0.9; v = Math.max(v, top * 0.7); // the wedge: the top slopes down to the thin edge
      for (const o of holes) v = Math.max(v, -sdSphere(P, o.c, o.r));
      return v; };
    const rind = hex('#e0a12f'), paste = hex('#f3d36b').map((c, i) => c * u(0.95, 1.03));
    return { d, bounds: { min: [-w * 1.2, g - R * 0.05, -depth * 1.2], max: [w * 1.2, y0 + h * 1.3, depth * 1.2] }, color: (x, yy, z) => (Math.abs(z) > depth * 0.93 || yy < g + R * 0.03 ? rind : paste) };
  }
  if (kind === 'carrot') {
    const L = R * u(0.8, 1.05), r0 = R * u(0.14, 0.19), bend = u(-0.12, 0.12), y = g + r0, rings = u(26, 34) / R;
    const d = (x, yy, z) => { P[0] = x; P[1] = yy; P[2] = z; let v = sdCapsule(P, [-L * 0.5, y, 0], [L * 0.5, y + bend * R, bend * R * 0.5], r0, R * 0.02);
      for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; v = smin(v, sdCapsule(P, [-L * 0.5, y, 0], [-L * 0.5 - R * 0.45 * Math.cos(a), y + R * 0.4 + R * 0.1 * Math.sin(i), R * 0.25 * Math.sin(a)], R * 0.025, R * 0.012), R * 0.03); }
      return v + R * 0.006 * Math.sin(x * rings) * (x > -L * 0.5 ? 1 : 0); };
    const orange = hex('#e66f1e'), green = hex('#4f7d2c');
    return { d, bounds: { min: [-L * 0.5 - R * 0.6, g - R * 0.05, -R * 0.4], max: [L * 0.6, y + R * 0.6, R * 0.4] }, color: (x, yy) => (x < -L * 0.5 - R * 0.03 ? green : orange.map((c) => c * (0.93 + 0.07 * Math.sin(x * rings)))) };
  }
  if (kind === 'banana') {
    const L = R * u(0.85, 1.05), r0 = R * u(0.12, 0.15), arc = u(0.3, 0.5), ripe = r(), y = g + r0;
    const pts = Array.from({ length: 7 }, (_, i) => { const t = i / 6 - 0.5; return [t * L * 2, y + (1 - 4 * t * t) * arc * R * 0.5, 0]; });
    const d = (x, yy, z) => { P[0] = x; P[1] = yy; P[2] = z; let v = Infinity;
      for (let i = 0; i < 6; i++) { const t0 = Math.abs(i / 6 - 0.5) * 2, t1 = Math.abs((i + 1) / 6 - 0.5) * 2; v = smin(v, sdCapsule(P, pts[i], pts[i + 1], r0 * (1 - t0 * t0 * 0.75), r0 * (1 - t1 * t1 * 0.75)), R * 0.04); }
      const ang = Math.atan2(z, yy - y); return v + R * 0.008 * Math.abs(Math.sin(ang * 2.5)); }; // five faint ridges
    const yellow = hex('#f2d03f'), green = hex('#a7b84a'), brown = hex('#5a3d1c');
    return { d, bounds: { min: [-L * 1.15, g - R * 0.05, -r0 * 1.4], max: [L * 1.15, y + arc * R * 0.6 + r0 * 1.4, r0 * 1.4] },
      color: (x, yy, z) => { const t = x / L; if (Math.abs(t) > 0.93) return brown; if (t < -0.7 && ripe < 0.5) return green;
        const spot = ripe > 0.6 && Math.sin(x * 47 / R + z * 31 / R) * Math.sin(yy * 53 / R) > 0.82; return spot ? brown : yellow; } };
  }
  return null;
}
const FCACHE = new Map();
export function foodMesh(R, seed, kind, cells = 64) {
  const key = kind + ':' + (seed >>> 0) + ':' + R + ':' + cells;
  if (FCACHE.has(key)) return FCACHE.get(key);
  const F = foodField(R, seed >>> 0, kind); if (!F) return null;
  const span = Math.max(...[0, 1, 2].map((i) => F.bounds.max[i] - F.bounds.min[i])), m = mesh(F.d, F.bounds, span / cells), P = m.positions, colors = new Float32Array(P.length);
  for (let v = 0; v < P.length; v += 3) { const c = F.color(P[v], P[v + 1], P[v + 2]); colors[v] = c[0]; colors[v + 1] = c[1]; colors[v + 2] = c[2]; }
  const out = { ...m, colors }; FCACHE.set(key, out); while (FCACHE.size > 16) FCACHE.delete(FCACHE.keys().next().value);
  return out;
}
/**
 * Swimmers, a bee and a flower, as seeded part lists with surface colour.
 * fish: a streamlined body (goldfish, salmon or mackerel, from the seed), dorsal and pectoral fins, a forked tail
 * (its own part, so it sweeps); shark: grey above and white below, a tall dorsal fin, a pointed snout, a tail whose top
 * lobe is longer; bee: head, thorax and a striped abdomen, with two wing parts that beat; flower: a stem with two
 * leaves, a seeded number of petals in a seeded colour round a darker centre. Facing +x; they hover or stand on y = -0.95R.
 */
export const LIFE_KINDS = ['fish', 'shark', 'bee', 'flower'];
export function lifeParts(R, seed, kind) {
  const r = mulberry32(seed), u = (a, b) => a + (b - a) * r(), X = (v) => v * R;
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  if (kind === 'fish' || kind === 'shark') {
    const shark = kind === 'shark', L = X(shark ? u(1.0, 1.2) : u(0.5, 0.65)), H = L * (shark ? 0.2 : u(0.26, 0.34)), y = X(-0.2);
    const look = shark ? ['#7c8a96', '#eef0f0'] : [['#e8822a', '#f6c26a'], ['#8c9aa3', '#e9d2cc'], ['#3d6b8a', '#dfe6ea']][Math.floor(r() * 3)];
    const back = hex(look[0]), belly = hex(look[1]);
    const body = [
      { type: 'ellipsoid', c: [0, y, 0], r: [L * 0.5, H * 0.5, H * (shark ? 0.42 : 0.3)] },
      { type: 'ellipsoid', c: [L * 0.32, y - H * 0.04, 0], r: [L * (shark ? 0.24 : 0.18), H * 0.4, H * (shark ? 0.34 : 0.27)], k: X(0.04) },
      { type: 'capsule', a: [-L * 0.3, y, 0], b: [-L * 0.55, y, 0], ra: H * 0.25, rb: H * 0.07, k: X(0.04) }, // the tail stalk
      { type: 'ellipsoid', c: [-L * 0.02, y + H * (shark ? 0.62 : 0.5), 0], r: [L * (shark ? 0.1 : 0.17), H * (shark ? 0.45 : 0.28), X(0.012)], k: X(0.03) }, // dorsal fin
      ...[-1, 1].map((zs) => ({ type: 'ellipsoid', c: [L * 0.18, y - H * 0.3, zs * H * 0.32], r: [L * (shark ? 0.12 : 0.08), X(0.01), H * (shark ? 0.45 : 0.25)], k: X(0.02) })), // pectoral fins
    ];
    const tx = -L * 0.55, tail = shark
      ? [{ type: 'capsule', a: [tx, y, 0], b: [tx - L * 0.2, y + H * 0.75, 0], ra: H * 0.12, rb: X(0.01), k: X(0.03) }, { type: 'capsule', a: [tx, y, 0], b: [tx - L * 0.12, y - H * 0.45, 0], ra: H * 0.1, rb: X(0.01), k: X(0.03) }]
      : [{ type: 'ellipsoid', c: [tx - L * 0.08, y + H * 0.22, 0], r: [L * 0.1, H * 0.3, X(0.01)], k: X(0.02) }, { type: 'ellipsoid', c: [tx - L * 0.08, y - H * 0.22, 0], r: [L * 0.1, H * 0.3, X(0.01)], k: X(0.02) }];
    const color = (x, yy) => { const t = Math.max(0, Math.min(1, (yy - (y - H * 0.4)) / (H * 0.8))); let c = mix(belly, back, t);
      if (!shark && Math.sin(x * 70 / R) * Math.sin(yy * 60 / R) > 0.7) c = c.map((v) => v * 1.12); return c; }; // scale glints
    return { parts: { body, tail }, pivots: { tail: [tx, y, 0] }, eye: [L * 0.38, y + H * 0.1, H * (shark ? 0.22 : 0.17)], eyeR: H * (shark ? 0.05 : 0.09), color, kind, swim: true };
  }
  if (kind === 'bee') {
    const s = u(0.9, 1.1), y = X(0.1), B = (v) => X(v * s);
    const body = [{ type: 'sphere', c: [B(0.17), y, 0], r: B(0.075) }, { type: 'ellipsoid', c: [B(0.05), y, 0], r: [B(0.09), B(0.085), B(0.085)], k: B(0.03) },
      { type: 'ellipsoid', c: [B(-0.13), y - B(0.02), 0], r: [B(0.14), B(0.1), B(0.1)], k: B(0.03) }, { type: 'capsule', a: [B(-0.26), y - B(0.03), 0], b: [B(-0.3), y - B(0.04), 0], ra: B(0.02), rb: B(0.003), k: B(0.01) },
      ...[-1, 1].map((zs) => ({ type: 'capsule', a: [B(0.22), y + B(0.04), zs * B(0.03)], b: [B(0.3), y + B(0.13), zs * B(0.07)], ra: B(0.008), k: B(0.01) }))]; // antennae
    const wing = (zs) => [{ type: 'ellipsoid', c: [B(0.0), y + B(0.1), zs * B(0.14)], r: [B(0.12), B(0.006), B(0.07)] }];
    const black = hex('#1d1a15'), gold = hex('#e7b32a');
    const color = (x) => (x < B(-0.02) ? (Math.sin((x - B(-0.02)) / B(0.055) * Math.PI) > 0 ? gold : black) : x < B(0.12) ? mix(gold, hex('#7a5a1a'), 0.5) : black);
    return { parts: { body, wingL: wing(1), wingR: wing(-1) }, pivots: { wingL: [0, y + B(0.08), B(0.06)], wingR: [0, y + B(0.08), -B(0.06)] }, eye: [B(0.2), y + B(0.02), B(0.05)], eyeR: B(0.025), color, kind, fly: true };
  }
  if (kind === 'flower') {
    const h = X(u(1.0, 1.35)), g = X(-0.95), top = g + h, n = 5 + Math.floor(r() * 4) * (r() < 0.3 ? 2 : 1), pr = X(u(0.24, 0.32));
    const petal = hex(['#d6304a', '#f2c230', '#f4f0ea', '#a24bd0', '#ef6fa0', '#f08a2a'][Math.floor(r() * 6)]), centre = hex(r() < 0.5 ? '#3a2412' : '#e6b81e'), green = hex('#3f7a2e');
    const head = [X(u(-0.05, 0.05)), top, X(0.04)], lean = u(-0.1, 0.1);
    const body = [{ type: 'capsule', a: [0, g, 0], b: head, ra: X(0.03), rb: X(0.022) },
      ...[-1, 1].map((zs) => ({ type: 'capsule', a: [0, g + h * (0.3 + zs * 0.05), 0], b: [zs * X(0.22), g + h * (0.42 + zs * 0.05), X(0.03)], ra: X(0.05), rb: X(0.012), k: X(0.03) })), // leaves
      { type: 'ellipsoid', c: [head[0], head[1], head[2] + X(0.03)], r: [X(0.085), X(0.085), X(0.045)], k: X(0.02) }];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + lean, tip = [head[0] + Math.cos(a) * pr, head[1] + Math.sin(a) * pr, head[2] + X(0.02)];
      body.push({ type: 'capsule', a: [head[0] + Math.cos(a) * pr * 0.25, head[1] + Math.sin(a) * pr * 0.25, head[2]], b: tip, ra: pr * 0.26, rb: pr * 0.14, k: X(0.02) }); } // petals open toward the viewer
    const color = (x, yy, z) => (yy < top - pr * 1.05 ? green : Math.hypot(x - head[0], yy - head[1]) < X(0.09) && z > head[2] ? centre : Math.hypot(x - head[0], yy - head[1]) < pr * 1.1 ? petal : green);
    return { parts: { body }, pivots: {}, color, kind, stand: true };
  }
  return null;
}
const LCACHE = new Map();
export function lifeMesh(R, seed, kind, cells = 64) {
  const key = kind + ':' + (seed >>> 0) + ':' + R + ':' + cells;
  if (LCACHE.has(key)) return LCACHE.get(key);
  const L = lifeParts(R, seed >>> 0, kind); if (!L) return null;
  const all = Object.values(L.parts).flat(), b = boundsOf(all, R * 0.08), cell = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / cells, out = { info: L };
  for (const [part, shapes] of Object.entries(L.parts)) {
    const m = mesh(field(shapes, R * 0.05), boundsOf(shapes, R * 0.05), part === 'body' ? cell : cell * 0.5), P = m.positions, colors = new Float32Array(P.length);
    for (let v = 0; v < P.length; v += 3) { const c = L.color(P[v], P[v + 1], P[v + 2]); colors[v] = c[0]; colors[v + 1] = c[1]; colors[v + 2] = c[2]; }
    out[part] = { ...m, colors };
  }
  LCACHE.set(key, out); while (LCACHE.size > 16) LCACHE.delete(LCACHE.keys().next().value);
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
