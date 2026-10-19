import test from 'node:test';
import assert from 'node:assert/strict';
import { isField, targetOf, ease, SLOW, IDLE_MS, RAMP_MS } from '../void-live-deploy/lib/motion-throttle.js';

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
  assert.equal(targetOf({ busy: null, lastAt: 1000, self: b, now: 1000 + IDLE_MS }), SLOW, 'the climb starts from SLOW, no step');
  assert.equal(targetOf({ busy: null, lastAt: 1000, self: b, now: 1000 + IDLE_MS + RAMP_MS }), 1);
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

test('the way back is a smooth curve: no step, never down, flat at both ends, half way at the middle', () => {
  const at = (ms) => targetOf({ busy: null, lastAt: 0, self: {}, now: IDLE_MS + ms });
  let prev = at(0), maxStep = 0;
  for (let ms = 1; ms <= RAMP_MS; ms++) { const v = at(ms); assert.ok(v >= prev, 'never slows again on the way back'); maxStep = Math.max(maxStep, v - prev); prev = v; }
  assert.equal(prev, 1);
  assert.ok(maxStep < (1 - SLOW) * 0.01, 'no jump: the biggest 1 ms step is ' + maxStep);
  assert.ok(at(1) - at(0) < (at(RAMP_MS / 2 + 1) - at(RAMP_MS / 2)) / 10, 'it leaves SLOW gently');
  assert.ok(at(RAMP_MS) - at(RAMP_MS - 1) < (at(RAMP_MS / 2 + 1) - at(RAMP_MS / 2)) / 10, 'it settles into full speed gently');
  assert.ok(Math.abs(at(RAMP_MS / 2) - (SLOW + 1) / 2) < 1e-9);
});
