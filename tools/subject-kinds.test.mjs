// The subject-kind table (lib/subject-kinds.js) and the route's side of the evaluation (tools/subject-stub.mjs + tools/fixtures/subject-eval.json).
// The browser half (cards drawn and screenshotted) is `node tools/subject-eval.mjs`. Run: node --test tools/subject-kinds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SUBJECT_KINDS, badgesOf, noticeOf, themeOf, describeSection, seriesOfList } from '../void-live-deploy/lib/subject-kinds.js';
import { kindOf, KINDS } from '../void-live-deploy/lib/card-kinds.js';
import { grounded, isNameAsk } from '../void-live-deploy/lib/no-answer.js';
import { answerFor } from './subject-stub.mjs';

test('every kind the card builder can name has a row in the table', () => {
  for (const [kind] of KINDS) assert.ok(SUBJECT_KINDS[kind], kind + ' has no row in lib/subject-kinds.js');
});
test('the kind is read from the description, then the first words of the extract, and the catch-all is only a fallback', () => {
  assert.equal(kindOf('fictional character from Aqua Teen Hunger Force').kind, 'Character');
  assert.equal(kindOf('Relation between the sides of a right triangle', 'In mathematics, the Pythagorean theorem is a fundamental relation').kind, 'Concept');
  assert.equal(kindOf('chess opening').kind, 'Concept');
  assert.equal(kindOf('Ancient Greek god of the sky').kind, 'Myth');
  assert.equal(kindOf('Italian dish').kind, 'Food');
  assert.equal(kindOf('a thing nobody typed').kind, 'Idea');
});
test('badges are read from the answer and only when it says them', () => {
  assert.deepEqual(badgesOf('Character', 'Happy Time Harry is a doll voiced by David Cross. He debuts in "Dumber Dolls".'), [['Voice', 'David Cross'], ['Debut', 'Dumber Dolls']]);
  assert.deepEqual(badgesOf('Character', 'Happy Time Harry is a doll.'), [], 'no voice actor in the text, none shown');
  assert.deepEqual(badgesOf('Person', 'Albert Einstein (born 14 March 1879) was a German-born theoretical physicist (1879–1955).')[0], ['Born', '1879']);
  assert.deepEqual(badgesOf('Band', 'The Beatles were an English rock band formed in Liverpool in 1960.'), [['Formed', '1960']]);
  assert.deepEqual(badgesOf('Nope', 'x'), []);
});
test('only someone else\'s characters carry the "not affiliated" line, and it names no logo or brand mark', () => {
  assert.match(noticeOf('Character', 'Aqua Teen Hunger Force'), /not affiliated with the Aqua Teen Hunger Force series or its makers/);
  assert.equal(noticeOf('Place'), ''); assert.equal(noticeOf('Person'), '');
  assert.equal(themeOf('Character'), 'collectible'); assert.equal(themeOf('Place'), 'postcard'); assert.equal(themeOf('Organisation'), 'plain');
});
test('a list page names the work and the kind of thing its section is', () => {
  assert.equal(seriesOfList('List of Aqua Teen Hunger Force characters'), 'Aqua Teen Hunger Force');
  assert.equal(describeSection('List of Aqua Teen Hunger Force characters'), 'fictional character from Aqua Teen Hunger Force');
  assert.equal(describeSection('List of recurring The Simpsons characters'), 'fictional character from Simpsons');
  assert.equal(describeSection('Morning Glory track listing'), 'song on Morning Glory');
  assert.equal(describeSection('Some other page'), '');
});
test('only what the fetched section says survives: an invented price or actor is dropped', () => {
  const src = 'Happy Time Harry is a bitter action-figure doll voiced by David Cross. He debuts in "Dumber Dolls".';
  assert.equal(grounded('Happy Time Harry is a bitter doll voiced by David Cross [1]. He cost $4.99 at Walmart [1]. He debuts in "Dumber Dolls" [1].', src), 'Happy Time Harry is a bitter doll voiced by David Cross [1]. He debuts in "Dumber Dolls" [1].');
  assert.match(grounded('He was voiced by Seth Green.', src), /^Happy Time Harry is a bitter action-figure doll/, 'nothing left: the fetched text itself');
});
test('a how-to is not a name ask', () => { assert.equal(isNameAsk('how to bake bread'), false); assert.equal(isNameAsk('happy time harry'), true); assert.equal(isNameAsk('what is the capital of france'), true); });

// the route half of every fixture: what /api/answer returns, with Wikipedia and the model stubbed
const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/subject-eval.json', import.meta.url), 'utf8'));
test('the fixture set covers 30 or more asks of every kind', () => { assert.ok(FX.length >= 30, String(FX.length)); const kinds = new Set(FX.map((f) => (f.expect || {}).type).filter(Boolean)); for (const k of ['Person', 'Band', 'Song', 'Album', 'Film', 'Book', 'Game', 'Place', 'Creature', 'Food', 'Vehicle', 'Myth', 'Concept', 'Event', 'Organisation', 'Character', 'Not found']) assert.ok([...kinds].some((x) => x.includes(k)), 'no fixture for ' + k); });
for (const fx of FX.filter((f) => !f.liveOnly)) test('route: ' + fx.ask, async () => {
  const { json: j } = await answerFor(fx), e = fx.expect || {};
  if (e.type === 'Not found') { assert.equal(j.answer, null); assert.equal(j.noAnswer, true); assert.deepEqual(j.sources, []); if (e.didYouMean) assert.equal(j.guess, e.didYouMean); else assert.equal(j.guess, undefined); return; }
  assert.ok(j.answer, 'an answer'); assert.ok(!j.noAnswer);
  assert.ok((j.sources || []).every((s) => /^https:\/\//.test(s.url)), 'every listed source has a link');
  if (e.guess) assert.equal(j.fuzzy, true); else if (e.guess === false) assert.ok(!j.fuzzy);
  if (e.photo === true) { assert.ok(j.pic && /^https:/.test(j.pic.url) && j.pic.archive, 'a licensed picture'); assert.ok(j.pic.credit.some((s) => s.href && /^https:/.test(s.href)), 'with its credit links'); }
  if (e.photo === false || (e.type && /Person|Character|Not found/.test(e.type))) assert.ok(!j.pic, 'no photo for a person, a character or a refusal');
  if (e.notBody) assert.ok(!new RegExp(e.notBody, 'i').test(j.answer), j.answer);
  if (e.title && j.name) assert.equal(j.name.toLowerCase().replace(/[^a-z0-9]/g, ''), e.title.toLowerCase().replace(/[^a-z0-9]/g, ''));
});
