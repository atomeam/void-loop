/**
 * forge rules — frontier #14, first piece: "make me a <thing>" for things no figure covers yet (figure.js already makes chairs, cups, mugs, books and lamps), as a model you can spin
 * and a "print it" STL sized for a home printer. Pure: no DOM, no three.js, no network. Each thing is a recipe of simple
 * shapes in millimetres (y up), blended by skills/sdfmesh.js into one smooth closed surface; a huge cut sphere under y=0
 * flattens the base so it sits on the bed. The mesh and the STL come from the same recipe, so what you spin is what prints.
 *   thingOf(name)          -> the recipe key for a name or synonym, or null
 *   build(key)             -> { key, label, positions, normals, indices, size:[x,y,z] mm }   (cached per key)
 *   stl(model)             -> ArrayBuffer, binary STL, Z up, millimetres
 */
import { field, mesh } from './sdfmesh.js';

export const BED_MM = 180; // fits a 180 mm cube: inside the common 220 x 220 and 256 x 256 home beds
const FLOOR = { type: 'sphere', c: [0, -2000, 0], r: 2000, cut: true, k: 0.01 }; // flattens everything below y = 0
const cyl = (y0, y1, r, rb) => ({ type: 'capsule', a: [0, y0, 0], b: [0, y1, 0], ra: r, rb: rb ?? r });
const leg = (x, z, h, r) => ({ type: 'capsule', a: [x, 0, z], b: [x, h, z], ra: r, k: 2 });

// every recipe: shapes (mm), blend k, a label, the names that summon it, and the grid cell for meshing
export const THINGS = {
  bottle: { label: 'Bottle', names: ['bottle', 'glass bottle', 'water bottle', 'wine bottle'], k: 10, cell: 1.6, shapes: [
    cyl(-30, 96, 32), cyl(100, 150, 11), { type: 'ellipsoid', c: [0, 152, 0], r: [14, 4, 14] },
    { type: 'capsule', a: [0, 12, 0], b: [0, 220, 0], ra: 7, cut: true, k: 1 }, { type: 'capsule', a: [0, 12, 0], b: [0, 92, 0], ra: 27, cut: true, k: 1 },
    FLOOR] },
  vase: { label: 'Vase', names: ['vase', 'glass vase', 'clay vase'], k: 14, cell: 1.8, shapes: [
    { type: 'ellipsoid', c: [0, 48, 0], r: [42, 46, 42] }, cyl(80, 132, 16, 20), { type: 'ellipsoid', c: [0, 134, 0], r: [26, 6, 26] }, cyl(-10, 20, 30),
    { type: 'capsule', a: [0, 18, 0], b: [0, 200, 0], ra: 12, cut: true, k: 1 },
    FLOOR] },
  rocket: { label: 'Rocket', names: ['rocket', 'space rocket', 'rocket ship', 'spaceship'], k: 4, cell: 1.5, shapes: [
    cyl(26, 120, 17, 15), cyl(118, 150, 15, 2), cyl(8, 30, 12, 15),
    ...[0, 120, 240].map((d) => { const a = d * Math.PI / 180, cx = Math.cos(a), cz = Math.sin(a); return { type: 'capsule', a: [cx * 16, 50, cz * 16], b: [cx * 34, 6, cz * 34], ra: 4, rb: 3, k: 3 }; }),
    FLOOR] },
  table: { label: 'Table', names: ['table', 'dining table', 'kitchen table', 'desk'], k: 3, cell: 1.6, shapes: [
    { type: 'ellipsoid', c: [0, 64, 0], r: [72, 5, 46] },
    leg(-54, -30, 64, 4), leg(54, -30, 64, 4), leg(-54, 30, 64, 4), leg(54, 30, 64, 4),
    FLOOR] },
  snowman: { label: 'Snowman', names: ['snowman', 'snow man', 'snowmen'], k: 8, cell: 1.5, shapes: [
    { type: 'sphere', c: [0, 34, 0], r: 38 }, { type: 'sphere', c: [0, 92, 0], r: 27 }, { type: 'sphere', c: [0, 135, 0], r: 19 },
    { type: 'capsule', a: [0, 136, 16], b: [0, 134, 34], ra: 4, rb: 1, k: 2 },
    { type: 'capsule', a: [-12, 143, 15], b: [-11, 143, 17], ra: 2.6, k: 1 }, { type: 'capsule', a: [12, 143, 15], b: [11, 143, 17], ra: 2.6, k: 1 },
    { type: 'capsule', a: [-24, 100, 0], b: [-52, 122, 0], ra: 2.6, k: 3 }, { type: 'capsule', a: [24, 100, 0], b: [52, 122, 0], ra: 2.6, k: 3 },
    FLOOR] },
  teapot: { label: 'Teapot', names: ['teapot', 'tea pot', 'kettle'], k: 6, cell: 1.6, shapes: [
    { type: 'ellipsoid', c: [0, 50, 0], r: [52, 42, 52] }, cyl(-6, 16, 34), { type: 'ellipsoid', c: [0, 90, 0], r: [30, 8, 30] }, { type: 'sphere', c: [0, 103, 0], r: 7 },
    { type: 'capsule', a: [40, 38, 0], b: [80, 82, 0], ra: 10, rb: 5, k: 6 },
    { type: 'capsule', a: [-42, 76, 0], b: [-70, 70, 0], ra: 6, k: 4 }, { type: 'capsule', a: [-70, 70, 0], b: [-68, 38, 0], ra: 6, k: 4 }, { type: 'capsule', a: [-68, 38, 0], b: [-44, 28, 0], ra: 6, k: 4 },
    FLOOR] },
  house: { label: 'House', names: ['house', 'little house', 'cottage', 'home model'], k: 1.5, cell: 1.2, shapes: [
    { type: 'box', c: [0, 30, 0], r: [48, 30, 36] },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ type: 'box', c: [0, 63 + i * 5, 0], r: [52 - i * 1.2, 2.6, 40 - i * 5], k: 2.5 })),
    { type: 'box', c: [26, 92, -14], r: [6, 18, 6] },
    { type: 'box', c: [0, 18, 36], r: [8, 16, 4], cut: true, k: 0.6 },
    { type: 'box', c: [-28, 38, 36], r: [8, 8, 3], cut: true, k: 0.6 }, { type: 'box', c: [28, 38, 36], r: [8, 8, 3], cut: true, k: 0.6 },
    FLOOR] },
  boat: { label: 'Sailboat', names: ['boat', 'sailboat', 'sail boat', 'sailing boat', 'yacht'], k: 3, cell: 1.3, shapes: [
    { type: 'ellipsoid', c: [0, 26, 0], r: [72, 26, 24] },
    { type: 'box', c: [0, 80, 0], r: [100, 34, 40], cut: true, k: 1 }, { type: 'ellipsoid', c: [0, 30, 0], r: [64, 20, 18], cut: true, k: 1 },
    { type: 'box', c: [0, 10, 0], r: [62, 4, 16] },
    { type: 'capsule', a: [6, 8, 0], b: [6, 150, 0], ra: 2.6, k: 2 },
    { type: 'ellipsoid', c: [-22, 86, 0], r: [26, 56, 1.8], k: 2 },
    FLOOR] },
  tree: { label: 'Tree', names: ['tree', 'oak tree', 'oak', 'big tree'], k: 12, cell: 1.6, shapes: [
    cyl(-6, 70, 11, 7), { type: 'capsule', a: [0, 4, 0], b: [16, -4, 6], ra: 6, k: 8 }, { type: 'capsule', a: [0, 4, 0], b: [-14, -4, -8], ra: 6, k: 8 },
    { type: 'capsule', a: [0, 56, 0], b: [-22, 86, 4], ra: 5, k: 6 }, { type: 'capsule', a: [0, 60, 0], b: [20, 92, -6], ra: 5, k: 6 },
    { type: 'sphere', c: [0, 112, 0], r: 34 }, { type: 'sphere', c: [-30, 96, 8], r: 26 }, { type: 'sphere', c: [30, 100, -6], r: 27 }, { type: 'sphere', c: [6, 96, 28], r: 24 }, { type: 'sphere', c: [-6, 100, -28], r: 24 },
    FLOOR] },
  lighthouse: { label: 'Lighthouse', names: ['lighthouse', 'light house', 'beacon tower'], k: 6, cell: 1.6, shapes: [
    cyl(-10, 118, 30, 19), { type: 'ellipsoid', c: [0, 120, 0], r: [27, 5, 27] }, cyl(122, 144, 15), { type: 'sphere', c: [0, 146, 0], r: 15 }, cyl(150, 166, 5, 1),
    { type: 'ellipsoid', c: [0, 0, 0], r: [44, 10, 44] },
    FLOOR] },
};

const KEYS = Object.keys(THINGS);
export function thingOf(name) {
  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return KEYS.find((k) => THINGS[k].names.includes(n)) || null;
}

function bounds(shapes) {
  const lo = [Infinity, 0, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - (Array.isArray(r) ? r[i] : r)); hi[i] = Math.max(hi[i], p[i] + (Array.isArray(r) ? r[i] : r)); } };
  for (const s of shapes) {
    if (s.cut) continue;
    if (s.type === 'capsule') { grow(s.a, s.ra); grow(s.b, s.rb ?? s.ra); } else grow(s.c, s.r); // spheres, ellipsoids and boxes all grow by r about c
  }
  const pad = 6;
  return { min: [lo[0] - pad, -pad, lo[2] - pad], max: [hi[0] + pad, hi[1] + pad, hi[2] + pad] };
}

const cache = new Map();
export function build(key) {
  if (!THINGS[key]) throw new Error('No recipe for ' + key);
  if (cache.has(key)) return cache.get(key);
  const t = THINGS[key], m = mesh(field(t.shapes, t.k), bounds(t.shapes), t.cell);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { const v = m.positions[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  // rest it on the bed: the lowest point at y = 0
  for (let i = 1; i < m.positions.length; i += 3) m.positions[i] -= lo[1];
  const model = { key, label: t.label, positions: m.positions, normals: m.normals, indices: m.indices,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((v) => Math.round(v * 10) / 10) };
  cache.set(key, model);
  return model;
}

export const PLA_G_PER_CM3 = 1.24; // solid PLA; a slicer's shells-and-infill print weighs less
export const OVERHANG_PCT = 5; // past this share of its surface leaning out beyond 45°, say "print with supports"

/** what a slicer will find: does it fit the bed, stand on it (else a brim), hold water, face outward; how much material; where it leans out (supports).
 *  Pure, from the mesh alone; the card and the test both read it. overhangPct is the share of the surface (the base face
 *  excepted) whose normal points down more than 45° from the vertical: a home printer bridges less than that without supports. */
export function printCheck(model) {
  const P = model.positions, I = model.indices, n = I.length / 3;
  let vol = 0, area = 0, base = 0, over = 0, bad = 0;
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  const edges = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz);
    for (const [p, q] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) { const e = p < q ? p * 4194304 + q : q * 4194304 + p; edges.set(e, (edges.get(e) || 0) + 1); }
    if (!l) continue;
    const A = l / 2; area += A;
    if (P[a + 1] < 0.8 && P[b + 1] < 0.8 && P[c + 1] < 0.8) { // on the bed
      base += A;
      for (const k of [a, b, c]) { bx0 = Math.min(bx0, P[k]); bx1 = Math.max(bx1, P[k]); bz0 = Math.min(bz0, P[k + 2]); bz1 = Math.max(bz1, P[k + 2]); }
      continue;
    }
    if (ny / l < -Math.SQRT1_2) over += A;
  }
  for (const c of edges.values()) if (c !== 2) bad++;
  const size = model.size, fits = Math.max(...size) <= BED_MM, closed = edges.size > 0 && bad / edges.size < 0.001, outward = vol > 0;
  const spread = base > 0 ? [(bx1 - bx0) / (size[0] || 1), (bz1 - bz0) / (size[2] || 1)] : [0, 0];
  const baseCm2 = Math.round(base / 10) / 10, stands = base >= 1000 || (spread[0] >= 0.4 && spread[1] >= 0.4 && base >= 80);
  const volumeCm3 = Math.round(Math.abs(vol) / 100) / 10, grams = Math.round(volumeCm3 * PLA_G_PER_CM3), overhangPct = Math.round(area ? 100 * over / area : 0);
  const supports = overhangPct >= OVERHANG_PCT;
  const notes = [fits ? 'fits a ' + BED_MM + ' mm bed' : 'too big for a ' + BED_MM + ' mm bed (' + size.map(Math.round).join(' × ') + ' mm)',
    stands ? 'stands on its base (' + baseCm2 + ' cm²)' : 'a small base for its height (' + baseCm2 + ' cm²): print with a brim',
    closed ? 'watertight' : 'open edges: ' + bad + ' (a slicer may need to mend it)',
    supports ? 'leans out past 45° on ' + overhangPct + '% of it: print with supports' : 'no supports needed (overhangs on ' + overhangPct + '%)',
    volumeCm3 + ' cm³, about ' + grams + ' g in solid PLA'];
  // ok: a slicer takes it as it is; a brim or supports are settings, not faults
  return { fits, stands, brim: !stands, closed, outward, baseCm2, volumeCm3, grams, overhangPct, supports, triangles: n, ok: fits && closed && outward, notes };
}

/** Before a file goes to print (Void's ask: verify the geometry before the print command): read the STL back and hold it to
 *  its model. The facet count in the header matches the model and the file's length, every number is finite, the file's
 *  extent is the model's size (Z up), and the mesh is one a slicer takes as it is (printCheck: fits, watertight, outward).
 *  { ok, problems: [why, in words], triangles } — pure, from the bytes and the model alone. */
export function verifyStl(buf, model) {
  const problems = [], n = model.indices.length / 3;
  if (!buf || buf.byteLength < 84) return { ok: false, problems: ['the file is empty'], triangles: 0 };
  const dv = new DataView(buf), count = dv.getUint32(80, true);
  if (count !== n) problems.push('the file says ' + count + ' facets, the model has ' + n);
  if (buf.byteLength !== 84 + count * 50) problems.push('the file holds ' + Math.floor((buf.byteLength - 84) / 50) + ' facets, its header says ' + count);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], whole = Math.min(count, Math.floor((buf.byteLength - 84) / 50));
  let nan = 0;
  for (let t = 0; t < whole; t++) {
    const o = 84 + t * 50;
    for (let k = 0; k < 12; k++) { const x = dv.getFloat32(o + k * 4, true); if (!Number.isFinite(x)) { nan++; continue; } if (k >= 3) { const a = (k - 3) % 3; if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; } }
  }
  if (nan) problems.push(nan + ' numbers in the file are not a number');
  // the file is Z up: its x, y, z extents are the model's x, z, y
  const want = [model.size[0], model.size[2], model.size[1]], got = [0, 1, 2].map((a) => hi[a] - lo[a]);
  if (whole && got.some((g, a) => !(Math.abs(g - want[a]) <= Math.max(0.2, want[a] * 0.01)))) problems.push('the file\'s extent ' + got.map((g) => Math.round(g)).join(' × ') + ' mm is not the model\'s ' + want.map(Math.round).join(' × ') + ' mm');
  const pc = printCheck(model);
  if (!pc.fits) problems.push(pc.notes[0]);
  if (!pc.closed) problems.push(pc.notes[2]);
  if (!pc.outward) problems.push('it faces inward (a slicer would read it inside out)');
  return { ok: !problems.length, problems, triangles: whole };
}

/** binary STL in millimetres, Z up (the model's y), each facet with its own normal */
export function stl(model) {
  const P = model.positions, I = model.indices, n = I.length / 3;
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const head = 'Void forge: ' + model.label + ' (a-to-mind.com), mm, Z up';
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < head.length ? head.charCodeAt(i) & 127 : 32);
  dv.setUint32(80, n, true);
  // model (x, y, z) with y up -> STL (x, -z, y) with Z up; the swap keeps every facet's winding outward
  const v = (k) => [P[k * 3], -P[k * 3 + 2], P[k * 3 + 1]];
  let o = 84;
  for (let t = 0; t < n; t++) {
    const a = v(I[t * 3]), b = v(I[t * 3 + 1]), c = v(I[t * 3 + 2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const x of [nx, ny, nz, ...a, ...b, ...c]) { dv.setFloat32(o, x, true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return buf;
}
