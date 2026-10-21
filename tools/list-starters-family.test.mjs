// The list-starters family (skills/list-starters.js, lists run 3, 2026-10-21): template-list and list-templates are one routing entry, each old
// ask still reaches the member that answered it before, and both old names stay as parts (aliases). Run: node --test tools/list-starters-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import starters from '../void-live-deploy/skills/list-starters.js';
import templateList from '../void-live-deploy/skills/template-list.js';
import listTemplates from '../void-live-deploy/skills/list-templates.js';

const before = (a) => (templateList.match(a.toLowerCase(), a) ? 'template-list' : listTemplates.match(a.toLowerCase(), a) ? 'list-templates' : null); // the old order: 451, then 1531
test('every example of both old skills lands on the same member as before the merge', () => {
  const asks = [...(templateList.examples || []), ...(listTemplates.examples || []), 'packing list template', 'packing list template for a beach trip', 'reading list template'];
  assert.ok(asks.length >= 6);
  for (const a of asks) { assert.equal(starters.part(a.toLowerCase(), a), before(a), a); assert.ok(before(a), 'still answered: ' + a); }
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(starters.parts, ['template-list', 'list-templates']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('list-starters')); assert.ok(!index.includes('template-list') && !index.includes('list-templates'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0451-list-starters', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1531-list-templates', import.meta.url)));
});
test('near misses of either member still miss the family', () => {
  for (const a of starters.nearMisses) assert.equal(starters.match(a.toLowerCase(), a), false, a);
});
