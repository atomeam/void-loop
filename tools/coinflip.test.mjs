// coinflip skill. Run: node --test tools/coinflip.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flip, isCoinFlip } from '../void-live-deploy/skills/coinflip.js';

test('coinflip: matcher', () => {
  assert.ok(isCoinFlip('flip a coin'));
  assert.ok(isCoinFlip('heads or tails'));
  assert.ok(isCoinFlip('coin flip'));
  assert.ok(!isCoinFlip('what is a coin'));
});

test('coinflip: result is heads or tails', () => {
  const r = flip();
  assert.ok(r === 'heads' || r === 'tails');
});
