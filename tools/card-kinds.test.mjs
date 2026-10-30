// What an answer is (lib/card-kinds.js): a Film, a Song, a Person ... and a name that is several things carries them all. Run: node --test tools/card-kinds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, alsoFrom, typeWords, kindOfWord, KINDS, newInSub, repeatsTitle } from '../void-live-deploy/lib/card-kinds.js';
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
  assert.equal(c.power, 1); assert.equal(c.toughness, 4, 'a source edited 40 days ago reads as freshness 4 of 9'); assert.equal(c.rarity, null);
});

test('newInSub: the line under the header keeps only what the header does not already say (owner, 2026-10-18, "The Fourth Kind")', () => {
  const h = (d) => { const k = kindOf(d); return typeWords(k.kind, [], k.detail); };
  const a = '2009 science fiction thriller film directed by Olatunde Osunsanmi';
  assert.equal(newInSub(a, h(a)), 'Science fiction thriller', 'the genre is new, the year and director are not');
  const b = '2009 film directed by Olatunde Osunsanmi'; assert.equal(newInSub(b, h(b)), '', 'it only restates the header');
  const c = '1942 American romantic drama film'; assert.equal(newInSub(c, h(c)), 'American romantic drama');
  const d = '1999 song by Britney Spears'; assert.equal(newInSub(d, h(d)), '');
  assert.equal(newInSub('Small domesticated carnivorous mammal', 'Creature'), 'Small domesticated carnivorous mammal', 'nothing in the header to repeat');
  assert.equal(newInSub('', 'Film'), '');
  const e = 'American basketball player (born 1963)'; assert.equal(newInSub(e, h(e)), 'American basketball player', 'the year is in the header, so "(born 1963)" goes whole, never "(born )"');
  const f = 'English poet (1795\u20131821)'; assert.equal(newInSub(f, h(f)), 'English poet (died 1821)', 'the year the header lacks stays, said as a death year');
  const g = 'Italian painter (b. 1450)'; assert.equal(newInSub(g, h(g)), 'Italian painter (b. 1450)', 'a year the header does not hold stays as it was');
});
test('repeatsTitle: a heading that only repeats the card title is redundant, a different one is not', () => {
  assert.equal(repeatsTitle('Show me the Site Test card', 'Site Test Card (Visa)'), true);
  assert.equal(repeatsTitle('what is a cat', 'Cat'), true);
  assert.equal(repeatsTitle('how do I boil an egg', 'Boiling an egg'), false);
  assert.equal(repeatsTitle('what is a cat', 'Care and feeding'), false);
  assert.equal(repeatsTitle('anything', ''), false);
});
