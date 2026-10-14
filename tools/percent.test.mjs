import { test } from 'node:test';
import assert from 'node:assert/strict';
import percent from '../void-live-deploy/skills/percent.js';

test('percent examples match', () => {
  for (const ex of percent.examples) {
    assert.ok(percent.match(ex.toLowerCase(), ex), ex);
  }
  for (const nm of percent.nearMisses) {
    assert.ok(!percent.match(nm.toLowerCase(), nm), nm);
  }
});
