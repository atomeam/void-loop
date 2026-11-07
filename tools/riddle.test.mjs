// riddle (skills/riddle.js): a riddle from the list on this device, not a definition of the word.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isRiddle } from '../void-live-deploy/skills/riddle.js';

test('a riddle ask is the riddle, and a question about riddles is not', () => {
  for (const a of ['riddle', 'tell me a riddle', 'give me a riddle', 'another riddle']) assert.equal(isRiddle(a), true, a);
  assert.equal(isRiddle('what is a riddle'), false);
  assert.equal(skill.suite().ok, true);
});
