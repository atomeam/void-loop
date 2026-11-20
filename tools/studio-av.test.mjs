// node --test tools/studio-av.test.mjs: the studio's turn-taking, captions and hook, checked against the video gate's own rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gapBefore, chunks, wrap, captionsOf, CAP } from './studio-av.mjs';
import { captionCheck } from './video-gate.mjs';
const words = (text, at = 0) => text.split(' ').map((w, i) => ({ w, from: at + i * 0.3, to: at + i * 0.3 + 0.25 }));
const placed = [
  { who: 'Critic', text: 'Would you drink from a very old well?', at: 0.5, end: 2.9, words: words('Would you drink from a very old well?') },
  { who: 'Verse', text: 'People in this village still drink from it, every single morning, 3,000 years on.', at: 3.2, end: 7.4, words: words('People in this village still drink from it, every single morning, 3,000 years on.') },
  { who: 'Critic', text: 'Then ask Verse anything at a-to-mind.com.', at: 7.7, end: 9.6, words: words('Then ask Verse anything at a-to-mind.com.') },
];
test('turns breathe: a reaction comes fast, an answer after a question waits a little, the same voice pauses longer', () => {
  assert.equal(gapBefore(null, placed[0]), 0);
  assert.equal(gapBefore({ who: 'Verse', text: 'Is it?' }, { who: 'Critic', text: 'No way.' }), 0.1);
  assert.equal(gapBefore({ who: 'Verse', text: 'Is it old?' }, { who: 'Critic', text: 'Older than the town around it, they say.' }), 0.32);
  assert.ok(gapBefore({ who: 'Verse', text: 'It is old.' }, { who: 'Verse', text: 'And it still works every day.' }) > gapBefore({ who: 'Verse', text: 'It is old.' }, { who: 'Critic', text: 'And it still works every day.' }));
});
test('captions are short chunks, in order, never two at once, breaking after punctuation', () => {
  const c = chunks(placed);
  assert.ok(c.every((x) => x.text.length <= CAP.maxChars || !x.text.includes(' ')));
  for (let i = 1; i < c.length; i++) assert.ok(c[i].from >= c[i - 1].to - 1e-6, 'no overlap at ' + i);
  assert.ok(c.some((x) => /,$/.test(x.text)));
  assert.deepEqual(wrap('Would you drink from a very old well?'), ['Would you drink', 'from a very old', 'well?']);
});
test('every caption, the hook and the end card pass the video gate: 64 px or more, boxed, inside the safe zone, no overlaps', () => {
  const { ass, captions } = captionsOf({ hook: placed[0].text }, placed, 12.2);
  const got = captionCheck(captions);
  assert.ok(got.ok, got.detail);
  assert.ok(!captions.some((c) => c.raw === 'Would you' && c.from < 2.9), 'line 1 waits for the hook to leave');
  assert.match(ass, /Style: Verse,DejaVu Sans,74/); assert.match(ass, /a-to-mind\.com/); assert.match(ass, /PlayResY: 1920/);
});
