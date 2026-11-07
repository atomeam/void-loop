import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isVerifyPack, subjectOf } from '../void-live-deploy/skills/verify-pack.js';

test('verify-pack matches its asks and leaves systems-monitor and system-status alone', () => {
  assert.equal(isVerifyPack('verify pack for client onboarding'), true);
  assert.equal(isVerifyPack('set up tests for the invoice reminders'), true);
  assert.equal(isVerifyPack('what will Verse verify for the support router'), true);
  assert.equal(subjectOf('verify pack for client onboarding'), 'client onboarding');
  assert.equal(isVerifyPack('systems monitor'), false);
  assert.equal(isVerifyPack('system status for the onboarding flow'), false);
  assert.equal(isVerifyPack('what is a test'), false);
});

// the router (void.html firstSkill) calls skill.match on the default export: without it the whole suite
// crashed with "s.match is not a function" (verify-pack shipped without one, 2026-11-07)
test('verify-pack keeps the skill contract: the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
});
