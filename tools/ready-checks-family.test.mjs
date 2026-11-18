// The ready-checks family (skills/ready-checks.js, lists run 26, 2026-11-18): delivery-ready and handoff-ready are one routing entry,
// every old ask still reaches the member that answered it, both old names stay as parts, delivery-ready's self-test runs as the family's,
// and the family sits where delivery-ready sat (10120).
// Run: node --test tools/ready-checks-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/ready-checks.js';
import deliveryReady from '../void-live-deploy/skills/delivery-ready.js';
import handoffReady from '../void-live-deploy/skills/handoff-ready.js';

test('every example of both old skills lands on the same member as before (delivery-ready first, as before)', () => {
  for (const a of deliveryReady.examples) assert.equal(fam.part(a.toLowerCase(), a), 'delivery-ready', a);
  for (const a of handoffReady.examples) assert.equal(fam.part(a.toLowerCase(), a), deliveryReady.match(a.toLowerCase(), a) ? 'delivery-ready' : 'handoff-ready', a);
  assert.equal(fam.part('is this system handoff ready', 'is this system handoff ready'), 'delivery-ready', 'the overlapping ask stays with delivery-ready');
  const only = 'what is missing for client handoff on the status reports';
  assert.equal(fam.part(only, only), 'handoff-ready', 'handoff-ready still answers its own ask');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  for (const a of ['ready', 'handoff pack', 'full handoff', 'is it ready']) assert.equal(fam.match(a, a), false, a);
});
test('delivery-ready\'s self-test is the family\'s', () => {
  assert.equal(typeof fam.suite, 'function'); assert.ok(fam.suite().ok);
});
test('the old names are kept as parts, the family takes one place in the order, where delivery-ready sat', () => {
  assert.deepEqual(fam.parts, ['delivery-ready', 'handoff-ready']);
  const order = readOrder();
  assert.ok(order.includes('ready-checks'));
  assert.ok(!order.includes('delivery-ready') && !order.includes('handoff-ready'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/10120-ready-checks', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/10120-delivery-ready', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/11010-handoff-ready', import.meta.url)));
});
