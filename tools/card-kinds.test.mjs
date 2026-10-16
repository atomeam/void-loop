// What an answer is (lib/card-kinds.js): a Film, a Song, a Person ... and a name that is several things carries them all. Run: node --test tools/card-kinds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, alsoFrom, typeWords, kindOfWord, KINDS } from '../void-live-deploy/lib/card-kinds.js';
import { cardOf } from '../void-live-deploy/lib/card-frame.js';

test('a page is typed by what its short description says', () => {
  const cases = [['1965 film by Clive Donner', 'Film'], ['2010 song by Katy Perry', 'Song'], ['British rock band', 'Band'], ['American actor (born 1935)', 'Person'], ['capital of France', 'Place'], ['species of mammal', 'Creature'], ['American multinational technology company', 'Organisation'], ['1939–1945 global conflict', 'Idea'], ['1994 video game', 'Game'], ['novel by Jane Austen', 'Book'], ['American sitcom', 'Show'], ['trading card from the Pokémon card game', 'Card'], ['Magic: The Gathering card', 'Card']];
  for (const [d, k] of cases) assert.equal(kindOf(d).kind, k, d);
  assert.deepEqual(kindOf('1965 film by Clive Donner'), { kind: 'Film', chapter: 'stage', detail: '1965 · Clive Donner' });
  assert.equal(kindOf('').kind, 'Idea'); assert.ok(KINDS.length >= 12);
});

test('a name that is also a song says so: the sister pages\' titles name the other kinds', () => {
  assert.deepEqual(alsoFrom(["What's New Pussycat? (song)", "What's New Pussycat? (album)", 'What\'s New Pussycat?', 'Other thing (song)'], "What's New Pussycat?"), ['Song', 'Album']);
  assert.deepEqual(alsoFrom(['Mercury (planet)', 'Mercury (element)'], 'Mercury'), [], 'planets and elements are not kinds yet: nothing is guessed');
  assert.equal(kindOfWord('TV series'), 'Show'); assert.equal(kindOfWord('nothing'), '');
  assert.equal(typeWords('Film', ['Song'], '1965 · Clive Donner'), 'Film · Song — 1965 · Clive Donner');
  assert.equal(typeWords('Film', ['Film']), 'Film');
});

test('the card carries the type, its colour and its glyph family', () => {
  const c = cardOf({ entity: { kind: 'Film', also: ['Song'], detail: '1965 · Clive Donner', chapter: 'stage' }, sources: 1, ageDays: 40 });
  assert.equal(c.typeLine, 'Film · Song — 1965 · Clive Donner'); assert.equal(c.chapter, 'stage');
  assert.equal(c.power, 1); assert.equal(c.toughness, 40); assert.equal(c.rarity, null);
});
