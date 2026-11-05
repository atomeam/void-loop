import test from 'node:test';
import assert from 'node:assert/strict';
import { isClientHandoff, subjectOf } from '../void-live-deploy/skills/client-handoff.js';

test('a client handoff names the system and leaves delivery-pack asks alone', () => {
  assert.equal(isClientHandoff('client handoff for the onboarding automation'), true);
  assert.equal(isClientHandoff('make a client handoff for the invoice flow'), true);
  assert.equal(subjectOf('client handoff for the onboarding automation'), 'onboarding automation');
  assert.equal(isClientHandoff('handoff pack for my SaaS idea'), false);
  assert.equal(isClientHandoff('delivery package: invoice reminders'), false);
  assert.equal(isClientHandoff('what is a handoff'), false);
});
