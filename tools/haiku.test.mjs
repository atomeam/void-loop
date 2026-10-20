// haiku skill pure functions. Run: node --test tools/haiku.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haikuFrom, isHaiku, seedOf } from '../void-live-deploy/skills/haiku.js';

test('haiku: matcher takes make/write/haiku asks', () => {
  assert.ok(isHaiku('make a haiku about rain'));
  assert.ok(isHaiku('haiku from ocean'));
  assert.ok(isHaiku('write a haiku'));
  assert.ok(!isHaiku('what is a haiku'));
  assert.ok(!isHaiku('tell me a joke'));
});

test('haiku: seed extraction and 5-7-5 shape', () => {
  assert.equal(seedOf('make a haiku about rain'), 'rain');
  assert.equal(seedOf('write a haiku'), 'life');
  const lines = haikuFrom('rain');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].length > 0);
  assert.ok(lines[1].includes('rain'));
});
