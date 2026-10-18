import test from 'node:test';
import assert from 'node:assert/strict';
import { isField, targetOf, ease, SLOW, IDLE_MS } from '../void-live-deploy/lib/motion-throttle.js';

test('what counts as a card input: text fields, selects, textareas, contenteditable; not buttons or checkboxes', () => {
  assert.ok(isField({ tagName: 'INPUT', type: 'text' }));
  assert.ok(isField({ tagName: 'input', type: '' }));
  assert.ok(isField({ tagName: 'TEXTAREA' }));
  assert.ok(isField({ tagName: 'SELECT' }));
  assert.ok(isField({ tagName: 'DIV', isContentEditable: true }));
  assert.ok(!isField({ tagName: 'INPUT', type: 'checkbox' }));
  assert.ok(!isField({ tagName: 'BUTTON' }));
  assert.ok(!isField(null));
});

test('the target: slow while another card is in use and for IDLE_MS after; the card in use is never slowed by itself', () => {
  const a = {}, b = {};
  assert.equal(targetOf({ busy: a, self: b, now: 0 }), SLOW);
  assert.equal(targetOf({ busy: a, self: a, now: 0 }), 1);
  assert.equal(targetOf({ busy: null, lastAt: 1000, self: b, now: 1000 + IDLE_MS - 1 }), SLOW);
  assert.equal(targetOf({ busy: null, lastAt: 1000, self: b, now: 1000 + IDLE_MS }), 1);
  assert.equal(targetOf({ now: 5 }), 1);
});

test('the easing is smooth, frame-rate independent and stays in [SLOW, 1]', () => {
  let v = 1; const seen = [];
  for (let i = 0; i < 120; i++) { v = ease(v, SLOW, 16); seen.push(v); }
  assert.equal(v, SLOW);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1]);
  assert.ok(seen[0] > 0.9, 'no jump on the first frame: ' + seen[0]);
  let x = 1; for (let i = 0; i < 10; i++) x = ease(x, SLOW, 10);
  const y = ease(1, SLOW, 100);
  assert.ok(Math.abs(x - y) < 1e-9);
  assert.equal(ease(0.1, 0, 1000), SLOW);
  assert.equal(ease(2, 1, 0), 1);
});
