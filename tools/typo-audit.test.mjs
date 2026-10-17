// The typo audit (tools/typo-audit.mjs; asked by Void): a word one neighbour-swap from a commoner word is flagged, a known or allowed real word
// is not. Run: node --test tools/typo-audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { reversals } from './typo-audit.mjs';

const T = (...xs) => xs.map((text, i) => ({ text, from: 'fixture ' + i }));
test('a reversal beside a commoner spelling is flagged, with where it came from', () => {
  const hits = reversals(T('convert 5 miles', 'convert a cup', 'convetr 3 feet', 'the clock', 'the timer', 'teh note'));
  assert.deepEqual(hits.map((h) => [h.word, h.likely, h.from]), [['convetr', 'convert', 'fixture 2']]);
});
test('a known word, an allowed word, a word seen as often as its swap, and short words are never flagged', () => {
  const texts = T('from the store', 'from home', 'a form to fill', 'menaing of saudade', 'meaning of life', 'meaning of words', 'teh', 'the', 'the');
  assert.deepEqual(reversals(texts, new Set(['form'])).map((h) => h.word), ['menaing'], 'form is known; teh is under four letters');
  assert.deepEqual(reversals(texts, new Set(['form']), new Set(['menaing'])), []);
  assert.deepEqual(reversals(T('abcd efgh', 'bacd')), [], 'a swap seen once is not enough to call the other a typo');
});
