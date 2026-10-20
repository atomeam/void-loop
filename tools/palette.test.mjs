// palette skill pure functions. Run: node --test tools/palette.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteFrom, isPalette, moodOf } from '../void-live-deploy/skills/palette.js';

test('palette: matcher takes palette asks', () => {
  assert.ok(isPalette('color palette for calm'));
  assert.ok(isPalette('mood palette ocean'));
  assert.ok(isPalette('give me a palette'));
  assert.ok(!isPalette('what is a palette'));
});

test('palette: mood and colors', () => {
  assert.equal(moodOf('color palette for calm'), 'calm');
  assert.equal(moodOf('give me a palette'), 'calm');
  const cols = paletteFrom('ocean');
  assert.equal(cols.length, 4);
  assert.ok(cols[0].startsWith('#'));
});
