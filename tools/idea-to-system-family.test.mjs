// The idea-to-system family (skills/idea-to-system.js, lists run 15, 2026-11-09): business-clarify and system-blueprint are one routing
// entry, every old ask still reaches the member that answered it, both old names stay as parts, and the family sits at
// business-clarify's old rank (9500). Run: node --test tools/idea-to-system-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/idea-to-system.js';
import businessClarify from '../void-live-deploy/skills/business-clarify.js';
import systemBlueprint from '../void-live-deploy/skills/system-blueprint.js';

test('every example of both old skills lands on the same member as before (business-clarify first, as at rank 9500)', () => {
  for (const a of businessClarify.examples) assert.equal(fam.part(a.toLowerCase(), a), 'business-clarify', a);
  for (const a of systemBlueprint.examples) {
    const before = businessClarify.match(a.toLowerCase(), a) ? 'business-clarify' : 'system-blueprint';
    assert.equal(fam.part(a.toLowerCase(), a), before, a);
  }
  // the ask both took (tools/skill-overlap.mjs): business-clarify answered it first and still does
  const both = 'structure this business idea for Verse to own the heavy lifting';
  assert.equal(fam.part(both.toLowerCase(), both), 'business-clarify');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['business-clarify', 'system-blueprint']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('idea-to-system'));
  assert.ok(!index.includes('business-clarify') && !index.includes('system-blueprint'));
  assert.ok(index.indexOf('idea-to-system') === index.indexOf('rentbuy') + 1, 'the family sits where business-clarify sat, right after rentbuy');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/9500-idea-to-system', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9500-business-clarify', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9800-system-blueprint', import.meta.url)));
});
