// The shop family (skills/shop.js, lists run 7, 2026-10-28): store and services are one routing entry, each old ask still reaches the
// member that answered it before, and both old names stay as parts (aliases). Run: node --test tools/shop-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/shop.js';
import store from '../void-live-deploy/skills/store.js';
import services from '../void-live-deploy/skills/services.js';

const before = (a) => (store.match(a.toLowerCase(), a) ? 'store' : services.match(a.toLowerCase(), a) ? 'services' : null); // the old order: 1035, then 1040
test('every example of both old skills lands on the same member as before the merge', () => {
  const asks = [...(store.examples || []), ...(services.examples || []), 'what can i buy', 'pricing', 'hire you'];
  assert.ok(asks.length >= 10);
  for (const a of asks) { assert.equal(fam.part(a.toLowerCase(), a), before(a), a); assert.ok(before(a), 'still answered: ' + a); }
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['store', 'services']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('shop')); assert.ok(!index.includes('store') && !index.includes('services'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1035-shop', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1040-services', import.meta.url)));
});
test('near misses of either member still miss the family, and the store self-check still runs', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  assert.equal(fam.suite().ok, true);
});
