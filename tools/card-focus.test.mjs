// lib/card-focus.js: a game card the person just asked for takes keyboard focus (so the arrow keys play it at once); one brought back after a
// reload does not, and a person typing in another field is left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { justAsked } from '../void-live-deploy/lib/card-focus.js';

test('just asked: an Enter or tap within 30 s, or a link that carries the ask in its first 30 s', () => {
  const now = 1e6;
  assert.equal(justAsked(now, now - 2000, '', 99999), true, 'asked 2 s ago');
  assert.equal(justAsked(now, now - 31000, '', 99999), false, 'asked 31 s ago: a kept card coming back');
  assert.equal(justAsked(now, 0, '', 99999), false, 'never asked: a kept card coming back');
  assert.equal(justAsked(now, 0, '?q=play%20snake', 4000), true, 'the link carried the ask');
  assert.equal(justAsked(now, 0, '?q=play%20snake', 60000), false, 'the link was opened a minute ago');
});
