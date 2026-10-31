// A flashcard ask that names a topic and gives no pairs makes a deck: a starter deck when Verse ships one, an empty deck otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/study-cards.js';

test('flashcards for a topic with a starter deck get real cards', () => {
  for (const ask of ['make flashcards for spanish verbs', 'Make me flashcards for Spanish verbs.', 'spanish verb flashcards', 'make spanish verb flashcards', 'flashcards for common spanish verbs']) {
    const p = S.parseStudy(ask);
    assert.equal(p && p.mode, 'flash', ask);
    assert.equal(p.title, 'Spanish verbs', ask);
    assert.ok(p.pairs.length >= 30, ask);
    assert.deepEqual(p.pairs[0], { q: 'ser', a: 'to be (what something is)' });
  }
  const fr = S.parseStudy('make flashcards for french verbs');
  assert.equal(fr.title, 'French verbs');
  assert.equal(fr.pairs[0].q, 'être');
  const deck = S.deckOf(fr, '2026-10-30');
  assert.equal(deck.cards.length, fr.pairs.length);
  assert.match(deck.note, /starter deck/);
});

test('flashcards for a topic Verse has no deck for make an empty deck with that name', () => {
  const p = S.parseStudy('make flashcards for organic chemistry');
  assert.deepEqual(p, { mode: 'flash', title: 'organic chemistry', pairs: [] });
});

test('asks that name no deck stay with other skills', () => {
  for (const no of ['what are flashcards', 'best flashcard app for medical school', 'make flashcards for me', 'how do flashcards work', 'make me flashcards']) assert.equal(S.parseStudy(no), null, no);
  assert.equal(S.parseStudy('make flashcards for spanish: casa = house').pairs.length, 1);
});
