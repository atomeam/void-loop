// The words skill (skills/words.js): letter patterns ("5 letter words starting with cr") and anagrams ("unscramble tlesi"),
// beside the synonyms, opposites, rhymes and spelling it already reads. Run: node --test tools/words.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import words, { wordsOf, anagramsIn } from '../void-live-deploy/skills/words.js';

test('words: letter patterns read as a Datamuse spelled-like pattern', () => {
  const cases = [
    ['5 letter words starting with cr', 'cr???'], ['five letter words that start with sh', 'sh???'],
    ['4-letter words beginning with q', 'q???'], ['6 letter words ending in ing', '???ing'],
    ['5 letter words starting with s and ending with e', 's???e'], ['words that start with xyl', 'xyl*'],
    ['words ending in ology', '*ology'], ['words starting with zz', 'zz*'], ['7 letter words that end with tion', '???tion']
  ];
  for (const [ask, sp] of cases) { const q = wordsOf(ask); assert.ok(q, ask); assert.equal(q.kind, 'pat', ask); assert.equal(q.sp, sp, ask); }
  // a prefix as long as the word asks nothing, and a silly length is not a word list
  for (const ask of ['3 letter words starting with cat', '40 letter words starting with a', 'words that start with a capital letter', 'sentences starting with and'])
    assert.equal(wordsOf(ask), null, ask);
});

test('words: anagram and unscramble asks, and the letters they keep', () => {
  for (const [ask, w] of [['unscramble tlesi', 'tlesi'], ['anagram of listen', 'listen'], ['anagrams for stop', 'stop'], ['unscramble the letters rtae', 'rtae'], ['what is an anagram of night', 'night']]) {
    const q = wordsOf(ask); assert.ok(q, ask); assert.equal(q.kind, 'ana', ask); assert.equal(q.word, w, ask);
  }
  for (const ask of ['what is an anagram', 'anagram', 'unscramble', 'unscramble my life']) assert.equal(wordsOf(ask), null, ask);
  assert.deepEqual(anagramsIn(['silent', 'enlist', 'listen', 'tinsel', 'lister', 'inlets', 'Silent'], 'listen'), ['silent', 'enlist', 'tinsel', 'inlets']);
  assert.deepEqual(anagramsIn(['islet', 'istle', 'tiles', 'stile', 'title'], 'tlesi'), ['islet', 'istle', 'tiles', 'stile']);
});

test('words: the older asks still read the same, and the examples are all taken', () => {
  assert.equal(wordsOf('synonym for happy').kind, 'syn');
  assert.equal(wordsOf('what rhymes with orange').kind, 'rhy');
  assert.equal(wordsOf('how do you spell necessary').kind, 'spell');
  assert.ok(words.examples.every((e) => wordsOf(e)), 'every example is taken');
  assert.ok(words.nearMisses.every((e) => !wordsOf(e)), 'no near miss is taken');
});

// A word in the list is a tap from a picture of it (asked by Verse): the cartoon skill's own ask, with the article it expects.
import { pictureAsk } from '../void-live-deploy/skills/words.js';
test('words: each listed word links to a cartoon of it', () => {
  assert.equal(pictureAsk('tiles'), 'cartoon version of a tiles');
  assert.equal(pictureAsk('islet'), 'cartoon version of an islet');
  assert.equal(pictureAsk("it's"), ''); assert.equal(pictureAsk(''), '');
});
