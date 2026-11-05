import test from 'node:test';
import assert from 'node:assert/strict';
import { isSystemHandoff, systemOf } from '../void-live-deploy/skills/system-handoff.js';

test('a system handoff is its own ask, not a client handoff or a status check', () => {
  assert.equal(isSystemHandoff('system handoff for the onboarding automation'), true);
  assert.equal(isSystemHandoff('handoff the system: support ticket router'), true);
  assert.equal(systemOf('system handoff for invoice reminders'), 'invoice reminders');
  assert.equal(isSystemHandoff('client handoff for the onboarding automation'), false);
  assert.equal(isSystemHandoff('system status for billing'), false);
});
