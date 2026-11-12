import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overflowOf, minWidthOf, unscrollableList, aspectOf, checkSnapshot, checkAll, patchFor } from '../void-live-deploy/lib/sightline.js';

test('overflowOf: no overflow returns null', () => {
  assert.equal(overflowOf({ scrollHeight: 100, clientHeight: 100 }), null);
  assert.equal(overflowOf({ scrollHeight: 95, clientHeight: 100 }), null);
});
test('overflowOf: overflow returns defect with fix', () => {
  const r = overflowOf({ scrollHeight: 200, clientHeight: 100 });
  assert.equal(r.kind, 'overflow');
  assert.equal(r.excess, 100);
  assert.equal(r.fix, 'max-h-60 overflow-y-auto');
});
test('unscrollableList: small list ok', () => {
  assert.equal(unscrollableList(3, false), null);
  assert.equal(unscrollableList(10, true), null);
});
test('unscrollableList: large unscrollable list fails', () => {
  const r = unscrollableList(200, false);
  assert.equal(r.kind, 'unscrollable-list');
  assert.equal(r.fix, 'max-h-60 overflow-y-auto');
});
test('minWidthOf: narrow box fails', () => {
  const r = minWidthOf({ width: 50 });
  assert.equal(r.kind, 'min-width');
});
test('checkAll: clean when no defects', () => {
  const r = checkAll([{ name: 'card', box: { scrollHeight: 50, clientHeight: 50, width: 200, height: 200 } }]);
  assert.equal(r.clean, true);
  assert.equal(r.defects.length, 0);
});
test('checkAll: reports defects', () => {
  const r = checkAll([{ name: 'card', box: { scrollHeight: 200, clientHeight: 50, width: 200, height: 100 }, itemCount: 200, hasScrollContainer: false }]);
  assert.equal(r.clean, false);
  assert.ok(r.defects.length >= 2);
});
test('patchFor: produces css hints', () => {
  const p = patchFor([{ name: 'card', kind: 'overflow', fix: 'max-h-60 overflow-y-auto' }]);
  assert.match(p, /max-h-60 overflow-y-auto/);
});