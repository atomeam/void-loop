// stigmergy-board (skills/stigmergy-board.js): which asks open a trail board, and the board itself on a stub page: a tap leaves a mark in the right cell,
// a mark touched in two visits is reinforced and grows with time while a one-visit mark evaporates, and the board is kept per topic in localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/stigmergy-board.js';
import * as S from '../void-live-deploy/lib/stigmergy-law.js';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
// a stub card: innerHTML is kept, querySelector hands back one node per selector, the canvas takes its size from the markup and has no 2d context
function board(ask) {
  const nodes = {}, el = { innerHTML: '', dataset: {}, cls: [], classList: { add: (c) => el.cls.push(c) } };
  el.querySelector = (sel) => nodes[sel] || (nodes[sel] = { textContent: '', on: {}, addEventListener(t, f) { this.on[t] = f; },
    ...(sel === 'canvas' ? { width: +/<canvas[^>]*width="(\d+)"/.exec(el.innerHTML)[1], height: +/<canvas[^>]*height="(\d+)"/.exec(el.innerHTML)[1], getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 240 }) } : {}) });
  assert.equal(sk.run(ask, { showPage: (f) => f(el), esc: String }), 'stigmergy-board');
  const tap = (cx, cy) => nodes.canvas.on.click({ clientX: (cx + 0.5) * 30, clientY: (cy + 0.5) * 30 }), press = (c) => nodes[c].on.click({ target: nodes[c] });
  return { el, nodes, tap, press, note: () => nodes['.sb-note'].textContent };
}

test('examples in, near misses out, and the asks the pattern names', () => {
  const m = (t) => sk.match(t.toLowerCase(), t);
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['Leave a trail for the hiring loop', 'leave a stigmergy trail about pricing', 'leave a trail about q4']) assert.ok(m(a), a);
  for (const a of ['leave a trail', 'leave a trail on', 'trail on the launch plan', 'leave a comment on the launch plan', 'leave a trail mix out']) assert.ok(!m(a), a);
});
test('a tap marks its cell; a second visit reinforces it; time grows it and evaporates the rest', () => {
  mem.clear();
  const b = board('leave a trail on the launch plan');
  assert.deepEqual(b.el.cls, ['stigmergy-board']); assert.equal(b.nodes['.sb-topic'].textContent, 'Topic: the launch plan');
  assert.equal(b.el.dataset.session, '1'); assert.equal(b.el.dataset.marks, '0'); assert.match(b.note(), /^Visit 1 · 0 marks · 0 reinforced .* · no trail yet · 0% of trails are returning$/);
  b.tap(1, 1); b.tap(5, 3);
  assert.equal(b.el.dataset.marks, '2'); assert.equal(b.el.dataset.reinforced, '0');
  b.press('.sb-visit'); b.tap(1, 1);
  assert.equal(b.el.dataset.session, '2'); assert.equal(b.el.dataset.reinforced, '1'); assert.equal(b.el.dataset.hot, '1,1;5,3');
  assert.match(b.note(), /^Visit 2 · 2 marks · 1 reinforced \(touched in 2\+ visits\) · earning attention: \(2,2\) \(6,4\) · 50% of trails are returning$/);
  b.press('.sb-tick');
  const s = S.load(mem.get('void-stigmergy:the-launch-plan'));
  assert.equal(b.el.dataset.ticks, '1'); assert.equal(s.w[1 * S.W + 1], 2.24); assert.equal(s.w[3 * S.W + 5], 0.85);
  for (let i = 0; i < 30; i++) b.press('.sb-tick');
  assert.equal(b.el.dataset.marks, '1'); assert.equal(b.el.dataset.hot, '1,1'); assert.match(b.note(), /100% of trails are returning$/);
  b.press('.sb-view'); assert.equal(b.el.dataset.view, 'heat'); assert.equal(b.nodes['.sb-view'].textContent, 'View: heat');
});
test('the board is kept per topic: opening it again is the next visit with the marks still there', () => {
  mem.clear();
  const a = board('leave a trail on onboarding'); a.tap(0, 0); a.tap(11, 7);
  const b = board('Leave a trail on Onboarding?');
  assert.equal(b.el.dataset.session, '2'); assert.equal(b.el.dataset.marks, '2');
  const c = board('leave a trail on offboarding');
  assert.equal(c.el.dataset.session, '1'); assert.equal(c.el.dataset.marks, '0');
  assert.deepEqual([...mem.keys()].sort(), ['void-stigmergy:offboarding', 'void-stigmergy:onboarding']);
});
