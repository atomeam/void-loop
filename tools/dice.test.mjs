// suite check for dice skill
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/dice.js';
test('dice matches its examples and rolls', () => {
  assert.equal(skill.match('roll a die', 'roll a die'), true);
  assert.equal(skill.match('roll 2d6', 'roll 2d6'), true);
  assert.equal(skill.match('what is a die', 'what is a die'), false);
  let html = '';
  const ret = skill.run('roll 2d6', { esc: (t) => t, showPage: (b) => b({ set innerHTML(v) { html = v; } }) });
  assert.equal(ret, 'dice');
  assert.match(html, /Dice/);
});
