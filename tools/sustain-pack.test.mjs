import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isSustainPack, subjectOf } from '../void-live-deploy/skills/sustain-pack.js';

test('sustain-pack matches its asks and leaves kickoff and handoff alone', () => {
  assert.equal(isSustainPack('sustain pack for the invoice system'), true);
  assert.equal(isSustainPack('ongoing care for the support automation'), true);
  assert.equal(isSustainPack('keep owning the onboarding flow'), true);
  assert.equal(subjectOf('sustain pack for the invoice system'), 'invoice system');
  assert.equal(isSustainPack('kickoff pack'), false);
  assert.equal(isSustainPack('full handoff'), false);
  assert.equal(isSustainPack('what is sustain'), false);
});

test('sustain-pack keeps the skill contract: the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
});
