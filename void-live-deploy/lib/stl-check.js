// Check an STL print file on this device (Verse's ask, daily reflection 2026-10-28: "a browser-based utility to check the
// watertightness of STL print files"). parseStl reads binary or ASCII STL into the forge's mesh form (y up, resting on the bed,
// shared corners welded), and checkStl holds it to the same printCheck the forge's own prints pass (skills/forge-rules.js):
// watertight, facing outward, fits the bed, needs supports or a brim, and how much PLA. Pure: bytes in, words out, nothing sent.
import { printCheck } from '../skills/forge-rules.js';

export const MAX_FACETS = 2000000; // past this a phone runs out of memory; a slicer is the right tool then
const WELD = 1e4; // corners within 0.0001 mm are one corner

const isAscii = (u8) => {
  const head = new TextDecoder().decode(u8.subarray(0, Math.min(u8.length, 512))).trimStart().toLowerCase();
  if (!head.startsWith('solid')) return false;
  // a binary file may start with "solid" too: it is binary when its length is exactly what its facet count says
  if (u8.length >= 84) { const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(80, true); if (84 + n * 50 === u8.length) return false; }
  return /facet\s+normal/.test(head) || /endsolid/.test(head) || u8.length < 84;
};

/** STL bytes -> { positions, indices, size, triangles, format, label } in millimetres, y up, the lowest point at y = 0.
 *  Throws an Error with a plain sentence when the bytes are not an STL. */
export function parseStl(buf, label = 'your file') {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf || new ArrayBuffer(0));
  if (!u8.length) throw new Error('The file is empty.');
  const tri = []; // STL x, y, z per corner, Z up
  let format;
  if (isAscii(u8)) {
    format = 'ASCII';
    const text = new TextDecoder().decode(u8), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
    for (let m; (m = re.exec(text));) tri.push(+m[1], +m[2], +m[3]);
    if (tri.length % 9) throw new Error('A facet in the file does not have three corners.');
  } else {
    format = 'binary';
    if (u8.length < 84) throw new Error('This is not an STL file: it is too short.');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(80, true);
    if (84 + n * 50 > u8.length) throw new Error('The file says it holds ' + n + ' facets but is cut short: it may not have finished downloading.');
    if (n > MAX_FACETS) throw new Error('The file has ' + n.toLocaleString('en') + ' facets, more than this check reads on a phone.');
    for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; for (let k = 0; k < 9; k++) tri.push(dv.getFloat32(o + k * 4, true)); }
  }
  const triangles = tri.length / 9;
  if (!triangles) throw new Error('The file has no facets.');
  if (tri.some((x) => !Number.isFinite(x))) throw new Error('Some numbers in the file are not numbers: it is damaged.');
  // weld shared corners, and turn Z up into the forge's y up: model (x, y, z) = STL (x, z, -y), a rotation, so windings keep their side
  const at = new Map(), positions = [], indices = new Uint32Array(triangles * 3);
  for (let i = 0; i < tri.length; i += 3) {
    const x = tri[i], y = tri[i + 2], z = -tri[i + 1], key = Math.round(x * WELD) + ',' + Math.round(y * WELD) + ',' + Math.round(z * WELD);
    let v = at.get(key);
    if (v === undefined) { v = positions.length / 3; at.set(key, v); positions.push(x, y, z); }
    indices[i / 3] = v;
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { const v = positions[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  for (let i = 1; i < positions.length; i += 3) positions[i] -= lo[1]; // rest it on the bed
  return { positions: Float32Array.from(positions), indices, size: [0, 1, 2].map((a) => Math.round((hi[a] - lo[a]) * 10) / 10), triangles, format, label };
}

/** STL bytes -> { ok, closed, outward, fits, notes: [sentences], triangles, size, format } or { ok: false, error } */
export function checkStl(buf, label) {
  let model;
  try { model = parseStl(buf, label); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  const pc = printCheck(model);
  return { ...pc, size: model.size, format: model.format, triangles: model.triangles, ok: pc.ok };
}
