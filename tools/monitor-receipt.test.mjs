// monitor-receipt skill: a client-facing receipt of monitors and automations Verse owns.
// Run: node --test tools/monitor-receipt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isMonitorReceipt, subjectOf, receiptFor } from '../void-live-deploy/skills/monitor-receipt.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isMonitorReceipt(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isMonitorReceipt(a), false, a);
});

test('extracts the subject and builds a receipt', () => {
  const s = subjectOf('monitor receipt for the onboarding automation');
  assert.equal(s, 'onboarding automation');
  const pack = receiptFor(s);
  assert.ok(pack.monitors.length >= 3);
  assert.ok(pack.statusStyle.includes('status'));
  assert.ok(pack.next.includes('systems monitor'));
});
