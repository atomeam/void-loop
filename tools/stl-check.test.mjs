// lib/stl-check.js (asked by Verse: "Create a browser-based utility to check the watertightness of STL print files."): real meshes, each
// broken one way, and the report has to name exactly that break. The forge's own files (skills/forge-rules.js) are read back through it too,
// so the two checks agree on what Verse writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStl, analyze, mend, binaryStl, asciiStl, cubeTris, sample, reportText, reportJson, verdict, weld } from '../void-live-deploy/lib/stl-check.js';
import { build, stl as forgeStl, printCheck } from '../void-live-deploy/skills/forge-rules.js';

const check = (bytes, o) => analyze(parseStl(bytes), o);
const flipFace = (t, f) => { const c = t.slice(); for (let k = 0; k < 3; k++) { const a = c[f * 9 + 3 + k]; c[f * 9 + 3 + k] = c[f * 9 + 6 + k]; c[f * 9 + 6 + k] = a; } return c; };

test('a closed cube passes: watertight, 12 faces, 8 corners, 20 mm, 8 cm³, 24 cm², one shell, nothing flipped', () => {
  const r = check(binaryStl(cubeTris(20)));
  assert.equal(r.format, 'binary'); assert.equal(r.triangles, 12); assert.equal(r.vertices, 8); assert.equal(r.dupVertices, 28);
  assert.deepEqual(r.size, [20, 20, 20]); assert.ok(Math.abs(r.volume - 8000) < 1e-6, String(r.volume)); assert.ok(Math.abs(r.area - 2400) < 1e-6);
  assert.equal(r.watertight, true); assert.equal(r.openEdges, 0); assert.equal(r.nonManifoldEdges, 0); assert.equal(r.flippedFaces, 0); assert.equal(r.insideOutShells, 0);
  assert.equal(r.shells, 1); assert.equal(r.degenerate, 0); assert.equal(r.duplicates, 0); assert.equal(r.selfIntersections, 0);
  assert.equal(r.ok, true); assert.equal(r.verdict, 'Watertight: ready for the slicer.');
});

test('a cube with one face removed: 3 open edges around 1 hole, not watertight, and where the hole is', () => {
  const r = check(sample('hole'));
  assert.equal(r.triangles, 11); assert.equal(r.watertight, false); assert.equal(r.ok, false);
  assert.equal(r.openEdges, 3); assert.equal(r.holes, 1); assert.equal(r.nonManifoldEdges, 0); assert.equal(r.flippedFaces, 0);
  assert.match(r.verdict, /^Not watertight: 3 open edges around 1 hole, the first near /);
  assert.equal(r.where.length, 1); assert.ok(Math.abs(r.where[0].at[0]) < 1e-6, 'the missing face is on the x = 0 side: ' + r.where[0].at);
  assert.equal(r.mesh.openEdges.length, 6, 'three edges, as corner pairs, for the preview');
  // the mended copy closes it, and the check says so
  const m = analyze(mend(parseStl(sample('hole'))));
  assert.equal(m.watertight, true); assert.equal(m.ok, true); assert.ok(Math.abs(m.volume - 8000) < 1e-3, String(m.volume));
});

test('a cube with one face flipped: watertight, but 1 face wound the wrong way and 3 edges walked the same way by both faces', () => {
  const r = check(sample('flipped'));
  assert.equal(r.watertight, true); assert.equal(r.flippedFaces, 1); assert.equal(r.inconsistentEdges, 3); assert.equal(r.ok, false);
  assert.match(r.verdict, /^Watertight, but not ready: 1 face wound the wrong way/);
  const m = analyze(mend(parseStl(sample('flipped')))); assert.equal(m.flippedFaces, 0); assert.equal(m.ok, true);
});

test('a cube wound inward everywhere is one inside-out shell, and the mended copy faces out', () => {
  let t = cubeTris(20); for (let f = 0; f < 12; f++) t = flipFace(t, f);
  const r = check(binaryStl(t)); assert.equal(r.flippedFaces, 0); assert.equal(r.insideOutShells, 1); assert.equal(r.ok, false); assert.match(r.verdict, /1 shell inside out/);
  assert.equal(analyze(mend(parseStl(binaryStl(t)))).insideOutShells, 0);
});

test('ASCII and binary STL of the same cube read to the same numbers', () => {
  const t = cubeTris(20), a = check(asciiStl(t, 'cube')), b = check(binaryStl(t));
  assert.equal(a.format, 'ascii'); assert.equal(a.name, 'cube'); assert.equal(b.format, 'binary');
  for (const k of ['triangles', 'vertices', 'openEdges', 'nonManifoldEdges', 'flippedFaces', 'shells', 'watertight', 'ok']) assert.equal(a[k], b[k], k);
  assert.deepEqual(a.size, b.size); assert.equal(a.volume, b.volume); assert.equal(a.area, b.area);
  // an ASCII file that starts "solid" but is binary (some exporters do this) is read as binary by its length
  const bin = binaryStl(t, 'solid but binary'); assert.equal(parseStl(bin).format, 'binary'); assert.equal(check(bin).ok, true);
});

test('a degenerate face is counted (and a slicer can still take a closed mesh with one); a duplicate face is counted and set aside', () => {
  const t = cubeTris(20), deg = new Float32Array(t.length + 9); deg.set(t); deg.set([0, 0, 0, 10, 0, 0, 20, 0, 0], t.length); // three corners on one line
  const r = check(binaryStl(deg)); assert.equal(r.degenerate, 1); assert.equal(r.triangles, 13);
  const collapsed = new Float32Array(t.length + 9); collapsed.set(t); collapsed.set([5, 5, 5, 5, 5, 5, 6, 6, 6], t.length);
  const c = check(binaryStl(collapsed)); assert.equal(c.degenerate, 1); assert.equal(c.collapsed, 1); assert.equal(c.watertight, true);
  const dup = new Float32Array(t.length + 9); dup.set(t); dup.set(t.subarray(0, 9), t.length);
  const d = check(binaryStl(dup)); assert.equal(d.duplicates, 1); assert.equal(d.watertight, true); assert.equal(d.nonManifoldEdges, 0); assert.ok(Math.abs(d.area - 2400) < 1e-6, 'a repeated face adds no area: ' + d.area);
});

test('non-manifold edges, separate shells, crossing faces and the weld tolerance', () => {
  const a = cubeTris(20), b = cubeTris(20).map((v, i) => v + (i % 3 === 0 ? 20 : 0)); // two cubes side by side sharing a face's edges
  const two = new Float32Array(a.length + b.length); two.set(a); two.set(b, a.length);
  const r = check(binaryStl(two)); assert.ok(r.nonManifoldEdges > 0, 'shared edges are used by four faces'); assert.equal(r.watertight, false);
  const apart = Float32Array.from(two, (v, i) => (i >= a.length && i % 3 === 0 ? v + 5 : v)); const s = check(binaryStl(apart)); assert.equal(s.shells, 2); assert.equal(s.ok, true);
  const inside = Float32Array.from(two, (v, i) => (i < a.length ? v : v + [-10, 5, 5][i % 3])); // the second cube pushed halfway into the first
  const x = check(binaryStl(inside)); assert.ok(x.selfIntersections > 0, 'two cubes overlapping cross each other'); assert.equal(x.ok, false);
  // a corner moved by half a micron welds back at the default 1 µm tolerance, and does not at 0.1 µm
  const nudged = cubeTris(20); nudged[0] += 0.0005; assert.equal(check(binaryStl(nudged)).watertight, true); assert.equal(check(binaryStl(nudged), { tol: 0.0001 }).watertight, false);
  assert.equal(weld(cubeTris(1)).positions.length / 3, 8);
});

test('a short, empty or cut-off file says what is wrong', () => {
  assert.match(check(new Uint8Array(0)).verdict, /empty/);
  const cut = binaryStl(cubeTris(20)).slice(0, 84 + 50 * 5); const p = parseStl(cut); assert.equal(p.count, 5); assert.match(p.problems[0], /cut short/);
});

test('the forge\'s own STL files read back the way printCheck reads its model: no open edge, nothing flipped, outward, the same volume; and the edges printCheck lets through are named', () => {
  for (const key of ['vase', 'rocket']) {
    const m = build(key), r = check(new Uint8Array(forgeStl(m)), { tol: 1e-7 }), pc = printCheck(m);
    assert.equal(r.openEdges, 0, key); assert.equal(r.flippedFaces, 0, key); assert.equal(r.insideOutShells, 0, key); assert.equal(pc.outward, true, key);
    assert.ok(Math.abs(r.volume / 1000 - pc.volumeCm3) <= 0.1, key + ': ' + r.volume / 1000 + ' vs ' + pc.volumeCm3);
    // printCheck calls a mesh closed when under 0.1% of its edges are not shared by two faces; this check names every one
    const I = m.indices, c = new Map(); for (let t = 0; t < I.length; t += 3) for (const [p, q] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) { const k = Math.min(p, q) + ',' + Math.max(p, q); c.set(k, (c.get(k) || 0) + 1); }
    const bad = [...c.values()].filter((n) => n !== 2).length;
    assert.equal(r.nonManifoldEdges + r.openEdges, bad, key); assert.equal(r.watertight, bad === 0, key);
  }
  assert.equal(check(new Uint8Array(forgeStl(build('vase')))).ok, true, 'the vase is ready for the slicer');
});

test('the report: plain text with every number, JSON without the mesh, and the verdict line first', () => {
  const r = check(sample('hole')), t = reportText(r, 'hole.stl');
  assert.match(t, /^STL check: hole\.stl\nNot watertight/); for (const w of ['Triangles: 11', 'Vertices: 8', 'Open edges: 3 (1 hole)', 'Watertight: no', 'Self-intersections: 0', 'not uploaded']) assert.ok(t.includes(w), w);
  const j = reportJson(r, 'hole.stl'); assert.equal(j.mesh, undefined); assert.equal(j.openEdges, 3); assert.equal(JSON.parse(JSON.stringify(j)).file, 'hole.stl');
  assert.equal(verdict({ triangles: 0, problems: ['the file is empty'] }), 'Not an STL that can be checked: the file is empty');
});

test('the stage skill (skills/stl-check.js) takes the asks for the checker and leaves the forge\'s own asks alone; the tool bar sends them to /stl/', async () => {
  const skill = (await import('../void-live-deploy/skills/stl-check.js')).default, { routeAsk } = await import('../void-live-deploy/lib/toolkit.js');
  for (const a of ['check my stl file', 'is my stl watertight?', 'stl checker', 'check my stl for holes', 'Is this STL file printable', 'does my stl have holes', 'check the watertightness of my stl']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['download the stl', 'print it', 'check it before printing', 'make me a vase', 'what is an stl file', 'check my email']) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['check my stl file', 'is my stl watertight', 'stl checker']) assert.equal(routeAsk(a), '/stl/', a);
  assert.equal(skill.name, 'stl-check'); assert.equal(typeof skill.run, 'function');
});
