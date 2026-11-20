// full-lift-plan skill: complete ownership plan for a business idea.
// Run: node --test tools/full-lift-plan.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isFullLiftPlan } from '../void-live-deploy/skills/full-lift-plan.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isFullLiftPlan(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isFullLiftPlan(a), false, a);
});

test('suite reports ok', () => {
  assert.equal(skill.suite().ok, true);
});
