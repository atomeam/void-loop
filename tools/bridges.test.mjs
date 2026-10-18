// lib/bridges.js: what one kind of thing hands another as text (asked by Verse, 2026-10-16). node --test tools/bridges.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { keptNote, entryFor, itemLine, boxOverlap, overlapping, togetherLine, arenaNoteLine } from '../void-live-deploy/lib/bridges.js';
import { toNoteAsk } from '../void-live-deploy/skills/kept.js';
import { appendOf } from '../void-live-deploy/skills/notepad.js';

test('a kept card becomes one line, capped', () => {
  assert.equal(keptNote({ name: 'my tip', ask: '15% of 240' }, '15% of 240 is 36'), 'my tip: 15% of 240 is 36');
  assert.equal(keptNote({ ask: 'x' }, ''), 'x');
  assert.ok(keptNote({ ask: 'x' }, 'y'.repeat(900)).length <= 600);
  assert.equal(keptNote(null), '');
});
test('what a dropped thing becomes on a list', () => {
  assert.equal(entryFor({ kind: 'sticky', text: 'call mom\nlater' }), 'call mom');
  assert.equal(entryFor({ kind: 'timer', duration: 300000 }), 'timer 5 min');
  assert.equal(entryFor({ kind: 'list' }), '');
  assert.equal(entryFor({ kind: 'figure' }), '');
});
test('a list entry keeps its tick', () => {
  assert.equal(itemLine({ text: 'milk', done: true }), '☑ milk');
  assert.equal(itemLine({ text: 'milk' }), '☐ milk');
});
test('overlap is shared area, not touching edges', () => {
  assert.ok(boxOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
  assert.ok(!boxOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }));
  assert.deepEqual(overlapping({ a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 4, h: 4 }, c: { x: 50, y: 50, w: 1, h: 1 } }, 'a'), ['b']);
});
test('the asks and lines', () => {
  assert.ok(toNoteAsk('Turn this card into a note')); assert.ok(toNoteAsk('note this card')); assert.ok(!toNoteAsk('keep this'));
  assert.equal(appendOf('add to the notepad: the vet called'), 'the vet called'); assert.equal(appendOf('notepad add buy bread'), 'buy bread');
  assert.equal(togetherLine({ why: 'the a and the b spar' }, new Date(2026, 9, 16, 18, 40)), '18:40 the a and the b spar');
  assert.match(arenaNoteLine('connect4', { ladder: [{ rating: 1000 }, { rating: 1609 }] }, '+62 since Oct 10', new Date(2026, 9, 16)), /^self-play connect four, Oct 16: rated 1609 \(\+62 since Oct 10\)\. Why: $/);
});
