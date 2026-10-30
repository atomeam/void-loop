/**
 * stl-check: is an STL print file watertight, and if not, what is wrong and where (asked by Verse: "Create a browser-based utility to
 * check the watertightness of STL print files."). The page /stl/ and the stage card (skills/stl-check.js) both read it; nothing here
 * touches the network or the DOM, so a file someone brings is checked on their own device. Pure.
 *
 * The forge already checks the files it writes (skills/forge-rules.js printCheck: every edge shared by exactly two faces, and a positive
 * signed volume, so the mesh faces outward). This is the same test made for a file nobody here made: its points are welded first (an STL
 * repeats every corner per facet), then each edge is counted (once: an open edge on a hole; three or more: non-manifold), each pair of
 * faces across an edge is checked for winding the same way (a flipped face walks a shared edge in the same direction as its neighbour),
 * each separate shell is checked for facing outward (its signed volume), and the faces that cross each other are found.
 * What the best checkers report is the list here (Netfabb, 3D Builder, PrusaSlicer's "errors detected", the in-browser repair tools):
 * triangles, vertices, size, volume, area, watertight, open edges and holes, non-manifold edges, flipped faces, inside-out shells,
 * degenerate and duplicate faces, duplicate vertices, shells and self-intersections, and a mended copy.
 *
 *   parseStl(bytes)            -> { format: 'binary'|'ascii', name, tris: Float32Array (9 per face), count, problems: [] }
 *   analyze(parsed, { tol })   -> the report (numbers, verdict, where; positions/indices and the edges to highlight for a preview)
 *   mend(parsed, report)       -> a new parsed mesh: degenerate and duplicate faces dropped, every face turned to agree with its shell,
 *                                 inside-out shells turned outward, each hole closed with a fan from its middle (non-manifold edges stay)
 *   binaryStl(tris, name), asciiStl(tris, name), cubeTris(size), sample('cube'|'hole'|'flipped'), reportText(report, file), reportJson(...)
 */

export const DEFAULT_TOL = 0.001; // mm: corners closer than this are one corner (the weld); a slicer welds within about this much
export const SELF_CAP = 300000; // faces: past this the crossing-faces search is skipped (and says so), so a huge scan still answers fast
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/** bytes as a Uint8Array, from an ArrayBuffer, a typed array or a string. Pure. */
const bytesOf = (b) => (typeof b === 'string' ? enc.encode(b) : b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b || new ArrayBuffer(0)));

/** read an STL, binary or ASCII. A binary file is one whose length is 84 + 50 per facet its header counts; anything that starts with
 *  "solid" and holds "facet" and "vertex" is read as text; a binary file that does not add up is still read as far as it goes, and says so. Pure. */
export function parseStl(input) {
  const u8 = bytesOf(input), problems = [];
  if (!u8.length) return { format: 'none', name: '', tris: new Float32Array(0), count: 0, problems: ['the file is empty'] };
  const head = String.fromCharCode(...u8.subarray(0, Math.min(u8.length, 512)));
  const count = u8.length >= 84 ? new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(80, true) : -1;
  const binaryFits = count >= 0 && u8.length === 84 + count * 50;
  if (!binaryFits && /^\s*solid\b/i.test(head)) {
    const text = new TextDecoder('latin1').decode(u8);
    if (/\bfacet\b/i.test(text) && /\bvertex\b/i.test(text)) return parseAscii(text, problems);
  }
  if (u8.length < 84) return { format: 'none', name: '', tris: new Float32Array(0), count: 0, problems: ['the file is too short to be an STL (' + u8.length + ' bytes)'] };
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), whole = Math.floor((u8.length - 84) / 50), n = Math.min(count, whole);
  if (count > whole) problems.push('the header counts ' + count.toLocaleString('en') + ' facets but the file holds ' + whole.toLocaleString('en') + ' (it was cut short)');
  else if (u8.length !== 84 + count * 50) problems.push((u8.length - 84 - count * 50).toLocaleString('en') + ' bytes after the last facet the header counts');
  const tris = new Float32Array(n * 9); let bad = 0;
  for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; for (let k = 0; k < 9; k++) { const x = dv.getFloat32(o + k * 4, true); if (!Number.isFinite(x)) bad++; tris[t * 9 + k] = Number.isFinite(x) ? x : 0; } }
  if (bad) problems.push(bad + ' coordinates are not numbers (read as 0)');
  let name = ''; for (let i = 0; i < 80; i++) { const c = u8[i]; if (!c) break; name += c >= 32 && c < 127 ? String.fromCharCode(c) : ''; }
  return { format: 'binary', name: name.trim(), tris, count: n, problems };
}

function parseAscii(text, problems) {
  const name = ((text.match(/^\s*solid[ \t]*([^\r\n]*)/i) || [])[1] || '').trim(), out = [];
  let facets = 0, odd = 0, cur = [], bad = 0;
  const re = /\b(facet|endfacet|vertex)\b([^\r\n]*)/gi; let m;
  while ((m = re.exec(text))) {
    const w = m[1].toLowerCase();
    if (w === 'facet') { cur = []; continue; }
    if (w === 'endfacet') { facets++; if (cur.length === 9) out.push(...cur); else odd++; cur = []; continue; }
    const v = m[2].trim().split(/\s+/).slice(0, 3).map(Number); if (v.length < 3 || v.some((x) => !Number.isFinite(x))) { bad++; cur.push(0, 0, 0); } else cur.push(v[0], v[1], v[2]);
  }
  if (odd) problems.push(odd + ' facets do not have exactly three corners (left out)');
  if (bad) problems.push(bad + ' corners are not numbers (read as 0)');
  if (!facets) problems.push('no facets in the text');
  const tris = Float32Array.from(out); // the same 32-bit numbers a binary file holds, so the two forms of one mesh read the same
  return { format: 'ascii', name, tris, count: tris.length / 9, problems };
}

/** the weld: every corner within tol of an earlier one becomes that one. { positions, index (3 per face), dupVertices }. Pure. */
export function weld(tris, tol = DEFAULT_TOL) {
  const n = tris.length / 3, index = new Uint32Array(n), pos = [], cells = new Map(), s = 1 / Math.max(tol, 1e-9), t2 = tol * tol;
  // a cell's number: a hash of its three grid steps (two cells may share one; every match is still held to the distance)
  const key = (i, j, k) => ((Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) >>> 0);
  for (let v = 0; v < n; v++) {
    const x = tris[v * 3], y = tris[v * 3 + 1], z = tris[v * 3 + 2], ci = Math.floor(x * s), cj = Math.floor(y * s), ck = Math.floor(z * s);
    let hit = -1;
    const look = (k) => { const c = cells.get(k); if (!c) return; for (let q = 0; q < c.length; q++) { const p = c[q], dx = pos[p * 3] - x, dy = pos[p * 3 + 1] - y, dz = pos[p * 3 + 2] - z; if (dx * dx + dy * dy + dz * dz <= t2) { hit = p; return; } } };
    const own = key(ci, cj, ck); look(own);
    for (let a = -1; a <= 1 && hit < 0; a++) for (let b = -1; b <= 1 && hit < 0; b++) for (let c = -1; c <= 1 && hit < 0; c++) if (a || b || c) look(key(ci + a, cj + b, ck + c));
    if (hit < 0) { hit = pos.length / 3; pos.push(x, y, z); const c = cells.get(own); if (c) c.push(hit); else cells.set(own, [hit]); }
    index[v] = hit;
  }
  return { positions: Float64Array.from(pos), index, dupVertices: n - pos.length / 3 };
}

const sub = (P, a, b) => [P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** the whole check. tol: the weld distance in mm. Pure. */
export function analyze(parsed, { tol = DEFAULT_TOL, selfCap = SELF_CAP } = {}) {
  const tris = parsed.tris, nRaw = tris.length / 9, { positions: P, index, dupVertices } = weld(tris, tol), nv = P.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) { const v = P[i * 3 + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const size = nv ? [0, 1, 2].map((a) => hi[a] - lo[a]) : [0, 0, 0], span = Math.max(...size, 1e-9);
  // the faces the topology is read from: a face whose corners weld together (collapsed) or that repeats another is counted and set aside
  let area = 0, vol = 0, degenerate = 0, collapsed = 0, duplicates = 0; const keep = [], seen = new Map(), degenerateFaces = [];
  for (let t = 0; t < nRaw; t++) {
    const a = index[t * 3], b = index[t * 3 + 1], c = index[t * 3 + 2];
    const n = cross(sub(P, b, a), sub(P, c, a)), A = Math.hypot(...n) / 2;
    if (a === b || b === c || a === c) { degenerate++; collapsed++; degenerateFaces.push(t); continue; }
    if (A <= span * span * 1e-12) { degenerate++; degenerateFaces.push(t); } // a sliver of no area: counted, still part of the surface
    // the same three corners in any order: a hash of the sorted three, then a real comparison (Map of hash -> faces)
    const x0 = Math.min(a, b, c), x2 = Math.max(a, b, c), x1 = a + b + c - x0 - x2, h = (Math.imul(x0, 73856093) ^ Math.imul(x1, 19349663) ^ Math.imul(x2, 83492791)) >>> 0, same = seen.get(h);
    if (same && same.some((q) => q[0] === x0 && q[1] === x1 && q[2] === x2)) { duplicates++; continue; }
    if (same) same.push([x0, x1, x2]); else seen.set(h, [[x0, x1, x2]]); keep.push(t);
    area += A; vol += dot([P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], cross([P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]])) / 6; // a repeated face is not counted twice
  }
  const F = keep.length, fv = new Uint32Array(F * 3); for (let i = 0; i < F; i++) for (let k = 0; k < 3; k++) fv[i * 3 + k] = index[keep[i] * 3 + k];
  // every edge: how many faces use it, and the first two with the way each walks it (+1 low to high corner, -1 high to low)
  const emap = new Map(), eA = [], eB = [], eN = [], eT0 = [], eT1 = [], eD0 = [], eD1 = [], faceEdges = new Int32Array(F * 3);
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const p = fv[f * 3 + k], q = fv[f * 3 + (k + 1) % 3], lo2 = p < q ? p : q, hi2 = p < q ? q : p, key = lo2 * nv + hi2, d = p < q ? 1 : -1;
    let e = emap.get(key);
    if (e === undefined) { e = eA.length; emap.set(key, e); eA.push(lo2); eB.push(hi2); eN.push(1); eT0.push(f); eD0.push(d); eT1.push(-1); eD1.push(0); }
    else { if (eN[e] === 1) { eT1[e] = f; eD1[e] = d; } eN[e]++; }
    faceEdges[f * 3 + k] = e;
  }
  const E = eA.length; let open = 0, nonManifold = 0, inconsistent = 0; const openEdges = [], nmEdges = [];
  for (let e = 0; e < E; e++) { if (eN[e] === 1) { open++; openEdges.push(eA[e], eB[e]); } else if (eN[e] > 2) { nonManifold++; nmEdges.push(eA[e], eB[e]); } else if (eD0[e] === eD1[e]) inconsistent++; }
  // shells and orientation together: walk each shell across its two-face edges, giving each face the turn that agrees with the face it came from
  const shellOf = new Int32Array(F).fill(-1), turn = new Uint8Array(F), shells = []; let conflicts = 0;
  for (let s0 = 0; s0 < F; s0++) {
    if (shellOf[s0] >= 0) continue;
    const id = shells.length, stack = [s0], members = []; shellOf[s0] = id;
    while (stack.length) {
      const f = stack.pop(); members.push(f);
      for (let k = 0; k < 3; k++) {
        const e = faceEdges[f * 3 + k]; if (eN[e] < 2) continue;
        if (eN[e] > 2) continue; // a non-manifold edge joins no orientation; its faces still join the shell through their other edges or by a later walk
        const g = eT0[e] === f ? eT1[e] : eT0[e], want = turn[f] ^ (eD0[e] === eD1[e] ? 1 : 0);
        if (shellOf[g] < 0) { shellOf[g] = id; turn[g] = want; stack.push(g); } else if (turn[g] !== want) conflicts++;
      }
    }
    shells.push(members);
  }
  // faces joined only through a non-manifold edge are one body to a person: merge those shells
  const parent = shells.map((_, i) => i), root = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) { const e = faceEdges[f * 3 + k]; if (eN[e] > 2) { const a = root(shellOf[eT0[e]]), b = root(shellOf[f]); if (a !== b) parent[b] = a; } }
  let flipped = 0, insideOut = 0; const flippedFaces = [], shellRows = [];
  for (let id = 0; id < shells.length; id++) {
    const m = shells[id]; let ones = 0; for (const f of m) ones += turn[f];
    const minority = ones * 2 > m.length ? 0 : 1; // the faces in the smaller camp are the flipped ones (a tie flips the turned half)
    for (const f of m) if (turn[f] === minority) { flipped++; if (flippedFaces.length < 5000) flippedFaces.push(f); }
    // the shell's volume with every face turned to the majority: below zero, the whole shell faces inward
    let v = 0, a = 0, closed = true;
    for (const f of m) {
      const flip = turn[f] === minority, i = fv[f * 3], j = flip ? fv[f * 3 + 2] : fv[f * 3 + 1], k = flip ? fv[f * 3 + 1] : fv[f * 3 + 2];
      v += dot([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], cross([P[j * 3], P[j * 3 + 1], P[j * 3 + 2]], [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]])) / 6;
      a += Math.hypot(...cross(sub(P, j, i), sub(P, k, i))) / 2;
      for (let q = 0; q < 3; q++) if (eN[faceEdges[f * 3 + q]] !== 2) closed = false;
    }
    if (closed && v < 0) insideOut++;
    shellRows.push({ faces: m.length, closed, volume: Math.abs(v), area: a, insideOut: closed && v < 0, minority });
  }
  const bodies = new Set(shells.map((_, i) => root(i))).size;
  // holes: the open edges joined end to end into loops
  const holes = loops(openEdges).length;
  const watertight = F > 0 && open === 0 && nonManifold === 0;
  const consistent = flipped === 0 && conflicts === 0;
  const intersect = F <= selfCap ? crossings(P, fv, faceEdges, eN) : null;
  const volume = shellRows.reduce((s, r) => s + (r.insideOut ? -r.volume : r.volume), 0);
  const where = openEdges.length ? clusterWhere(P, openEdges) : [];
  const r = {
    format: parsed.format, name: parsed.name, problems: parsed.problems || [],
    triangles: nRaw, vertices: nv, dupVertices, tol, faces: F, edges: E,
    size, min: nv ? lo : [0, 0, 0], max: nv ? hi : [0, 0, 0], area, volume: watertight ? Math.abs(volume) : Math.abs(vol), volumeExact: watertight && consistent,
    watertight, openEdges: open, holes, nonManifoldEdges: nonManifold, inconsistentEdges: inconsistent, flippedFaces: flipped, orientationConflicts: conflicts,
    insideOutShells: insideOut, degenerate, collapsed, duplicates, shells: shells.length, bodies, selfIntersections: intersect ? intersect.pairs : null, selfChecked: !!intersect,
    unitsHint: nv && span < 12 ? 'it is ' + fmt(span) + ' mm across: if it was drawn in inches it is ' + fmt(span * 25.4) + ' mm (scale by 25.4)' : '',
    where,
    // for a preview: the welded mesh and the edges and faces to highlight (vertex pairs, face indices into `faces`)
    mesh: { positions: P, indices: fv, openEdges: Uint32Array.from(openEdges), nonManifoldEdges: Uint32Array.from(nmEdges), flippedFaces: Uint32Array.from(flippedFaces), crossingFaces: Uint32Array.from(intersect ? intersect.faces : []), shellOf, turn, shellRows },
  };
  r.ok = r.triangles > 0 && watertight && consistent && insideOut === 0 && (!intersect || intersect.pairs === 0);
  r.verdict = verdict(r);
  return r;
}

const fmt = (x, d = 2) => (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('en') : String(+(+x).toFixed(d)));
const plural = (n, one, many) => n.toLocaleString('en') + ' ' + (n === 1 ? one : many || one + 's');

/** the plain line a person reads first: ready, or what is wrong and where. Pure. */
export function verdict(r) {
  if (!r.triangles) return 'Not an STL that can be checked: ' + (r.problems[0] || 'no facets');
  if (r.ok) return 'Watertight: ready for the slicer.' + (r.degenerate || r.duplicates ? ' (' + [r.degenerate ? plural(r.degenerate, 'degenerate face') : '', r.duplicates ? plural(r.duplicates, 'duplicate face') : ''].filter(Boolean).join(', ') + ' a slicer ignores.)' : '');
  const bits = [];
  if (r.openEdges) bits.push(plural(r.openEdges, 'open edge') + ' around ' + plural(r.holes, 'hole') + (r.where.length ? ', the first near x ' + fmt(r.where[0].at[0], 1) + ', y ' + fmt(r.where[0].at[1], 1) + ', z ' + fmt(r.where[0].at[2], 1) + ' mm' : ''));
  if (r.nonManifoldEdges) bits.push(plural(r.nonManifoldEdges, 'non-manifold edge') + ' (shared by three faces or more)');
  if (r.flippedFaces) bits.push(plural(r.flippedFaces, 'face') + ' wound the wrong way (flipped normals)');
  if (r.orientationConflicts && !r.flippedFaces) bits.push('a surface that cannot be oriented (a Möbius twist)');
  if (r.insideOutShells) bits.push(plural(r.insideOutShells, 'shell') + ' inside out (normals pointing in)');
  if (r.selfIntersections) bits.push(plural(r.selfIntersections, 'pair') + ' of faces crossing each other');
  return (r.watertight ? 'Watertight, but not ready: ' : 'Not watertight: ') + bits.join('; ') + '.';
}

/** the open edges as loops of corners, each loop a hole. Pure. */
export function loops(pairs) {
  const adj = new Map(), used = new Set(), out = [];
  const add = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, e]); };
  for (let e = 0; e < pairs.length / 2; e++) { add(pairs[e * 2], pairs[e * 2 + 1], e); add(pairs[e * 2 + 1], pairs[e * 2], e); }
  for (let e = 0; e < pairs.length / 2; e++) {
    if (used.has(e)) continue;
    const loop = [pairs[e * 2]]; used.add(e); let at = pairs[e * 2 + 1];
    while (at !== loop[0]) { loop.push(at); const nx = (adj.get(at) || []).find(([, k]) => !used.has(k)); if (!nx) break; used.add(nx[1]); at = nx[0]; }
    out.push(loop);
  }
  return out;
}

/** where the open edges are: up to five clusters (one per hole), each with its middle and how many edges. Pure. */
function clusterWhere(P, pairs) {
  return loops(pairs).slice(0, 5).map((L) => { const c = [0, 0, 0]; for (const v of L) for (let a = 0; a < 3; a++) c[a] += P[v * 3 + a] / L.length; return { at: c, edges: L.length }; });
}

/** faces that cross each other: an edge of one passing through the inside of another, among faces that share no corner. A grid keeps
 *  it near linear; a pair is tested once, in the cell holding the low corner of where their boxes overlap. { pairs, faces }. Pure. */
function crossings(P, fv, faceEdges, eN) {
  const F = fv.length / 3; if (F < 4) return { pairs: 0, faces: [] };
  const bmin = new Float64Array(F * 3), bmax = new Float64Array(F * 3); let avg = 0; const glo = [Infinity, Infinity, Infinity];
  for (let f = 0; f < F; f++) for (let a = 0; a < 3; a++) {
    let mn = Infinity, mx = -Infinity; for (let k = 0; k < 3; k++) { const v = P[fv[f * 3 + k] * 3 + a]; if (v < mn) mn = v; if (v > mx) mx = v; }
    bmin[f * 3 + a] = mn; bmax[f * 3 + a] = mx; avg += (mx - mn) / (3 * F); if (mn < glo[a]) glo[a] = mn;
  }
  const cs = Math.max(avg * 2, 1e-6), cell = (x, a) => Math.floor((x - glo[a]) / cs), grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  for (let f = 0; f < F; f++) {
    const i0 = cell(bmin[f * 3], 0), i1 = Math.min(cell(bmax[f * 3], 0), i0 + 8), j0 = cell(bmin[f * 3 + 1], 1), j1 = Math.min(cell(bmax[f * 3 + 1], 1), j0 + 8), k0 = cell(bmin[f * 3 + 2], 2), k1 = Math.min(cell(bmax[f * 3 + 2], 2), k0 + 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) { const kk = key(i, j, k), c = grid.get(kk); if (c) c.push(f); else grid.set(kk, [f]); }
  }
  let pairs = 0; const hit = new Set();
  for (const [kk, list] of grid) {
    if (list.length < 2) continue;
    const [ci, cj, ck] = kk.split(',').map(Number);
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const f = list[x], g = list[y]; let apart = false; const lo = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const l = Math.max(bmin[f * 3 + a], bmin[g * 3 + a]), h = Math.min(bmax[f * 3 + a], bmax[g * 3 + a]); if (l > h) { apart = true; break; } lo[a] = l; }
      if (apart || cell(lo[0], 0) !== ci || cell(lo[1], 1) !== cj || cell(lo[2], 2) !== ck) continue;
      const A = [fv[f * 3], fv[f * 3 + 1], fv[f * 3 + 2]], B = [fv[g * 3], fv[g * 3 + 1], fv[g * 3 + 2]];
      if (A.some((v) => B.includes(v))) continue;
      if (triCross(P, A, B) || triCross(P, B, A)) { pairs++; hit.add(f); hit.add(g); }
    }
  }
  return { pairs, faces: [...hit].slice(0, 5000) };
}
/** true when an edge of face A passes through the inside of face B (Möller–Trumbore, touching at an edge or a corner does not count). Pure. */
function triCross(P, A, B) {
  const v0 = [P[B[0] * 3], P[B[0] * 3 + 1], P[B[0] * 3 + 2]], e1 = sub(P, B[1], B[0]), e2 = sub(P, B[2], B[0]), eps = 1e-9;
  for (let k = 0; k < 3; k++) {
    const o = [P[A[k] * 3], P[A[k] * 3 + 1], P[A[k] * 3 + 2]], d = sub(P, A[(k + 1) % 3], A[k]);
    const p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det, s = [o[0] - v0[0], o[1] - v0[1], o[2] - v0[2]], u = dot(s, p) * inv; if (u <= eps || u >= 1 - eps) continue;
    const q = cross(s, e1), v = dot(d, q) * inv; if (v <= eps || u + v >= 1 - eps) continue;
    const t = dot(e2, q) * inv; if (t > eps && t < 1 - eps) return true;
  }
  return false;
}

/** a mended copy: degenerate and duplicate faces dropped, every face turned to agree with its shell, inside-out shells turned outward,
 *  and each hole closed with a fan of faces from its middle. Non-manifold edges and crossing faces are left as they are (said on the page). Pure. */
export function mend(parsed, r = analyze(parsed)) {
  const { positions: P, indices: fv, shellOf, turn, shellRows } = r.mesh, F = fv.length / 3, faces = [];
  for (let f = 0; f < F; f++) {
    const row = shellRows[shellOf[f]], a = fv[f * 3], b = fv[f * 3 + 1], c = fv[f * 3 + 2];
    if (Math.hypot(...cross(sub(P, b, a), sub(P, c, a))) === 0) continue; // no area: nothing to print
    let flip = turn[f] === row.minority; if (row.insideOut) flip = !flip;
    faces.push(flip ? [a, c, b] : [a, b, c]);
  }
  // the open edges again, now walked the way their (turned) face walks them; a hole's loop runs the other way round
  const count = new Map(), dirOf = new Map();
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? p + ',' + q : q + ',' + p; count.set(k, (count.get(k) || 0) + 1); dirOf.set(k, [p, q]); }
  const next = new Map();
  for (const [k, n] of count) if (n === 1) { const [p, q] = dirOf.get(k); if (!next.has(q)) next.set(q, []); next.get(q).push(p); } // hole edge q -> p
  const pos = Array.from(P), out = faces.slice(), used = new Set();
  for (const [start] of next) {
    while ((next.get(start) || []).length) {
      const loop = [start]; let at = next.get(start).shift(), guard = 0;
      while (at !== start && guard++ < 1e6) { loop.push(at); const nx = next.get(at); if (!nx || !nx.length) break; at = nx.shift(); }
      if (at !== start || loop.length < 3) continue;
      const key = loop.join(','); if (used.has(key)) continue; used.add(key);
      if (loop.length === 3) { out.push([loop[0], loop[1], loop[2]]); continue; }
      const c = [0, 0, 0]; for (const v of loop) for (let a = 0; a < 3; a++) c[a] += P[v * 3 + a] / loop.length;
      const m = pos.length / 3; pos.push(...c);
      for (let i = 0; i < loop.length; i++) out.push([loop[i], loop[(i + 1) % loop.length], m]);
    }
  }
  const tris = new Float32Array(out.length * 9);
  out.forEach((t, i) => { for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) tris[i * 9 + k * 3 + a] = pos[t[k] * 3 + a]; });
  return { format: 'binary', name: (parsed.name || 'mesh') + ' (mended)', tris, count: out.length, problems: [] };
}

/** binary STL bytes, each facet with its unit normal from its winding. Pure. */
export function binaryStl(tris, name = 'Verse STL check (a-to-mind.com/stl/)') {
  const n = tris.length / 9, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < name.length ? name.charCodeAt(i) & 127 : 32);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50, T = tris.subarray(t * 9, t * 9 + 9), u = [T[3] - T[0], T[4] - T[1], T[5] - T[2]], v = [T[6] - T[0], T[7] - T[1], T[8] - T[2]], c = cross(u, v), l = Math.hypot(...c) || 1;
    for (let k = 0; k < 3; k++) dv.setFloat32(o + k * 4, c[k] / l, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, T[k], true);
  }
  return new Uint8Array(buf);
}
/** the same mesh as ASCII STL text. Pure. */
export function asciiStl(tris, name = 'verse') {
  const L = ['solid ' + name], f = (x) => (+x).toPrecision(9).replace(/\.?0+(e|$)/, '$1');
  for (let t = 0; t < tris.length / 9; t++) {
    const T = tris.subarray(t * 9, t * 9 + 9), c = cross([T[3] - T[0], T[4] - T[1], T[5] - T[2]], [T[6] - T[0], T[7] - T[1], T[8] - T[2]]), l = Math.hypot(...c) || 1;
    L.push('  facet normal ' + c.map((x) => f(x / l)).join(' '), '    outer loop');
    for (let k = 0; k < 3; k++) L.push('      vertex ' + f(T[k * 3]) + ' ' + f(T[k * 3 + 1]) + ' ' + f(T[k * 3 + 2]));
    L.push('    endloop', '  endfacet');
  }
  L.push('endsolid ' + name);
  return L.join('\n') + '\n';
}

/** a closed cube, size mm on a side, sitting on z = 0, every face wound outward (12 faces). Pure. */
export function cubeTris(s = 20) {
  const V = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]];
  const F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return Float32Array.from(F.flatMap((f) => f.flatMap((i) => V[i])));
}
/** the built-in samples: a watertight cube, the same cube with one face missing (a hole), and with one face flipped. Binary STL bytes. Pure. */
export function sample(kind = 'cube') {
  const t = cubeTris(20);
  if (kind === 'hole') return binaryStl(t.slice(0, 9 * 11), 'Verse sample: 20 mm cube with a hole');
  if (kind === 'flipped') { const f = t.slice(); for (let k = 0; k < 3; k++) { const a = f[9 * 4 + 3 + k]; f[9 * 4 + 3 + k] = f[9 * 4 + 6 + k]; f[9 * 4 + 6 + k] = a; } return binaryStl(f, 'Verse sample: 20 mm cube with a flipped face'); }
  return binaryStl(t, 'Verse sample: 20 mm cube, watertight');
}

/** the report as plain text, the same lines the page shows. Pure. */
export function reportText(r, file = '') {
  const yes = (b) => (b ? 'yes' : 'no'), L = ['STL check' + (file ? ': ' + file : ''), r.verdict, ''];
  L.push('Format: ' + (r.format === 'ascii' ? 'ASCII' : r.format === 'binary' ? 'binary' : r.format) + (r.name ? ' ("' + r.name.slice(0, 60) + '")' : ''));
  L.push('Triangles: ' + r.triangles.toLocaleString('en'), 'Vertices: ' + r.vertices.toLocaleString('en') + ' (welded within ' + r.tol + ' mm; ' + r.dupVertices.toLocaleString('en') + ' repeated corners merged)');
  L.push('Size: ' + r.size.map((v) => fmt(v)).join(' x ') + ' mm (from ' + r.min.map((v) => fmt(v)).join(', ') + ' to ' + r.max.map((v) => fmt(v)).join(', ') + ')');
  L.push('Volume: ' + fmt(r.volume / 1000, 3) + ' cm3' + (r.volumeExact ? '' : ' (not exact: the mesh is not closed and oriented)'), 'Surface area: ' + fmt(r.area / 100, 2) + ' cm2');
  L.push('Watertight: ' + yes(r.watertight), 'Open edges: ' + r.openEdges + (r.holes ? ' (' + r.holes + ' hole' + (r.holes === 1 ? '' : 's') + ')' : ''), 'Non-manifold edges: ' + r.nonManifoldEdges);
  L.push('Flipped faces (inconsistent normals): ' + r.flippedFaces + (r.inconsistentEdges ? ' (' + r.inconsistentEdges + ' edges walked the same way by both faces)' : ''), 'Inside-out shells: ' + r.insideOutShells);
  L.push('Degenerate faces (no area): ' + r.degenerate, 'Duplicate faces: ' + r.duplicates, 'Shells: ' + r.shells + (r.bodies !== r.shells ? ' (' + r.bodies + ' bodies)' : ''));
  L.push('Self-intersections: ' + (r.selfChecked ? r.selfIntersections + ' crossing pairs' : 'not checked (over ' + SELF_CAP.toLocaleString('en') + ' faces)'));
  for (const w of r.where) L.push('Hole near ' + w.at.map((v) => fmt(v, 1)).join(', ') + ' mm (' + w.edges + ' open edges)');
  if (r.unitsHint) L.push('Units: ' + r.unitsHint);
  for (const p of r.problems) L.push('File: ' + p);
  L.push('', 'Checked on this device at a-to-mind.com/stl/; the file was not uploaded.');
  return L.join('\n') + '\n';
}
/** the report as data (the mesh left out). Pure. */
export function reportJson(r, file = '') {
  const { mesh, ...rest } = r; void mesh;
  return { file, ...rest, size: r.size.map((v) => +v.toFixed(4)), min: r.min.map((v) => +v.toFixed(4)), max: r.max.map((v) => +v.toFixed(4)), volumeCm3: +(r.volume / 1000).toFixed(4), areaCm2: +(r.area / 100).toFixed(4), where: r.where.map((w) => ({ at: w.at.map((v) => +v.toFixed(3)), edges: w.edges })) };
}
