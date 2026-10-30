// A long ask as a card title ends at a whole sentence or a whole word, never mid-word (owner, 2026-10-30: a pasted note's card title stopped
// at "The Versus jo"), and the card picture draws all of it. lib/card-share.js cutWhole and dataOf, lib/card-image.js fitTitle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cutWhole, dataOf, shareText, parse, TITLE_MAX } from '../void-live-deploy/lib/card-share.js';
import { fitTitle } from '../void-live-deploy/lib/card-image.js';

const note = 'The "5 m c" fix is live and the card reads right now. '.repeat(11) + 'The Versus job runs every hour and reports what it found.';

test('cutWhole: a short title stays whole; a long one ends at its last whole sentence', () => {
  assert.equal(cutWhole('one ask', 600), 'one ask');
  const t = cutWhole(note, TITLE_MAX);
  assert.ok(t.length <= TITLE_MAX && t.length > TITLE_MAX * 0.4, t.length);
  assert.ok(/[.!?]$/.test(t), t.slice(-30));
  assert.ok(note.startsWith(t));
});

test('cutWhole: with no sentence end in reach it ends at a whole word', () => {
  const words = 'alpha beta gamma delta '.repeat(40);
  const t = cutWhole(words, TITLE_MAX);
  assert.ok(t.length <= TITLE_MAX);
  assert.ok(/(alpha|beta|gamma|delta)$/.test(t), t.slice(-20));
});

test('dataOf, shareText and parse keep the whole-sentence title', () => {
  const d = dataOf({ title: note, kind: 'answer', body: 'the answer' });
  assert.ok(/runs now\.$|right now\.$|reports what it found\.$/.test(d.t) || /[.!?]$/.test(d.t), d.t.slice(-30));
  assert.ok(!/\bjo$/.test(d.t));
  const back = parse(shareText(d));
  assert.equal(back.t, d.t);
});

test('fitTitle draws a whole 600-character title, even at the narrowest title bar', () => {
  const d = dataOf({ title: note });
  const { lines } = fitTitle(d.t, 620 - 9 * 24);
  assert.equal(lines.join(' '), d.t);
  assert.ok(!lines.some((l) => l.endsWith('…')));
});
