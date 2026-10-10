// Cards stop landing on top of each other (void-live-deploy/lib/placement.js): fixture rectangles in, positions out.
// Run: node --test tools/placement.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange, freeSpot, overlaps, GAP } from '../void-live-deploy/lib/placement.js';

const AREA = { w: 1000, h: 700 };
const apply = (cards, moves) => cards.map((c) => (moves[c.id] ? { ...c, ...moves[c.id] } : c));
const clear = (cards) => cards.every((a, i) => cards.every((b, j) => i >= j || !overlaps(a, b)));

test('a summoned card that would cover another lands in the nearest free spot; a clear one stays where it was asked to land', () => {
  const tab = { id: 'tab', x: 24, y: 24, w: 320, h: 420 };
  const cd = { id: 'cd', x: 40, y: 60, w: 200, h: 300, fresh: true };
  const m = arrange([tab, cd], AREA);
  const out = apply([tab, cd], m);
  assert.ok(m.cd, 'the countdown moves'); assert.equal(m.tab, undefined, 'the card already there stays');
  assert.ok(!overlaps(out[0], out[1], GAP), JSON.stringify(out));
  assert.ok(out[1].x >= 24 + 320, 'nearest free spot is beside the tab card, not far away: ' + JSON.stringify(out[1]));
  assert.deepEqual(arrange([{ id: 'a', x: 500, y: 40, w: 200, h: 100 }, { id: 'b', x: 40, y: 60, w: 200, h: 100, fresh: true }], AREA), {});
});

test('the same cards always give the same answer', () => {
  const cards = [{ id: 'a', x: 10, y: 10, w: 300, h: 300 }, { id: 'b', x: 20, y: 20, w: 300, h: 200, fresh: true }, { id: 'c', x: 30, y: 30, w: 100, h: 100, fresh: true }];
  const one = arrange(cards, AREA), two = arrange(JSON.parse(JSON.stringify(cards)), AREA);
  assert.deepEqual(one, two);
  assert.ok(clear(apply(cards, one)), 'no overlaps: ' + JSON.stringify(apply(cards, one)));
});

test('a card that grows pushes the unpinned cards it now covers; a card the person dragged stays where they put it', () => {
  const tab = { id: 'tab', x: 24, y: 24, w: 320, h: 600, grew: true };
  const cd = { id: 'cd', x: 24, y: 470, w: 200, h: 120 };
  const dragged = { id: 'note', x: 120, y: 500, w: 150, h: 80, pinned: true };
  const m = arrange([tab, cd, dragged], AREA);
  assert.ok(m.cd, 'the covered countdown moves'); assert.equal(m.note, undefined, 'the dragged note stays');
  // the grown card itself moves off a pinned card rather than covering it
  assert.ok(m.tab, 'the grown card leaves the pinned one alone');
  const out = apply([tab, cd, dragged], m);
  assert.ok(!overlaps(out[0], out[2], GAP) && !overlaps(out[1], out[0], GAP), JSON.stringify(out));
});

test('a saved layout is never reshuffled: cards that are neither new nor grown stay, even overlapping', () => {
  assert.deepEqual(arrange([{ id: 'a', x: 10, y: 10, w: 200, h: 200 }, { id: 'b', x: 50, y: 50, w: 200, h: 200 }], AREA), {});
});

test('with no free spot left a card takes the spot that covers least and stays on the stage', () => {
  const full = [{ id: 'big', x: 0, y: 0, w: 1000, h: 700 }];
  const p = freeSpot({ w: 200, h: 100 }, full, AREA, { x: 40, y: 60 });
  assert.ok(p.x >= 8 && p.y >= 8 && p.x + 200 <= 1000 && p.y + 100 <= 700, JSON.stringify(p));
});
