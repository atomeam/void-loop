import test from 'node:test';
import assert from 'node:assert/strict';
import { buildId, isStale, checkDue, CHECK_MS, NOTICE } from '../void-live-deploy/lib/stale-tab.js';

test('the build id follows the text and is empty for none', () => {
  assert.equal(buildId('["a","b"]'), buildId('["a","b"]'));
  assert.notEqual(buildId('["a","b"]'), buildId('["a","b","c"]'));
  assert.match(buildId('x'), /^[0-9a-f]{8}$/);
  assert.equal(buildId(''), ''); assert.equal(buildId(null), '');
});
test('only two known, different ids are stale', () => {
  assert.equal(isStale('aa', 'bb'), true);
  assert.equal(isStale('aa', 'aa'), false);
  assert.equal(isStale('', 'bb'), false); assert.equal(isStale('aa', ''), false); // an unreadable check says nothing
});
test('a check is due after the interval, and the first one always', () => {
  assert.equal(checkDue(1000, 1000 + CHECK_MS - 1), false);
  assert.equal(checkDue(1000, 1000 + CHECK_MS), true);
  assert.equal(checkDue(undefined, 5), true);
  assert.match(NOTICE, /newer V01D is ready/);
});
