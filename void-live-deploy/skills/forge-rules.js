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
    if (s.type === 'capsule') { grow(s.a, s.ra); grow(s.b, s.rb ?? s.ra); } else grow(s.c, s.r);
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
