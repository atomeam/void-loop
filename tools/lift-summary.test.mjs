// lift-summary skill: a short client-facing package of "we own the heavy lifting".
// Run: node --test tools/lift-summary.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isLiftSummary, subjectOf, summaryFor } from '../void-live-deploy/skills/lift-summary.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isLiftSummary(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isLiftSummary(a), false, a);
});

test('extracts the subject and builds a summary', () => {
  const s = subjectOf('lift summary for client onboarding');
  assert.equal(s, 'client onboarding');
  const pack = summaryFor(s);
  assert.ok(pack.owns.length >= 3);
  assert.ok(pack.clientDoesLess.length >= 2);
  assert.ok(pack.next.includes('handoff'));
});
