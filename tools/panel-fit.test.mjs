import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPanel, settleAround, restorePlan } from '../void-live-deploy/lib/panel-fit.js';

test('a panel with room is left alone and does not scroll', () => {
  const r = fitPanel({ top: 100, content: 300, floor: 700 });
  assert.equal(r.top, 100); assert.ok(r.maxHeight >= 300); assert.equal(r.scrolls, false);
});
test('a panel that would run under the ask bar slides up, and ends above it', () => {
  const r = fitPanel({ top: 400, content: 400, floor: 560 });
  assert.ok(r.top + Math.min(400, r.maxHeight) <= 560 - 12, JSON.stringify(r));
  assert.ok(r.top >= 8);
});
test('too little room: the panel takes all of it and scrolls, never below the bar', () => {
  const r = fitPanel({ top: 120, content: 700, floor: 424 });
  assert.equal(r.scrolls, true);
  assert.ok(r.top + r.maxHeight <= 424 - 12 + 1, JSON.stringify(r));
});
test('a panel starting under the bar is pulled up above it', () => {
  const r = fitPanel({ top: 900, content: 200, floor: 600 });
  assert.ok(r.top + 200 <= 600 - 12 && r.top < 900);
});

test('a loose card under a game moves to the nearest clear spot, nothing is dropped', () => {
  const area = { w: 1700, h: 900 };
  const out = settleAround([{ id: 'list', x: 982, y: 457, w: 290, h: 263 }], [{ x: 200, y: 48, w: 880, h: 517 }, { x: 278, y: 664, w: 724, h: 72 }], area);
  assert.deepEqual(out.tuck, []);
  const m = out.moves.list; assert.ok(m);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  assert.equal(hit({ ...m, w: 290, h: 263 }, { x: 200, y: 48, w: 880, h: 517 }), false);
  assert.equal(hit({ ...m, w: 290, h: 263 }, { x: 278, y: 664, w: 724, h: 72 }), false);
});
test('no clear spot: the card is tucked, not moved or dropped', () => {
  const out = settleAround([{ id: 'list', x: 982, y: 457, w: 290, h: 263 }], [{ x: 200, y: 48, w: 880, h: 517 }, { x: 278, y: 664, w: 724, h: 72 }], { w: 1280, h: 800 });
  assert.deepEqual(out.tuck, ['list']); assert.deepEqual(out.moves, {});
});
test('a card that touches nothing stays and is not listed', () => {
  const out = settleAround([{ id: 'a', x: 10, y: 10, w: 100, h: 100 }], [{ x: 500, y: 500, w: 100, h: 100 }], { w: 1000, h: 800 });
  assert.deepEqual(out, { moves: {}, tuck: [] });
});
test('two loose cards do not take the same spot', () => {
  const out = settleAround([{ id: 'a', x: 300, y: 300, w: 200, h: 200 }, { id: 'b', x: 320, y: 320, w: 200, h: 200 }], [{ x: 250, y: 250, w: 400, h: 400 }], { w: 1600, h: 900 });
  const a = out.moves.a, b = out.moves.b;
  assert.ok(a && b);
  assert.equal(a.x < b.x + 200 && b.x < a.x + 200 && a.y < b.y + 200 && b.y < a.y + 200, false);
});

test('restore puts a card back at its prior spot when that is clear, and leaves it when not', () => {
  const area = { w: 1280, h: 800 };
  const out = restorePlan([{ id: 'list', prior: { x: 982, y: 457 }, w: 290, h: 263 }, { id: 'note', prior: { x: 20, y: 20 }, w: 200, h: 100 }], [{ x: 10, y: 10, w: 220, h: 120 }], area);
  assert.deepEqual(out, { list: { x: 982, y: 457 } });
});
