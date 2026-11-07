import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifyPack, subjectOf } from '../void-live-deploy/skills/verify-pack.js';

test('verify-pack matches its asks and leaves systems-monitor and system-status alone', () => {
  assert.equal(isVerifyPack('verify pack for client onboarding'), true);
  assert.equal(isVerifyPack('set up tests for the invoice reminders'), true);
  assert.equal(isVerifyPack('what will Verse verify for the support router'), true);
  assert.equal(subjectOf('verify pack for client onboarding'), 'client onboarding');
  assert.equal(isVerifyPack('systems monitor'), false);
  assert.equal(isVerifyPack('system status for the onboarding flow'), false);
  assert.equal(isVerifyPack('what is a test'), false);
});
