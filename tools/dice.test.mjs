import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roll } from '../void-live-deploy/skills/dice.js';

test('dice suite: roll stays in bounds', () => {
  for (let i = 0; i < 20; i++) {
    const r = roll(4, 20);
    assert.equal(r.n, 4);
    assert.equal(r.sides, 20);
    assert.equal(r.rolls.length, 4);
    assert.ok(r.sum >= 4 && r.sum <= 80);
    for (const f of r.rolls) assert.ok(f >= 1 && f <= 20);
  }
});
