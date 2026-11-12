// The ownership family (skills/ownership.js, lists run 17, 2026-11-11): heavy-lift-map, ownership-map and ownership-pack are one routing
// entry, every old ask still reaches the member that answered it, the old names stay as parts, and the family sits where heavy-lift-map sat.
// Run: node --test tools/ownership-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/ownership.js';
import heavyLiftMap from '../void-live-deploy/skills/heavy-lift-map.js';
import ownershipMap from '../void-live-deploy/skills/ownership-map.js';
import ownershipPack from '../void-live-deploy/skills/ownership-pack.js';

const before = (a) => [heavyLiftMap, ownershipMap, ownershipPack].find((m) => m.match(a.toLowerCase(), a))?.name;

test('every example of the three old skills lands on the same member as before (old order kept)', () => {
  for (const a of heavyLiftMap.examples) assert.equal(fam.part(a.toLowerCase(), a), 'heavy-lift-map', a);
  for (const a of [...ownershipMap.examples, ...ownershipPack.examples]) assert.equal(fam.part(a.toLowerCase(), a), before(a), a);
  // the asks the overlap check named: ownership-map answered "ownership map for ..." before ownership-pack, and still does
  assert.equal(fam.part('ownership map for weekly reports', 'ownership map for weekly reports'), 'ownership-map');
  assert.equal(fam.part('ownership pack for acme', 'ownership pack for Acme'), 'ownership-pack');
});
test('the near misses of the three stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where heavy-lift-map sat', () => {
  assert.deepEqual(fam.parts, ['heavy-lift-map', 'ownership-map', 'ownership-pack']);
  const order = readOrder();
  assert.ok(order.includes('ownership'));
  for (const n of fam.parts) assert.ok(!order.includes(n), n);
  assert.ok(order.indexOf('ownership') === order.indexOf('groups') + 1, 'the family sits where heavy-lift-map sat, right after groups');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/9860-ownership', import.meta.url)));
  for (const f of ['9860-heavy-lift-map', '9890-ownership-map', '9930-ownership-pack']) assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/' + f, import.meta.url)), f);
});
