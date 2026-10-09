import test from 'node:test';
import assert from 'node:assert/strict';
import { motorbodyOf, pentamoteParts, pentamote3mf, PENTAMOTE, MATERIALS } from '../void-live-deploy/skills/motorbody.js';
import { printFileOf } from '../void-live-deploy/skills/print-file.js';

// read back a STORE zip (what zipStore writes): name -> text
function unzip(bytes) {
  const out = {}, dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  for (let p = 0; dv.getUint32(p, true) === 0x04034b50;) {
    const size = dv.getUint32(p + 18, true), nlen = dv.getUint16(p + 26, true), xlen = dv.getUint16(p + 28, true);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nlen)), at = p + 30 + nlen + xlen;
    out[name] = dec.decode(bytes.subarray(at, at + size)); p = at + size;
  }
  return out;
}

test('the motor-body asks open Pentamote-1, and the stage export keeps its own asks', () => {
  for (const t of ['download the printed motor as 3mf', 'show the multi-material print file', 'Pentamote-1', 'summon pentamote', 'download a 3mf of the printed motor', 'export the multi-material motor as a print file', 'show the five-material motor'])
    assert.ok(motorbodyOf(t), t);
  for (const t of ['download a 3mf of the stage', 'export a print file', 'can you 3d print a motor', 'what is a 3mf file', 'summon linemote-1', 'show the magnetize step'])
    assert.ok(!motorbodyOf(t), t);
  assert.ok(printFileOf('download a 3mf of the stage'));
});

test('every part is a closed, outward-facing mesh holding exactly its own boxes (so no two parts overlap)', () => {
  const parts = pentamoteParts();
  assert.deepEqual(parts.map((p) => p.name), ['dielectric', 'conductive', 'soft-magnetic', 'hard-magnetic', 'flexible']);
  parts.forEach((p, m) => {
    const edges = new Map(), k = (v) => v.join(','); let vol = 0;
    for (const [a, b, c] of p.tris) {
      vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      for (const [u, v] of [[a, b], [b, c], [c, a]]) { const e = k(u) + '>' + k(v); edges.set(e, (edges.get(e) || 0) + 1); }
    }
    for (const [e, n] of edges) { const [u, v] = e.split('>'); assert.ok(n === 1 && edges.get(v + '>' + u) === 1, p.name + ' edge ' + e); }
    const boxes = PENTAMOTE.boxes[m].reduce((s, b) => s + (b[1] - b[0]) * (b[3] - b[2]) * (b[5] - b[4]), 0);
    assert.ok(Math.abs(vol - boxes) < 1e-6, p.name + ' volume ' + vol + ' vs its boxes ' + boxes);
  });
});

test('the 3MF has the slot-tested layout: five build items, one colour group per part, names, and extruders 1-5 for PrusaSlicer', () => {
  const files = unzip(pentamote3mf()), model = files['3D/3dmodel.model'], config = files['Metadata/Slic3r_PE_model.config'];
  assert.ok(files['[Content_Types].xml'] && files['_rels/.rels'] && model && config);
  assert.match(model, /xmlns:m="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/material\/2015\/02"/);
  const objs = [...model.matchAll(/<object id="(\d+)" type="model" name="([^"]+)" pid="(\d+)" pindex="0">/g)].map((x) => [+x[1], x[2], +x[3]]);
  assert.deepEqual(objs.map((o) => o[1]), MATERIALS.map((m) => m.name));
  assert.deepEqual(objs.map((o) => o[2]), [2, 3, 4, 5, 6]);
  const groups = [...model.matchAll(/<m:colorgroup id="(\d+)">(.*?)<\/m:colorgroup>/g)];
  assert.equal(groups.length, 5);
  groups.forEach((g, i) => { assert.equal(+g[1], 2 + i); assert.equal((g[2].match(/<m:color /g) || []).length, 1); });
  assert.deepEqual([...model.matchAll(/<base name="([^"]+)"/g)].map((x) => x[1]), MATERIALS.map((m) => m.name));
  assert.deepEqual([...model.matchAll(/<item objectid="(\d+)"\/>/g)].map((x) => +x[1]), objs.map((o) => o[0]));
  const tris = [...model.matchAll(/<object id="\d+"[^>]*>(.*?)<\/object>/g)].map((x) => (x[1].match(/<triangle /g) || []).length);
  const cfg = [...config.matchAll(/<object id="(\d+)"[\s\S]*?key="extruder" value="(\d)"[\s\S]*?<volume firstid="0" lastid="(\d+)">/g)].map((x) => [+x[1], +x[2], +x[3]]);
  assert.deepEqual(cfg, objs.map((o, i) => [o[0], i + 1, tris[i] - 1]));
});
