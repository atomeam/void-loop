// lib/card-tidy.js: a crowd of cards and where a flick rests. splitAsks splits "timer and weather" into separate asks (keeping a
// "between X and Y" span whole), coast lets a flicked card slide to rest inside the stage, tidy lays cards out without overlaps.
// Run: node --test tools/card-tidy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAsks, coast, tidy } from '../void-live-deploy/lib/card-tidy.js';

test('splitAsks: two to five asks that each start like an ask', () => {
  assert.deepEqual(splitAsks('timer and weather'), ['timer', 'weather']);
  assert.deepEqual(splitAsks('make a 5 minute timer and draw a cat and weather'), ['make a 5 minute timer', 'draw a cat', 'weather']);
  assert.equal(splitAsks('salt and pepper'), null, 'a noun pair is one ask');
  assert.equal(splitAsks('timer and weather?'), null, 'a question is one ask');
  assert.equal(splitAsks('timer'), null);
  assert.equal(splitAsks(''), null);
  assert.equal(splitAsks(Array(6).fill('timer').join(' and ')), null, 'more than five is not split');
});
test('splitAsks keeps "between X and Y" together', () => {
  assert.deepEqual(splitAsks('Check the contrast ratio between #0d0d14 and #7dd3fc and generate a QR code for https://a-to-mind.com'),
    ['Check the contrast ratio between #0d0d14 and #7dd3fc', 'generate a QR code for https://a-to-mind.com']);
});
test('coast: a flick slows down and rests inside the stage, a hard one off the edge says so', () => {
  const r = coast({ x: 100, y: 100, vx: 0.5, vy: 0, w: 50, h: 50, stageW: 800, stageH: 600 });
  assert.equal(r.off, false); assert.ok(r.x > 100 && r.x <= 800 - 50 - 8); assert.ok(r.frames.length > 1);
  const still = coast({ x: 10, y: 20, vx: 0, vy: 0, w: 50, h: 50, stageW: 800, stageH: 600 });
  assert.deepEqual([still.x, still.y, still.off], [10, 20, false]);
  assert.equal(coast({ x: 700, y: 100, vx: 5, vy: 0, w: 50, h: 50, stageW: 800, stageH: 600 }).off, true);
  const clamp = coast({ x: 2, y: 2, vx: 0, vy: 0, w: 50, h: 50, stageW: 800, stageH: 600 });
  assert.deepEqual([clamp.x, clamp.y], [8, 8], 'a card rests at least 8 px from the edge');
});
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
test('tidy: cards in a grid inside the area, none overlapping', () => {
  const cards = [1, 2, 3, 4].map((id) => ({ id, x: 0, y: 0, w: 200, h: 120 }));
  const m = tidy(cards, { w: 800, h: 600 }), boxes = Object.values(m);
  assert.equal(boxes.length, 4);
  for (const b of boxes) assert.ok(b.x >= 8 && b.y >= 8 && b.x + b.w <= 793 && b.y + b.h <= 593, JSON.stringify(b));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]));
  assert.deepEqual(tidy([], { w: 800, h: 600 }), {}); assert.deepEqual(tidy(cards, { w: 20, h: 20 }), {});
});
test('tidy: a pinned card stays and the others go round it; a pin off the area means a fresh grid', () => {
  const pin = { id: 'p', x: 8, y: 8, w: 300, h: 200, pinned: true }, free = [{ id: 'a', x: 0, y: 0, w: 100, h: 100 }, { id: 'b', x: 0, y: 0, w: 100, h: 100 }];
  const m = tidy([pin, ...free], { w: 1000, h: 700 });
  assert.equal(m.p, undefined, 'the pinned card is not moved');
  for (const id of ['a', 'b']) assert.ok(!overlap(m[id], pin), id);
  const off = tidy([{ ...pin, x: 2000 }, ...free], { w: 1000, h: 700 });
  assert.ok(off.p, 'a pin off the area is laid out again');
  assert.deepEqual(tidy([pin], { w: 1000, h: 700 }), {}, 'only pins: nothing moves');
});
test('tidy: the floor keeps a card wide enough (an answer card on a phone)', () => {
  const cards = [1, 2].map((id) => ({ id, x: 0, y: 0, w: 100, h: 100 }));
  assert.equal(new Set(Object.values(tidy(cards, { w: 400, h: 800 })).map((b) => b.x)).size, 2, 'two columns at 148 px');
  assert.equal(new Set(Object.values(tidy(cards, { w: 400, h: 800 }, 300)).map((b) => b.x)).size, 1, 'one column at a 300 px floor');
});
