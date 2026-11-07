// rock paper scissors (skills/rps.js): the three asks open the game, a look-alike does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isRPS } from '../void-live-deploy/skills/rps.js';

test('rock paper scissors is the game, and a question about it is not', () => {
  for (const a of ['rock paper scissors', 'play rps', 'play rock paper scissors']) assert.equal(isRPS(a), true, a);
  assert.equal(isRPS('what is rock paper scissors'), false);
  assert.equal(skill.suite().ok, true);
  for (const a of skill.examples) assert.equal(skill.match(a, a), true, a);
});
