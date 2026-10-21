// node --test tools/coin-flip.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { coinOf } from '../void-live-deploy/skills/coin-flip.js';

test('matches flip a coin and leaves other coin talk alone', () => {
  assert.ok(skill.match('flip a coin', 'flip a coin'));
  assert.ok(skill.match('heads or tails', 'heads or tails'));
  assert.ok(!skill.match('what is a coin', 'what is a coin'));
  assert.equal(coinOf('flip a coin for dinner'), 'dinner');
  assert.equal(coinOf('flip a coin'), '');
});
