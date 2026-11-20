import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isClientExceptionsPack } from '../void-live-deploy/skills/client-exceptions-pack.js';

test('client-exceptions-pack matches examples and rejects near misses', () => {
  assert.equal(isClientExceptionsPack('exceptions pack for my idea: automate invoice reminders'), true);
  assert.equal(isClientExceptionsPack('what does the client still decide for this business system'), true);
  assert.equal(isClientExceptionsPack('package the client exceptions for onboarding'), true);
  assert.equal(isClientExceptionsPack('full lift plan'), false);
  assert.equal(isClientExceptionsPack('delivery pack'), false);
  assert.equal(isClientExceptionsPack('status of the system'), false);
});
