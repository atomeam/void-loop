// client-confirm-pack skill: a client-facing card of the few confirms left against everything Verse owns.
// Run: node --test tools/client-confirm-pack.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientConfirm, subjectOf, confirmPackFor } from '../void-live-deploy/skills/client-confirm-pack.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isClientConfirm(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isClientConfirm(a), false, a);
});

test('extracts the subject and builds a confirm pack', () => {
  const s = subjectOf('confirm pack for the onboarding system');
  assert.equal(s, 'onboarding system');
  const pack = confirmPackFor(s);
  assert.ok(pack.clientConfirms.length >= 2);
  assert.ok(pack.verseOwns.length >= 3);
  assert.ok(pack.clientDoesLess.length >= 2);
  assert.ok(pack.next.includes('delivery status'));
});
