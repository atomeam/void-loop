import test from 'node:test';
import assert from 'node:assert/strict';
import { idOf, isStale, checkDue, CHECK_MS, NOTICE } from '../void-live-deploy/lib/stale-tab.js';

test('the id is the deploy commit, else the page ETag, else empty', () => {
  assert.equal(idOf({ id: 'abc123' }, '"x"'), 'b:abc123');
  assert.equal(idOf(null, '"x"'), 'e:"x"');
  assert.equal(idOf({}, ''), ''); assert.equal(idOf(null, null), ''); assert.equal(idOf({ id: 5 }, undefined), '');
  assert.notEqual(idOf({ id: 'a' }), idOf({ id: 'b' }));
});
test('only two known, different ids are stale: a changed ETag or commit is stale, the same is fresh, a missing header says nothing', () => {
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
