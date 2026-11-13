import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isHandoffNext, subjectOf } from '../void-live-deploy/skills/handoff-next.js';

test('handoff-next matches its asks and leaves status and slice alone', () => {
  assert.equal(isHandoffNext('next handoff for the onboarding flow'), true);
  assert.equal(isHandoffNext('handoff next for invoice automation'), true);
  assert.equal(isHandoffNext('what is the next handoff for the support router'), true);
  assert.equal(subjectOf('next handoff for the onboarding flow'), 'onboarding flow');
  assert.equal(isHandoffNext('system status for the onboarding flow'), false);
  assert.equal(isHandoffNext('next system slice for onboarding'), false);
  assert.equal(isHandoffNext('what is a handoff'), false);
});

test('handoff-next keeps the skill contract: the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
});
