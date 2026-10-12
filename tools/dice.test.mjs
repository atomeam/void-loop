// The dice skill's parser (skills/dice.js): coin flips and dice rolls, nothing else.
// Run: node --test tools/dice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDice } from '../void-live-deploy/skills/dice.js';

test('dice: coin and dice asks parse, near misses do not', () => {
  assert.deepEqual(parseDice('flip a coin'), { type: 'coin' });
  assert.deepEqual(parseDice('heads or tails'), { type: 'coin' });
  assert.deepEqual(parseDice('roll a die'), { type: 'dice', n: 1, sides: 6 });
  assert.deepEqual(parseDice('roll a d6'), { type: 'dice', n: 1, sides: 6 });
  assert.deepEqual(parseDice('roll 2d6'), { type: 'dice', n: 2, sides: 6 });
  assert.deepEqual(parseDice('d20'), { type: 'dice', n: 1, sides: 20 });
  assert.equal(parseDice('what is a die'), null);
  assert.equal(parseDice('roll the ball'), null);
  assert.equal(parseDice(''), null);
});
