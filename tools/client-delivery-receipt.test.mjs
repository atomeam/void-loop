// client-delivery-receipt skill: client-facing receipt of the full delivery package.
// Run: node --test tools/client-delivery-receipt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientDeliveryReceipt } from '../void-live-deploy/skills/client-delivery-receipt.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isClientDeliveryReceipt(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isClientDeliveryReceipt(a), false, a);
});

test('suite reports ok', () => {
  assert.equal(skill.suite().ok, true);
});
