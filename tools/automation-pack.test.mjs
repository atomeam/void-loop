import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isAutomationPack, subjectOf } from '../void-live-deploy/skills/automation-pack.js';

test('automation-pack matches its asks and leaves monitor-pack and system-slice alone', () => {
  assert.equal(isAutomationPack('automation pack for invoice reminders'), true);
  assert.equal(isAutomationPack('what automations will Verse own for onboarding'), true);
  assert.equal(isAutomationPack('propose automations for the support router'), true);
  assert.equal(subjectOf('automation pack for invoice reminders'), 'invoice reminders');
  assert.equal(isAutomationPack('monitor pack for Acme'), false);
  assert.equal(isAutomationPack('system slice for onboarding'), false);
  assert.equal(isAutomationPack('what is an automation'), false);
});

test('automation-pack keeps the skill contract: the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
});
