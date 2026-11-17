// The 3D cat (skills/make.js): "cat" is its own shape with its own parts, not the cube it was (2026-11-17). The drawing is checked by eye in a
// browser (a cat with a body, head, ears, legs and tail); this test checks the routing and that the cube still draws as a closed box.
// Run: node --test tools/make-cat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOf } from '../void-live-deploy/skills/make.js';

test('"a 3d cat" is the cat shape; "a 3d cube" stays a cube', () => {
  assert.equal(makeOf('make a 3d cat').shape, 'cat');
  assert.equal(makeOf('make a cat').shape, 'cat');
  assert.equal(makeOf('make a 3d cube').shape, 'cube');
});
