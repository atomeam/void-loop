// lib/wordcount.js: words, characters, sentences (not fooled by Mr., U.S. or 3.5), paragraphs, times, reading level and keywords
import test from 'node:test';
import assert from 'node:assert/strict';
import { count, sentences, paragraphs, wordsOf, keywords, duration } from '../void-live-deploy/lib/wordcount.js';

test('the tower\'s question: 13 words, 63 characters, 2 sentences', () => {
  const c = count('The quick brown fox jumps over the lazy dog. It was not amused!');
  assert.deepEqual([c.words, c.characters, c.noSpaces, c.sentences, c.paragraphs], [13, 63, 51, 2, 1]);
});
test('words: an apostrophe or hyphen inside a word keeps it one; numbers count; punctuation does not', () => {
  assert.deepEqual(wordsOf("don't stop — well-known 3.5 results, ok?"), ["don't", 'stop', 'well-known', '3', '5', 'results', 'ok']);
  assert.equal(count('').words, 0); assert.equal(count('   ').sentences, 0);
});
test('sentences: titles, abbreviations and decimals do not end one; a last sentence without a mark still counts', () => {
  assert.equal(sentences('Mr. Smith met Dr. Jones in the U.S. last year. They talked.'), 2);
  assert.equal(sentences('It costs 3.5 dollars. Really?! Yes...'), 3);
  assert.equal(sentences('Hello there'), 1);
  assert.equal(sentences('One. Two. Three'), 3);
  assert.equal(sentences('"Stop!" she said. Then she left.'), 3, 'a quoted exclamation ends a sentence, as wordcounter.net counts it');
});
test('paragraphs, times, reading level and keywords', () => {
  assert.equal(paragraphs('one\n\ntwo\nthree\n\n\n'), 3);
  assert.equal(duration(0), '0 sec'); assert.equal(duration(200), '3 min 20 sec'); assert.equal(duration(3900), '1 hr 5 min');
  const c = count('word '.repeat(238)); assert.equal(Math.round(c.readSec), 60);
  assert.ok(count('The cat sat on the mat. The dog ran.').grade < 3, 'short words and sentences read at an early grade');
  assert.deepEqual(keywords('Pizza is good. Pizza is hot. The oven is hot!', 2).map((k) => [k.word, k.count]), [['hot', 2], ['pizza', 2]]);
});

test('phrases of two and three words, goals, pages, versions', async () => {
  const { phrases, goal, pages, keepVersion, count } = await import('../void-live-deploy/lib/wordcount.js');
  const t = 'The unit converter is exact. The unit converter shows every unit. A unit converter for engineers.';
  assert.deepEqual(phrases(t, 2).slice(0, 2).map((p) => [p.phrase, p.count]), [['unit converter', 3], ['the unit', 2]]);
  assert.deepEqual(phrases(t, 3).map((p) => p.phrase), ['the unit converter']);
  const g = goal(count('one two three'), 4); assert.deepEqual([g.done, g.left, g.reached], [3, 1, false]); assert.ok(goal(count('abcdef'), 5, 'characters').reached);
  assert.deepEqual(pages(1000), { single: 2, double: 4 });
  let v = keepVersion([], 'first', 0); v = keepVersion(v, 'first draft', 30000); assert.equal(v.length, 1, 'not within a minute');
  v = keepVersion(v, 'first draft', 61000); assert.equal(v.length, 2); assert.equal(v[0].text, 'first draft');
  v = keepVersion(v, 'first draft', 200000); assert.equal(v.length, 2, 'the same text twice is one version');
  v = keepVersion(v, 'x'.repeat(150), 200500); assert.equal(v.length, 3, 'a big change is kept at once');
  assert.equal(keepVersion([], '   ', 0).length, 0);
});
