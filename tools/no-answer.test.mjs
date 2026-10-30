// A refusal is not an answer, and a list-page section is found (owner, 2026-10-26, "happy time harry"). Run: node --test tools/no-answer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoAnswer, linked, sourcesMatch, guessOf, listRedirect, sectionHit, sectionText, notFound, askWords } from '../void-live-deploy/lib/no-answer.js';
import { cardOf } from '../void-live-deploy/lib/card-frame.js';
import { codeOf, parse, cutAtWord, shareText } from '../void-live-deploy/lib/card-share.js';
import { sealPlan } from '../void-live-deploy/lib/void-seal.js';
import { motifsFor } from '../void-live-deploy/lib/card-subject.js';

// the owner's pasted card, word for word
const BODY = 'I do not have information regarding a person or entity specifically named "happy time harry." It is possible you are referring to Happy Harry\'s, an American drugstore chain founded by entrepreneur Harry Levin in 1962 and merged into Walgreens starting in 2006 [1]. If this is a reference to a specific person or a niche phrase, it is not contained within the provided sources.';
const SRC = [{ title: 'Happy Harry\'s', url: '' }];

test('the owner\'s card body is a no-answer; a real answer is not', () => {
  assert.equal(isNoAnswer(BODY), true);
  assert.equal(isNoAnswer('No information is available on this.'), true);
  assert.equal(isNoAnswer('The Information Age had no information limits.'), false);
  assert.equal(isNoAnswer('Happy Time Harry is a bitter action-figure doll voiced by David Cross.'), false);
  assert.equal(isNoAnswer('I couldn\'t find any information about that.'), true);
  assert.equal(isNoAnswer(''), false);
});
test('a source with no link is not listed', () => {
  assert.deepEqual(linked(SRC), []);
  assert.equal(linked([{ title: 'x', url: 'https://en.wikipedia.org/wiki/X' }, { title: 'y', url: 'http://a.b' }]).length, 1);
});
test('a Not found card is not a sourced answer and adds no fact', () => {
  const c = cardOf({ sources: 1, ageDays: 3, notFound: true });
  assert.equal(c.typeLine, 'Not found'); assert.equal(c.adds, ''); assert.equal(c.fetched, false); assert.equal(c.power, null);
  const real = cardOf({ sources: 1, ageDays: 3 });
  assert.equal(real.typeLine, 'Answer — from a source'); assert.match(real.adds, /fact it did not have to be taught/);
});
test('fuzzy neighbours are a guess, offered as a question', () => {
  const near = [{ title: 'Happy Harry\'s', text: 'Happy Harry\'s was an American drugstore chain founded in 1962.' }];
  assert.equal(sourcesMatch('happy time harry', near), false);
  assert.equal(guessOf(near), 'Happy Harry\'s');
  const nf = notFound('happy time harry', guessOf(near));
  assert.equal(nf.did, 'Did you mean Happy Harry\'s?'); assert.match(nf.line, /could not find/);
  assert.deepEqual(askWords('what is happy time harry?'), ['happy', 'time', 'harry']);
});
// the real answer: a redirect into a section of a list page. Stubbed in MediaWiki's own reply shapes (no network in the sandbox).
const LIST = 'Intro text.\n\n== Frylock ==\nFrylock is the leader.\n\n== Happy Time Harry ==\nHappy Time Harry is a bitter, nihilistic action-figure doll voiced by David Cross. He debuts in season 1, "Dumber Dolls", when Frylock buys him for Meatwad as a cheap substitute for Jiggle Billy.\n\n== Ignignokt ==\nIgnignokt is a Mooninite.';
test('a redirect into a list page section is read, and only that section', () => {
  const hit = listRedirect({ query: { redirects: [{ from: 'Happy Time Harry', to: 'List of Aqua Teen Hunger Force characters', tofragment: 'Happy Time Harry' }] } });
  assert.deepEqual(hit, { page: 'List of Aqua Teen Hunger Force characters', section: 'Happy Time Harry' });
  const t = sectionText(LIST, hit.section, 'happy time harry');
  assert.match(t, /^Happy Time Harry is a bitter/); assert.match(t, /David Cross/); assert.match(t, /Dumber Dolls/);
  assert.ok(!/Ignignokt|Frylock is the leader/.test(t), 'the next section does not leak in');
  assert.equal(sourcesMatch('happy time harry', [{ title: 'List of Aqua Teen Hunger Force characters § Happy Time Harry', text: t }]), true);
});
test('the full-text search finds a section when there is no redirect', () => {
  const hits = [{ title: 'Happy Harry\'s', snippet: 'a drugstore' }, { title: 'List of Aqua Teen Hunger Force characters', sectiontitle: 'Happy Time Harry', snippet: '<span class="searchmatch">Happy</span> <span class="searchmatch">Time</span> <span class="searchmatch">Harry</span> is a doll' }];
  assert.deepEqual(sectionHit(hits, 'happy time harry'), { page: 'List of Aqua Teen Hunger Force characters', section: 'Happy Time Harry' });
  assert.equal(sectionHit([hits[0]], 'happy time harry'), null);
});
// the general case: three other names that live inside a list page (stubbed shapes; the titles are examples, the sandbox has no network to confirm them live)
const CASES = [
  ['sideshow raheem', 'List of recurring The Simpsons characters', 'Sideshow Raheem', 'Sideshow Raheem is a carnival performer who appears now and then in Springfield.'],
  ['wonderwall', 'Definitely Maybe (album) tracks', 'Wonderwall', 'Wonderwall is the fourth track on the album.'],
  ['orangutan opening', 'List of chess openings', 'Orangutan Opening', 'The Orangutan Opening begins with 1.b4.'],
];
for (const [ask, page, section, para] of CASES) test('any "' + ask + '" that redirects into a section of a list page is read the same way', () => {
  const hit = listRedirect({ query: { redirects: [{ from: ask, to: page, tofragment: section }] } });
  assert.equal(hit.page, page);
  const t = sectionText('Lead.\n\n== Other ==\nUnrelated words.\n\n=== ' + section + ' ===\n' + para + '\n\n== Next ==\nMore.', section, ask);
  assert.equal(t, para);
});
test('a card\'s code line ends at a word, with the real link, and round-trips', () => {
  assert.equal(cutAtWord('founded by entrepreneur Harry Levin in 1962', 30), 'founded by entrepreneur Harry');
  const d = { t: 'Happy Time Harry', k: 'Answer — from a source', b: BODY, src: [{ title: 'Happy Harry\'s', url: '' }, { title: 'List of Aqua Teen Hunger Force characters', url: 'https://en.wikipedia.org/wiki/List_of_Aqua_Teen_Hunger_Force_characters#Happy_Time_Harry' }] };
  const code = codeOf(d), back = parse(code);
  assert.ok(back.b.length <= 200 && BODY.startsWith(back.b) && /\s/.test(BODY[back.b.length]), 'the code line body ends where a word ends: ' + back.b.slice(-12));
  assert.deepEqual(back.src, [{ t: 'List of Aqua Teen Hunger Force characters', u: 'https://en.wikipedia.org/wiki/List_of_Aqua_Teen_Hunger_Force_characters#Happy_Time_Harry' }]);
  const full = parse(shareText(d)); assert.equal(full.b, BODY);
});
test('the word "time" in a title does not pick a clock', () => {
  assert.deepEqual(motifsFor(['happy', 'time', 'harry']), []);
  assert.equal(sealPlan('happy time harry', { nouns: [] }).motif || '', '');
  assert.deepEqual(motifsFor(['clock']), ['clock']);
});
