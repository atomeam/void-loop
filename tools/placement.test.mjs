// Cards stop landing on top of each other (void-live-deploy/lib/placement.js): fixture rectangles in, positions out.
// Run: node --test tools/placement.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange, freeSpot, clearSpot, overlaps, dockPanel, GAP, MIN_SCALE } from '../void-live-deploy/lib/placement.js';

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

// 2026-10-10: on a 1280-wide stage two boards with their cards (880 x 420 each) can't both fit at full size
const STAGE = { w: 1280, h: 648 };
const scaled = (c, m) => { const k = m[c.id] || {}, sc = k.scale ?? c.scale ?? 1; return { id: c.id, x: k.x ?? c.x, y: k.y ?? c.y, w: c.w * sc, h: c.h * sc, scale: sc }; };

test('a second big board that holds the middle shrinks the one it lands on to the largest size that fits beside it, instead of half-covering it', () => {
  const chess = { id: 'chess', x: 200, y: 48, w: 880, h: 420 };
  const checkers = { id: 'checkers', x: 200, y: 48, w: 880, h: 420, grew: true };
  const m = arrange([chess, checkers], STAGE);
  assert.equal(m.checkers, undefined, 'the new board keeps the middle');
  assert.ok(m.chess && m.chess.scale < 1 && m.chess.scale >= MIN_SCALE, JSON.stringify(m));
  const a = scaled(chess, m), b = scaled(checkers, m);
  assert.ok(!overlaps(a, b, GAP), 'no overlap: ' + JSON.stringify([a, b]));
  assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= STAGE.w && a.y + a.h <= STAGE.h, 'on the stage: ' + JSON.stringify(a));
  const bigger = Math.round((m.chess.scale + 0.05) * 100) / 100;
  assert.equal(clearSpot({ w: 880 * bigger, h: 420 * bigger }, [b], STAGE, { x: 200, y: 48 }), null, 'the largest size that fits: ' + m.chess.scale);
});

test('a shrunk board grows back at its home once the board that pushed it is gone; it stays small while that board is there', () => {
  const small = { id: 'chess', x: 8, y: 480, w: 880, h: 420, scale: 0.3, home: { x: 200, y: 48 } };
  assert.deepEqual(arrange([small], STAGE), { chess: { x: 200, y: 48, scale: 1 } });
  const checkers = { id: 'checkers', x: 200, y: 48, w: 880, h: 420 };
  assert.deepEqual(arrange([small, checkers], STAGE), {}, 'still small while checkers is there');
});

test('a small card never shrinks: with no free spot it still takes the spot that covers least', () => {
  const m = arrange([{ id: 'big', x: 0, y: 0, w: 1000, h: 700 }, { id: 'note', x: 40, y: 60, w: 200, h: 100, fresh: true }], AREA);
  assert.ok(!m.note || m.note.scale === undefined, JSON.stringify(m));
  const half = arrange([{ id: 'left', x: 0, y: 0, w: 380, h: 280 }, { id: 'card', x: 20, y: 20, w: 380, h: 280, fresh: true }], { w: 600, h: 300 });
  assert.ok(half.card && half.card.scale === undefined, 'below the board size it moves, never shrinks: ' + JSON.stringify(half));
});

// the walkthrough panel (skills/showcase.js) never covers the open card or the ask bar (owner, 2026-10-18)
const box = (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h });
const H = (w) => (w < 400 ? 220 : 110); // a panel that wraps taller when narrow
test('dockPanel: nothing open puts the panel just above the ask bar, full width', () => {
  const p = dockPanel({ view: { w: 1280, h: 800 }, floor: 664, heightAt: H });
  assert.deepEqual([p.mode, p.w, p.y + p.h], ['bottom', 720, 652]);
});
test('dockPanel: the dragon card at 1280x800 leaves room beside it: the panel goes there and touches neither the card nor the ask bar', () => {
  const card = { x: 360, y: 24, w: 560, h: 620 }, p = dockPanel({ view: { w: 1280, h: 800 }, floor: 664, avoid: [card], heightAt: H });
  assert.equal(p.mode, 'side'); assert.ok(!overlaps(box(p), card), JSON.stringify(p)); assert.ok(p.y + p.h <= 664 && p.x + p.w <= 1280 - 16, JSON.stringify(p));
});
test('dockPanel: a narrow card with room above docks the panel at the top; with room only below, between the card and the ask bar', () => {
  const top = dockPanel({ view: { w: 390, h: 800 }, floor: 674, avoid: [{ x: 10, y: 300, w: 370, h: 300 }], heightAt: H });
  assert.equal(top.mode, 'top'); assert.equal(top.y, 12); assert.ok(!overlaps(box(top), { x: 10, y: 300, w: 370, h: 300 }));
  const low = dockPanel({ view: { w: 390, h: 800 }, floor: 674, avoid: [{ x: 10, y: 20, w: 370, h: 300 }], heightAt: H });
  assert.equal(low.mode, 'bottom'); assert.ok(low.y >= 320 + 12 && low.y + low.h <= 674 - 12, JSON.stringify(low));
});
test('dockPanel: no free space (the card fills a phone) is a modal, centred between the top and the ask bar, never taller than the room', () => {
  const p = dockPanel({ view: { w: 390, h: 800 }, floor: 674, avoid: [{ x: 10, y: 179, w: 370, h: 320 }], heightAt: H });
  assert.equal(p.mode, 'modal'); assert.equal(p.w, 358); assert.ok(p.y >= 12 && p.y + p.h <= 674 - 12, JSON.stringify(p));
  const tiny = dockPanel({ view: { w: 390, h: 200 }, floor: 150, avoid: [{ x: 0, y: 0, w: 390, h: 150 }], heightAt: H });
  assert.equal(tiny.mode, 'modal'); assert.ok(tiny.h <= tiny.maxH && tiny.maxH === 150 - 24, JSON.stringify(tiny));
});
test('dockPanel: the left side is taken when it is the wider one; a card partly off screen counts only where it shows', () => {
  const p = dockPanel({ view: { w: 1280, h: 640 }, floor: 487, avoid: [{ x: 860, y: 50, w: 384, h: 508 }], heightAt: H });
  assert.equal(p.mode, 'side'); assert.ok(p.x + p.w <= 860 - 12 && p.x >= 16, JSON.stringify(p));
  const off = dockPanel({ view: { w: 1280, h: 800 }, floor: 664, avoid: [{ x: -2000, y: 0, w: 2400, h: 900 }], heightAt: H });
  assert.equal(off.mode, 'side'); assert.ok(off.x >= 400 + 12, JSON.stringify(off));
});
