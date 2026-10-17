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

test('the K-pop card draws music, not the search: "void" and "match" are not its subject, and music words draw a note (owner, 2026-10-17)', () => {
  const s = subjectOf('K-pop', 'South Korean popular music genre. K-pop is a form of popular music originating in South Korea, from idol acts, girl groups and boy bands.');
  assert.ok(!s.nouns.includes('void') && !s.nouns.includes('match')); assert.equal(s.nouns[0], 'music'); assert.deepEqual(motifsFor(s.nouns), ['note']);
  const thin = nounsOf('Closest match I found for void kpop'); for (const w of ['closest', 'match', 'void']) assert.ok(!thin.includes(w), w);
});
