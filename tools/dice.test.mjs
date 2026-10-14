import { test } from 'node:test';
import assert from 'node:assert/strict';
import dice from '../void-live-deploy/skills/dice.js';

test('dice examples match', () => {
  for (const ex of dice.examples) {
    assert.ok(dice.match(ex.toLowerCase(), ex), ex);
  }
  for (const nm of dice.nearMisses) {
    assert.ok(!dice.match(nm.toLowerCase(), nm), nm);
  }
});
