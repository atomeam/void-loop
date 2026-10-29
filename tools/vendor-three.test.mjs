// three.js's build was dropped from main by a merge (2026-10-15, 6b97df33) and every 3D board fell back to flat on the next
// deploy: keep the vendored build, the HDR loader and the studio HDRI in the tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';

test('the vendored three.js build, its HDR loader and the studio HDRI are in the tree', () => {
  const r = new URL('../void-live-deploy/', import.meta.url);
  for (const f of ['vendor/three-r180a/build/three.module.min.js', 'vendor/three-r180a/build/three.core.min.js', 'vendor/three-r180a/addons/HDRLoader.js', 'models/hdri/brown_photostudio_02_1k.hdr']) {
    const p = new URL(f, r); assert.ok(existsSync(p) && statSync(p).size > 1000, f + ' is missing');
  }
});
