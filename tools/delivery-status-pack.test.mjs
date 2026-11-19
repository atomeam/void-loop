// delivery-status-pack skill: a client-facing living status of the heavy lifting Verse owns.
// Run: node --test tools/delivery-status-pack.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isDeliveryStatus, subjectOf, statusFor } from '../void-live-deploy/skills/delivery-status-pack.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isDeliveryStatus(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isDeliveryStatus(a), false, a);
});

test('extracts the subject and builds a status pack', () => {
  const s = subjectOf('delivery status for the onboarding automation');
  assert.equal(s, 'onboarding automation');
  const pack = statusFor(s);
  assert.ok(pack.systems.length >= 3);
  assert.ok(pack.automations.length >= 2);
  assert.ok(pack.clientDoesLess.length >= 2);
  assert.ok(pack.next.includes('handoff'));
});
