// The build-world family (skills/build-world.js, lists run 15, 2026-11-09): rts and forge are one routing entry, every old ask still
// reaches the member that answered it, both old names stay as parts, and the family sits at rts's old place, right after intent (0112: intent shares 0110 and sorts before rts, not before build-world).
// Run: node --test tools/build-world-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/build-world.js';
import rts from '../void-live-deploy/skills/rts.js';
import forge from '../void-live-deploy/skills/forge.js';
import stlCheck from '../void-live-deploy/skills/stl-check.js';

test('every example of both old skills lands on the same member as before (rts first, as before)', () => {
  for (const a of rts.examples) assert.equal(fam.part(a.toLowerCase(), a), 'rts', a);
  for (const a of forge.examples) {
    const before = rts.match(a.toLowerCase(), a) ? 'rts' : 'forge';
    assert.equal(fam.part(a.toLowerCase(), a), before, a);
  }
  // the ask both took (tools/skill-overlap.mjs): rts answered it first and still does
  assert.equal(fam.part('build a hut', 'build a hut'), 'rts');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('stl-check, which sat between them, keeps its asks: forge takes none of them', () => {
  for (const a of [...stlCheck.examples, ...(stlCheck.nearMisses || [])]) if (stlCheck.match(a.toLowerCase(), a)) assert.equal(forge.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['rts', 'forge']);
  assert.equal(typeof forge.forgeOf, 'function', 'forgeOf stays on the forge member');
  assert.ok(fam.stageKinds && Object.keys(forge.stageKinds || {}).every((k) => k in fam.stageKinds), 'the forge stage kinds come along');
  assert.equal(typeof fam.decorate, 'function', 'the rts decorator still runs');
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('build-world'));
  assert.ok(!index.includes('rts') && !index.includes('forge'));
  assert.ok(index.indexOf('build-world') === index.indexOf('intent') + 1, 'the family sits where rts sat, right after intent');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0112-build-world', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0110-rts', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0120-forge', import.meta.url)));
});
