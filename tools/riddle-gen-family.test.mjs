// The riddle-gen family (skills/riddle-gen.js, lists run 12, 2026-11-05): riddle and textgen are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits at riddle's old rank.
// Run: node --test tools/riddle-gen-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/riddle-gen.js';
import riddle from '../void-live-deploy/skills/riddle.js';
import textgen from '../void-live-deploy/skills/textgen.js';

test('every example of both old skills lands on the same member as before (riddle first, as at rank 0295)', () => {
  for (const a of riddle.examples) assert.equal(fam.part(a.toLowerCase(), a), 'riddle', a);
  for (const a of textgen.examples) {
    const before = riddle.match(a.toLowerCase(), a) ? 'riddle' : 'textgen';
    assert.equal(fam.part(a.toLowerCase(), a), before, a);
  }
  // the ask both took (tools/skill-overlap.mjs): riddle answered it first and still does
  assert.equal(fam.part('give me a riddle', 'give me a riddle'), 'riddle');
  assert.equal(fam.part('band name generator', 'band name generator'), 'textgen');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['riddle', 'textgen']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('riddle-gen')); assert.ok(!index.includes('riddle') && !index.includes('textgen'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0295-riddle-gen', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0295-riddle', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1877-textgen', import.meta.url)));
});
