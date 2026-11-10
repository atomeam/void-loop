// handoff-checklist skill: a reliable checklist for handing a system to a client.
// Run: node --test tools/handoff-checklist.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isHandoffChecklist, subjectOf, checklistFor } from '../void-live-deploy/skills/handoff-checklist.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isHandoffChecklist(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isHandoffChecklist(a), false, a);
});

test('extracts the subject and builds a checklist', () => {
  const s = subjectOf('handoff checklist for the onboarding automation');
  assert.equal(s, 'onboarding automation');
  const pack = checklistFor(s);
  assert.ok(pack.items.length >= 5);
  assert.ok(pack.items[0].includes('Status'));
});
