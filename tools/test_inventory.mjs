// One suite check for "what's already built". Empty ask stays empty.
import assert from 'node:assert/strict';
import { inventoryOf, SKILLS_BUILT } from '../void-live-deploy/skills/inventory.js';

assert.equal(inventoryOf("what's already built")?.kind, 'all');
assert.equal(inventoryOf(''), null);
assert.equal(inventoryOf('have we built tip')?.q, 'tip');
for (const id of ['part', 'figure', 'tip', 'inventory']) {
  assert.ok(SKILLS_BUILT.some((s) => s.id === id), id);
}
console.log('inventory ok');
