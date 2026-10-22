import { parseRoll, roll } from '../void-live-deploy/skills/dice.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('dice parseRoll takes roll a dice and 2d6', () => {
  assert.deepEqual(parseRoll('roll a dice'), { n: 1, sides: 6 });
  assert.deepEqual(parseRoll('roll 2d6'), { n: 2, sides: 6 });
  assert.equal(parseRoll('what is a dice'), null);
});

test('dice roll produces faces in range', () => {
  const r = roll(2, 6);
  assert.equal(r.faces.length, 2);
  assert.ok(r.faces.every((f) => f >= 1 && f <= 6));
  assert.equal(r.total, r.faces[0] + r.faces[1]);
});
