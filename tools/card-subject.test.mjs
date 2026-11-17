// The card's subject comes from its answer, not the ask (lib/card-subject.js): the owner's "pick a movie to watch with me" card, answered with a film about an embalmed hand and spirits.
// Run: node --test tools/card-subject.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { subjectOf, nounsOf, motifsFor, motifSvg } from '../void-live-deploy/lib/card-subject.js';
import { artInner } from '../void-live-deploy/lib/card-art.js';

const ANSWER = 'Try Talk to Me (2022), a horror film for teens where friends use an embalmed hand to speak with spirits. Each time the hand is held, a spirit takes over, and the hand becomes a danger. Teens, grief and the hand are the heart of the film.';
test('the subject is the answer\'s own nouns (hand, spirits), not the ask\'s words or the film name', () => {
  const s = subjectOf('pick a movie to watch with me', ANSWER);
  assert.ok(s.nouns.includes('hand') && s.nouns.includes('spirits'), s.phrase);
  assert.ok(!/pick|watch|movie|talk/.test(s.phrase), s.phrase);
  assert.deepEqual(motifsFor(s.nouns).slice(0, 2).sort(), ['ghost', 'hand']);
  assert.ok(s.phrase.length <= 60);
});
test('too little answer falls back to the title\'s content words; nothing gives nothing', () => {
  assert.deepEqual(subjectOf('a lighthouse keeper', 'ok').nouns, ['lighthouse', 'keeper']);
  assert.deepEqual(subjectOf('', '').nouns, []); assert.equal(nounsOf(null).length, 0);
});
test('the plate draws the subject: a hand and a ghost instead of the generic plate, and the haunted skin steps aside', () => {
  const card = { key: 'a ghost story to watch with me', kind: 'Answer', hue: 20, season: 'halloween' };
  const generic = artInner(card), drawn = artInner({ ...card, nouns: ['hand', 'spirits', 'teens'] });
  assert.notEqual(generic, drawn); assert.ok(drawn.includes('M28 92L26 62'), 'the hand'); assert.ok(drawn.includes('M18 94L18 44'), 'the ghost');
  assert.ok(!/ff7a1a/.test(drawn) && /ff7a1a/.test(generic), 'no pumpkin rim on a subject plate');
  assert.equal(artInner({ ...card, nouns: ['teens'] }), generic, 'a word with no drawing keeps the plate');
  assert.equal(motifSvg([], 100, 100, {}), '');
});

test('the banner follows the topic (owner, 2026-10-18): code words draw a terminal, geography a landscape, space the star; old words keep their motif', () => {
  assert.deepEqual(motifsFor(subjectOf('write a python function', 'Here is a function that fixes the bug in your script.').nouns).slice(0, 1), ['code']);
  assert.deepEqual(motifsFor(['geography', 'country']), ['landscape']);
  assert.deepEqual(motifsFor(['telescope', 'galaxy']), ['star']);
  assert.deepEqual(motifsFor(['mountain', 'river']), ['mountain', 'wave'], 'a word an earlier motif had keeps it');
  for (const m of ['code', 'landscape']) assert.ok(motifSvg([m], 100, 100, { P: '#fff', L: '#ccc', G: '#fc0', ink: '#000', sw: 1 }).includes('<path'), m);
});

test('a car loan card draws a car and a loan ledger, not the generic plate (owner, 2026-11-17); mortgages and savings draw the ledger too', () => {
  const card = { key: 'Car loan payment', name: 'Car loan payment', kind: 'Skill', typeLine: 'SKILL — NUMBERS AND MONEY', hue: 150, rarity: 'Rare' };
  const s = subjectOf(card.key, ''); assert.deepEqual(motifsFor(s.nouns), ['car', 'loan']);
  const generic = artInner(card), drawn = artInner({ ...card, nouns: s.nouns });
  assert.notEqual(drawn, generic, 'the car loan picture is its own'); assert.ok(drawn.includes('M6 68V56Q6 50'), 'the car'); assert.ok(drawn.includes('M18 78V66H30V78'), 'the ledger bars');
  assert.ok(!/M6 68V56Q6 50/.test(generic), 'the plate draws no car');
  assert.deepEqual(motifsFor(['mortgage', 'rate']), ['loan']); assert.deepEqual(motifsFor(['savings', 'interest']), ['loan']);
  assert.deepEqual(motifsFor(['stock']), ['chart'], 'money words that were not car or loan keep their chart');
  for (const m of ['car', 'loan']) assert.ok(motifSvg([m], 100, 100, { P: '#fff', L: '#ccc', G: '#fc0', ink: '#000', sw: 1 }).includes('<path'), m);
});

test('a short noun with a motif is read: "Cat" draws a cat, "sun" and "sea" draw theirs; common short words (key, day) are not subjects (owner, 2026-11-17)', () => {
  const cat = subjectOf('Cat', ''); assert.deepEqual(motifsFor(cat.nouns), ['cat'], cat.phrase);
  assert.ok(artInner({ key: 'Cat', kind: 'Skill', nouns: cat.nouns }).includes('M16 44L20 6'), 'the cat drawing');
  assert.deepEqual(motifsFor(subjectOf('', 'The sun rose over the sea, and the sun stayed up all day.').nouns), ['sun', 'wave']);
  const prose = subjectOf('', 'a key point about the day and the key plan for the week');
  assert.ok(!prose.nouns.includes('key') && !prose.nouns.includes('day'), prose.phrase);
});

test('the K-pop card draws music, not the search: "void" and "match" are not its subject, and music words draw a note (owner, 2026-10-17)', () => {
  const s = subjectOf('K-pop', 'South Korean popular music genre. K-pop is a form of popular music originating in South Korea, from idol acts, girl groups and boy bands.');
  assert.ok(!s.nouns.includes('void') && !s.nouns.includes('match')); assert.equal(s.nouns[0], 'music'); assert.deepEqual(motifsFor(s.nouns), ['note']);
  const thin = nounsOf('Closest match I found for void kpop'); for (const w of ['closest', 'match', 'void']) assert.ok(!thin.includes(w), w);
});
