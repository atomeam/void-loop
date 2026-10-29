// node --test tools/pit-crew.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAutoEligible, selectCrew, targetFor } from './pit-crew.mjs';

test('isAutoEligible requires small id and blocks spend wording', () => {
  assert.equal(isAutoEligible({ small: true, id: 'ask-1', ask: 'Add a probe success rate card on growth' }), true);
  assert.equal(isAutoEligible({ small: false, id: 'ask-1', ask: 'Add a probe success rate card on growth' }), false);
  assert.equal(isAutoEligible({ small: true, id: 'ask-1', ask: 'Change the price of the store pack' }), false);
  assert.equal(isAutoEligible({ small: true, id: 'ask-1', ask: 'Rotate the owner token in secrets' }), false);
});

test('selectCrew caps and skips built', () => {
  const asks = [
    { small: true, id: 'a1', ask: 'Make a small friction chip visible' },
    { small: true, id: 'a2', ask: 'Add probe success rate card please' },
    { small: true, id: 'a3', ask: 'Link phone-cut films to poster skill' },
    { small: true, id: 'a4', ask: 'Pulse the growth tree after scroll' },
  ];
  const got = selectCrew(asks, new Set(['a1']), { max: 2 });
  assert.equal(got.length, 2);
  assert.equal(got[0].id, 'a2');
});

test('targetFor is a stable queue target', () => {
  assert.match(targetFor({ id: 'ask-20261015-2116-2' }), /^voice:ask-/);
});
