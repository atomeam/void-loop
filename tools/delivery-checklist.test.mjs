import { test } from 'node:test';
import assert from 'node:assert';
import skill from '../void-live-deploy/skills/delivery-checklist.js';

test('delivery-checklist match', () => {
  assert.ok(skill.match('', 'delivery checklist for automating client onboarding'));
  assert.ok(skill.match('', 'checklist for the invoice reminder system'));
  assert.ok(!skill.match('', 'what is a checklist'));
});
