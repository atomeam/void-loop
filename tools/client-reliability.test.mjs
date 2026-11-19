import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { subjectOf } from '../void-live-deploy/skills/client-reliability.js';

test('client-reliability matches ownership asks', () => {
  assert.equal(!!skill.match('client reliability for the onboarding automation'.toLowerCase(), 'client reliability for the onboarding automation'), true);
  assert.equal(!!skill.match('package the monitoring verse owns for the support router'.toLowerCase(), 'package the monitoring Verse owns for the support router'), true);
  assert.equal(!!skill.match('what is reliability'.toLowerCase(), 'what is reliability'), false);
});

test('client-reliability extracts subject', () => {
  assert.equal(subjectOf('reliability ownership pack for invoice reminders'), 'invoice reminders');
  assert.equal(subjectOf('client reliability for the system'), 'the system');
});
