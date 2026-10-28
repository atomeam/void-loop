// the translator's catch-up features: recent languages, language search, the on-screen keyboard, your corrections, conversation turns
import test from 'node:test';
import assert from 'node:assert/strict';
import { recentLangs, matchLangs, keyboardFor, KEYBOARD_LANGS, typeKey, fixKey, correctionFor, withCorrection, turn, RECENT_MAX } from '../void-live-deploy/lib/translate-extras.js';
import { LANGS } from '../void-live-deploy/lib/translate-langs.js';

test('recently used languages: newest first, no repeats, at most five, only real languages', () => {
  let r = [];
  for (const c of ['es', 'fr', 'es', 'de', 'auto', 'klingon', 'ja', 'it', 'pt']) r = recentLangs(r, c);
  assert.deepEqual(r, ['pt', 'it', 'ja', 'de', 'es']); assert.equal(r.length, RECENT_MAX);
  assert.deepEqual(recentLangs(null, 'fr'), ['fr']); assert.deepEqual(recentLangs(['xx', 'fr'], ''), ['fr']);
});

test('searching the language list by English name, own name, code or alias, accents ignored', () => {
  assert.equal(matchLangs('span')[0], 'es'); assert.equal(matchLangs('espa')[0], 'es'); assert.equal(matchLangs('deu')[0], 'de');
  assert.equal(matchLangs('ja')[0], 'ja'); assert.equal(matchLangs('中')[0], 'zh'); assert.ok(matchLangs('farsi').includes('fa'));
  assert.ok(matchLangs('gaelic').includes('gd')); assert.ok(matchLangs('creole').includes('ht'));
  assert.deepEqual(matchLangs(''), []); assert.deepEqual(matchLangs('zzzz'), []); assert.ok(matchLangs('a').length <= 12);
});

test('an on-screen keyboard for every script Verse translates that a US keyboard cannot type', () => {
  for (const c of ['ru', 'uk', 'el', 'ar', 'fa', 'he', 'hi', 'hy', 'ka', 'th', 'ko', 'es', 'de', 'fr', 'vi', 'pl', 'tr']) assert.ok(keyboardFor(c) && keyboardFor(c).flat().length >= 3, c);
  assert.equal(keyboardFor('en'), null); assert.equal(keyboardFor('xx'), null);
  for (const c of KEYBOARD_LANGS) assert.ok(LANGS[c], c);
  assert.ok(keyboardFor('ru').flat().includes('ж')); assert.ok(keyboardFor('de').flat().includes('ß')); assert.ok(keyboardFor('ar').flat().includes('ش'));
  assert.ok(KEYBOARD_LANGS.length >= 60);
});

test('a key goes in at the caret, replaces a selection, and backspace takes one letter', () => {
  assert.deepEqual(typeKey('ab', 1, 1, 'ж'), { value: 'aжb', caret: 2 });
  assert.deepEqual(typeKey('hello', 0, 5, 'ß'), { value: 'ß', caret: 1 });
  assert.deepEqual(typeKey('abc', 3, 3, '⌫'), { value: 'ab', caret: 2 });
  assert.deepEqual(typeKey('abc', 0, 0, '⌫'), { value: 'abc', caret: 0 });
  assert.deepEqual(typeKey('abc', 1, 3, '⌫'), { value: 'a', caret: 1 });
  assert.deepEqual(typeKey('a', 1, 1, '␣'), { value: 'a ', caret: 2 });
  assert.deepEqual(typeKey('', undefined, undefined, 'é'), { value: 'é', caret: 1 });
});

test('your correction comes back for the same words, and goes when you undo it', () => {
  assert.equal(fixKey('  Good   Morning ', 'en', 'es'), 'good morning␞en␞es');
  let f = withCorrection({}, 'Good morning', 'en', 'es', 'Buen día', 'Buenos días');
  assert.equal(correctionFor(f, 'good morning', 'en', 'es'), 'Buen día');
  assert.equal(correctionFor(f, 'good morning', 'en', 'fr'), '');
  f = withCorrection(f, 'hi', 'auto', 'es', 'Hola', 'Hola'); assert.equal(correctionFor(f, 'hi', 'auto', 'es'), '', 'the same as the machine is no correction');
  f = withCorrection(f, 'cat', 'auto', 'es', 'minino', 'gato'); assert.equal(correctionFor(f, 'cat', 'en', 'es'), 'minino', 'a detected-language correction serves a chosen one');
  f = withCorrection(f, 'Good morning', 'en', 'es', '', 'Buenos días'); assert.equal(correctionFor(f, 'Good morning', 'en', 'es'), '');
  let big = {}; for (let i = 0; i < 250; i++) big = withCorrection(big, 'w' + i, 'en', 'es', 'x' + i, 'y'); assert.equal(Object.keys(big).length, 200); assert.equal(correctionFor(big, 'w249', 'en', 'es'), 'x249');
});

test('a conversation turn translates each side into the other side\'s language', () => {
  assert.deepEqual(turn('a', 'en', 'es'), { side: 'a', from: 'en', to: 'es' });
  assert.deepEqual(turn('b', 'en', 'es'), { side: 'b', from: 'es', to: 'en' });
});
