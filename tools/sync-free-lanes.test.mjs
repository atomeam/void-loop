import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFree, rankFree, buildPayload } from '../tools/sync-free-lanes.mjs';

test('isFree: $0 prompt and completion', () => {
  assert.equal(isFree({ pricing: { prompt: '0', completion: '0' } }), true);
  assert.equal(isFree({ pricing: { prompt: '0.001', completion: '0' } }), false);
  assert.equal(isFree({}), false);
});
test('rankFree: sorts by context desc', () => {
  const r = rankFree([
    { id: 'a/m1', pricing: { prompt: '0', completion: '0' }, context_length: 1000 },
    { id: 'b/m2', pricing: { prompt: '0', completion: '0' }, context_length: 4000 },
    { id: 'c/paid', pricing: { prompt: '1', completion: '1' }, context_length: 100000 },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, 'b/m2');
  assert.equal(r[1].id, 'a/m1');
});
test('buildPayload: has count and models', () => {
  const p = buildPayload([{ id: 'x', name: 'X', context: 1000, provider: 'x' }]);
  assert.equal(p.count, 1);
  assert.equal(p.models.length, 1);
  assert.ok(p.updated);
});