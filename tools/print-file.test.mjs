// The stage's 3MF is checked before it is handed over (Void's ask, 2026-10-10: "a verification step in the 'print-file'
// skill that checks the integrity of held-files before finalizing"): print-file.js verify3mf opens the package it just
// built and holds it to the triangles it came from. Run: node --test tools/print-file.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import printFile, { stage3mf, stageTriangles, verify3mf, zipStore, modelXml } from '../void-live-deploy/skills/print-file.js';

const stage = { c: { id: 'c', kind: 'fig3d', model: 'chair' }, m: { id: 'm', kind: 'fig3d', model: 'motelet' } };

test('print-file: the package built from the stage passes its own check (a well-formed zip, every part whole, the model its triangles)', () => {
  const tris = stageTriangles(stage), file = stage3mf(stage), v = verify3mf(file, tris);
  assert.ok(tris.length > 10);
  assert.ok(v.ok, v.problems.join('; '));
  assert.equal(v.triangles, tris.length);
  assert.deepEqual(v.parts, ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
});

test('print-file: a damaged or mismatched package fails, and says why', () => {
  const tris = stageTriangles(stage), good = stage3mf(stage);
  const flipped = good.slice(); const at = new TextDecoder().decode(good).indexOf('<triangle'); flipped[at + 12] ^= 0x01; // one byte of the model changed
  assert.match(verify3mf(flipped, tris).problems.join(' '), /does not match its checksum/);
  assert.match(verify3mf(good.slice(0, good.length - 10), tris).problems.join(' '), /not a whole zip/);
  assert.match(verify3mf(good, tris.slice(1)).problems.join(' '), /triangles/);
  const noModel = zipStore([{ name: '[Content_Types].xml', data: '<x/>' }, { name: '_rels/.rels', data: '<x/>' }]);
  assert.match(verify3mf(noModel, tris).problems.join(' '), /3D\/3dmodel\.model/);
  const bad = [[[0, 0, 0], [0, 0, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [0, 1, NaN]]];
  const badFile = zipStore([{ name: '[Content_Types].xml', data: '<x/>' }, { name: '_rels/.rels', data: '<x/>' }, { name: '3D/3dmodel.model', data: modelXml(bad) }]);
  const vb = verify3mf(badFile, bad);
  assert.match(vb.problems.join(' '), /collapsed/); assert.match(vb.problems.join(' '), /not a number/);
});

test('print-file: "export a print file" hands over only a package that passed; one that fails is not saved and the reason is said', async () => {
  const said = [], api = { stage: { things: () => stage }, say: (s) => said.push(s) };
  let saved = 0;
  globalThis.document = { createElement: () => ({ click() { saved++; }, remove() {} }), body: { appendChild() {} } };
  const real = { c: URL.createObjectURL, r: URL.revokeObjectURL }; URL.createObjectURL = () => 'blob:x'; URL.revokeObjectURL = () => {};
  try {
    await printFile.run('export a print file', api);
    assert.equal(saved, 1); assert.match(said.at(-1), /^Checked: void-stage\.3mf · 2 on the stage · \d+ triangles/);
    await printFile.run('export a print file', api, () => ({ ok: false, problems: ['3D/3dmodel.model does not match its checksum'], triangles: 0, parts: [] }));
    assert.equal(saved, 1, 'nothing saved');
    assert.match(said.at(-1), /^Not saved: the stage's print file did not pass its check · 3D\/3dmodel\.model does not match its checksum/);
  } finally { delete globalThis.document; URL.createObjectURL = real.c; URL.revokeObjectURL = real.r; }
});
