// The forge (frontier #14, first piece): "make me a <thing>" for things no figure covers, as a model and a printable STL.
// Run: node --test tools/forge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/skills/forge-rules.js';
import forge, { forgeOf, fileName, printOrRefuse } from '../void-live-deploy/skills/forge.js';
import { natureSummon } from '../void-live-deploy/skills/figures.js';
import figureSkill from '../void-live-deploy/skills/figure.js';

const KEYS = Object.keys(F.THINGS);

test('forge: summoned by the asks people type for the things it can make, and not by look-alikes', () => {
  for (const [ask, key] of [['make me a rocket', 'rocket'], ['Make a vase', 'vase'], ['3d print a bottle', 'bottle'], ['forge a lighthouse', 'lighthouse'], ['build me a snowman', 'snowman'],
    ['make me a table i can print', 'table'], ['make me a 3d wine bottle', 'bottle'], ['can you make a rocket ship?', 'rocket'], ['print a clay vase', 'vase'], ['make me a teapot', 'teapot'], ['make a little house', 'house'], ['3d print a sailboat', 'boat'], ['make me a boat', 'boat'], ['forge an oak tree', 'tree']])
    assert.deepEqual(forgeOf(ask), { make: key }, ask);
  for (const ask of ['print it', 'Print it!', 'download the stl', 'stl file', 'give me the stl', 'save it as an stl']) assert.deepEqual(forgeOf(ask), { print: true }, ask);
  for (const ask of ['make me a coffee', 'make a reservation', 'print the page', 'table of contents', 'what is a rocket', 'make me a zombie', 'make a list', 'make a 3d torus', 'rocket league', 'make me a mug', 'make a chair'])
    assert.equal(forgeOf(ask), null, ask);
  for (const e of forge.examples) assert.ok(forge.match(e.toLowerCase(), e), e);
  for (const e of forge.nearMisses) assert.ok(!forge.match(e.toLowerCase(), e), e);
});

test('forge: only things no figure covers yet (a figure ask never comes here, a forge ask never summons a figure)', () => {
  for (const k of KEYS) for (const n of F.THINGS[k].names) {
    assert.equal(natureSummon('make a ' + n), null, n + ' is not a figure kind');
    for (const ask of ['make a ' + n, 'make me a ' + n]) assert.equal(figureSkill.match(ask, ask), false, ask + ' is not one of figure.js\'s things (chair, cup, mug, book, lamp)');
    assert.equal(F.thingOf(n), k);
  }
  assert.equal(F.thingOf('zombie'), null);
});

test('forge: every thing meshes into a closed, outward-facing, printable body', () => {
  for (const k of KEYS) {
    const m = F.build(k), P = m.positions, I = m.indices;
    assert.ok(I.length / 3 > 5000, k + ' has real detail');
    // fits the bed and rests on it
    assert.ok(Math.max(...m.size) <= F.BED_MM, k + ' fits a ' + F.BED_MM + ' mm cube: ' + m.size);
    assert.ok(Math.min(...m.size) >= 30, k + ' is big enough to hold: ' + m.size);
    let minY = Infinity, base = 0; for (let i = 1; i < P.length; i += 3) { minY = Math.min(minY, P[i]); if (P[i] < 0.8) base++; }
    assert.ok(Math.abs(minY) < 1e-6, k + ' rests at y = 0');
    assert.ok(base > 40, k + ' has a flat base to print on (' + base + ' vertices on the bed)');
    // closed: almost every edge is shared by exactly two triangles (surface nets leave a handful of pinched seams a slicer mends)
    const edges = new Map();
    for (let t = 0; t < I.length; t += 3) for (const [a, b] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) { const e = a < b ? a * 4194304 + b : b * 4194304 + a; edges.set(e, (edges.get(e) || 0) + 1); }
    let bad = 0; for (const c of edges.values()) if (c !== 2) bad++;
    assert.ok(bad / edges.size < 0.001, k + ': ' + bad + ' of ' + edges.size + ' edges not shared by two faces');
    // outward: the signed volume is positive
    let vol = 0; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6; }
    assert.ok(vol > 10000, k + ' faces outward (volume ' + Math.round(vol) + ' mm³)');
  }
});

test('forge: printCheck says what a slicer will find, for every thing, from the mesh alone', () => {
  for (const k of KEYS) {
    const m = F.build(k), c = F.printCheck(m);
    assert.ok(c.ok && c.fits && c.closed && c.outward, k + ' is printable as it is: ' + c.notes.join(' · '));
    assert.equal(c.triangles, m.indices.length / 3);
    assert.ok(c.volumeCm3 > 50 && c.volumeCm3 < 700, k + ' volume ' + c.volumeCm3 + ' cm³');
    assert.equal(c.grams, Math.round(c.volumeCm3 * F.PLA_G_PER_CM3), k + ' grams follow the volume');
    assert.equal(c.supports, c.overhangPct >= F.OVERHANG_PCT); assert.equal(c.brim, !c.stands);
    assert.equal(c.notes.length, 5); assert.match(c.notes[0], /fits a 180 mm bed/); assert.match(c.notes[2], /watertight/);
    assert.match(c.notes[3], c.supports ? /print with supports/ : /no supports needed/);
    assert.match(c.notes[1], c.stands ? /stands on its base/ : /print with a brim/);
  }
  // the table top, the sail and the canopy lean out over nothing: supports; a vase, a lighthouse and a house print plain
  for (const k of ['table', 'boat', 'tree']) assert.ok(F.printCheck(F.build(k)).supports, k + ' needs supports');
  for (const k of ['vase', 'lighthouse', 'house', 'bottle']) assert.ok(!F.printCheck(F.build(k)).supports, k + ' prints without supports');
  // a rocket on its fin tips and a boat on its keel want a brim; a house and a lighthouse stand on a wide base
  for (const k of ['rocket', 'boat']) assert.ok(F.printCheck(F.build(k)).brim, k + ' gets a brim');
  for (const k of ['house', 'lighthouse', 'vase', 'teapot']) assert.ok(F.printCheck(F.build(k)).stands, k + ' stands');
  // a made-up open shell is not watertight and faces nowhere: one triangle
  const one = F.printCheck({ positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]), indices: [0, 1, 2], size: [10, 10, 0] });
  assert.ok(!one.closed && !one.ok, 'an open sheet is not printable');
  assert.match(one.notes[2], /open edges: 3/);
});

test('forge: the bottle and the vase are hollow and open at the neck; the snowman has its arms out', () => {
  const B = F.build('bottle').positions; let inside = 0, mouth = 0;
  for (let i = 0; i < B.length; i += 3) { const r = Math.hypot(B[i], B[i + 2]); if (r > 22 && r < 29 && B[i + 1] > 20 && B[i + 1] < 90) inside++; if (r < 8 && B[i + 1] > 110) mouth++; }
  assert.ok(inside > 200, 'a wall inside the bottle (hollow)'); assert.ok(mouth > 30, 'the neck is open');
  const s = F.build('snowman'); assert.ok(s.size[0] > s.size[2] + 20, 'its arms reach out to the sides: ' + s.size);
  const V = F.build('vase').positions; let neck = 0; for (let i = 0; i < V.length; i += 3) { const r = Math.hypot(V[i], V[i + 2]); if (r > 9 && r < 13.5 && V[i + 1] > 90) neck++; };
  assert.ok(neck > 50, 'the neck is open down into the body');
});

test('forge: the STL is the model, binary, millimetres, Z up, every facet with a unit normal', () => {
  for (const k of ['bottle', 'rocket']) {
    const m = F.build(k), buf = F.stl(m), dv = new DataView(buf), n = m.indices.length / 3;
    assert.equal(buf.byteLength, 84 + 50 * n);
    assert.equal(dv.getUint32(80, true), n);
    assert.match(String.fromCharCode(...new Uint8Array(buf, 0, 40)), /^Void forge: /);
    assert.doesNotMatch(String.fromCharCode(...new Uint8Array(buf, 0, 5)), /^solid/, 'binary STL never starts with "solid" (slicers would read it as ASCII)');
    let maxZ = 0, minZ = Infinity;
    for (let t = 0; t < n; t++) {
      const o = 84 + t * 50, nx = dv.getFloat32(o, true), ny = dv.getFloat32(o + 4, true), nz = dv.getFloat32(o + 8, true);
      const l = Math.hypot(nx, ny, nz); assert.ok(Math.abs(l - 1) < 1e-3 || l === 0, 'unit normal');
      for (let v = 0; v < 3; v++) { const z = dv.getFloat32(o + 12 + v * 12 + 8, true); maxZ = Math.max(maxZ, z); minZ = Math.min(minZ, z); }
    }
    assert.ok(Math.abs(minZ) < 1e-3, k + ' sits on Z = 0');
    assert.ok(Math.abs(maxZ - m.size[1]) < 0.2, k + ': its height is Z (' + maxZ + ' vs ' + m.size[1] + ')');
  }
  assert.equal(fileName('mug'), 'void-mug.stl');
});

test('forge: building is quick enough to do on an ask, and cached after', () => {
  const t0 = Date.now(); F.build('lighthouse'); const first = Date.now() - t0;
  const t1 = Date.now(); F.build('lighthouse'); const again = Date.now() - t1;
  assert.ok(first < 4000, 'first build ' + first + ' ms'); assert.ok(again < 5, 'cached ' + again + ' ms');
});

test('forge: the second four read as themselves (teapot spout and handle, house door and windows, sailboat sail, tree canopy over a trunk)', () => {
  const tp = F.build('teapot'); assert.ok(tp.size[0] > tp.size[2] + 40, 'spout and handle stick out: ' + tp.size);
  const H = F.build('house').positions; let door = 0;
  for (let i = 0; i < H.length; i += 3) if (Math.abs(H[i]) < 7 && H[i + 1] > 4 && H[i + 1] < 30 && H[i + 2] > 31 && H[i + 2] < 35) door++;
  assert.ok(door > 20, 'a door is cut into the front wall (' + door + ')');
  const b = F.build('boat'); assert.ok(b.size[1] > b.size[2] * 2.5, 'the mast and sail stand tall over a narrow hull: ' + b.size);
  const T = F.build('tree').positions; let wide = 0, trunk = 0;
  for (let i = 0; i < T.length; i += 3) { const r = Math.hypot(T[i], T[i + 2]); if (T[i + 1] > 90 && r > 40) wide++; if (T[i + 1] > 20 && T[i + 1] < 45 && r < 13) trunk++; }
  assert.ok(wide > 100 && trunk > 50, 'a wide canopy over a narrow trunk (' + wide + ', ' + trunk + ')');
  assert.equal(Object.keys(F.THINGS).length, 10, 'ten things, the number #14 asks for');
});

// Void's ask (2026-10-10): "a link between the forge and print-file so I can verify an object's geometry before the print
// command is issued". Before a file goes out, the STL bytes are read back and held to the model: the facet count, the
// file's length, every number finite, its extent the model's size, and the mesh a slicer takes as it is (printCheck.ok).
test('forge: before printing, the STL is read back and held to the model; every thing passes', () => {
  for (const key of Object.keys(F.THINGS)) {
    const m = F.build(key), v = F.verifyStl(F.stl(m), m);
    assert.ok(v.ok, key + ': ' + v.problems.join('; '));
    assert.equal(v.triangles, m.indices.length / 3, key);
  }
});

test('forge: a file that does not match its model, or a model a slicer would choke on, is never sent to print, and says why', () => {
  const m = F.build('rocket'), good = F.stl(m);
  const cut = good.slice(0, good.byteLength - 50); // one facet short of what the header says
  assert.match(F.verifyStl(cut, m).problems.join(' '), /facets/);
  const nan = good.slice(0); new DataView(nan).setFloat32(84 + 12, NaN, true);
  assert.match(F.verifyStl(nan, m).problems.join(' '), /not a number/);
  const holed = { ...m, indices: m.indices.slice(0, m.indices.length - 3 * 40) }; // forty triangles gone: open edges
  const vh = F.verifyStl(F.stl(holed), holed);
  assert.equal(vh.ok, false); assert.match(vh.problems.join(' '), /open edges/);
  const huge = { ...m, positions: m.positions.map((x) => x * 3), size: m.size.map((x) => x * 3) };
  assert.match(F.verifyStl(F.stl(huge), huge).problems.join(' '), /too big/);
  const other = F.build('vase'); // the right kind of file, for another thing
  assert.match(F.verifyStl(F.stl(other), m).problems.join(' '), /facets|extent/);
});

test('forge: "print it" and the Print button only download a file that passed; a failing one is refused with the reason', async () => {
  const said = [], say = (x) => said.push(x), th = { id: 't1', kind: 'forge', key: 'rocket' };
  let downloads = 0;
  globalThis.document = { createElement: () => ({ click() { downloads++; }, remove() {} }), body: { appendChild() {} } };
  const realURL = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:x'; URL.revokeObjectURL = () => {};
  try {
    await forge.run('print it', { stage: { things: () => ({ t1: th }), selected: () => 't1' }, say, summon() {} });
    assert.equal(downloads, 1); assert.match(said.at(-1), /^Checked and downloading void-rocket\.stl/);
    const m = F.build('rocket');
    assert.equal(printOrRefuse(m, say, () => ({ ok: false, problems: ['open edges: 12 (a slicer may need to mend it)'], triangles: 0 })), false);
    assert.equal(downloads, 1, 'nothing downloaded');
    assert.match(said.at(-1), /^Not printed: the rocket's file did not pass its check · open edges: 12/);
  } finally { delete globalThis.document; URL.createObjectURL = realURL.create; URL.revokeObjectURL = realURL.revoke; }
});
