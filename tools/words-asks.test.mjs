// Words and the world, 2026-10-30: common ways of asking that reached no skill on a-to-mind.com, or the wrong one.
// "whats in the news today" went to the answer engine (it said it had no news feed), "good movies to watch tonight" was saved
// as a calendar event, and the others fell to an article. Each now reaches its skill; the near misses still do not.
//   node --test tools/words-asks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import news from '../void-live-deploy/skills/news.js';
import quote from '../void-live-deploy/skills/quote.js';
import recipe from '../void-live-deploy/skills/recipe.js';
import morse, { payloadOf } from '../void-live-deploy/skills/morse.js';
import magic8, { questionOf } from '../void-live-deploy/skills/magic8.js';
import mediaPick from '../void-live-deploy/skills/media-pick.js';
import { parseCalendar } from '../void-live-deploy/skills/calendar.js';
import { pickKind } from '../void-live-deploy/lib/media.js';

const claims = (s, a) => !!s.match(a.toLowerCase(), a);

test('the news today, by any of its common words', () => {
  for (const a of ['whats in the news today', "what's in the news now", 'what is in the news right now', "what's happening in the world today"]) assert.ok(claims(news, a), a);
  for (const a of ['what is fake news', 'news anchor jobs']) assert.ok(!claims(news, a), a);
});

test('a quote with a word for its kind', () => {
  for (const a of ['give me a motivational quote', 'tell me an inspiring quote', 'famous quotes', 'show me some wise quotes', 'quote', 'another quote']) assert.ok(claims(quote, a), a);
  for (const a of ['stock quotes', 'what is a quote', 'quote of the day news', 'get a quote for car insurance']) assert.ok(!claims(quote, a), a);
});

test('what can I make with what I have', () => {
  assert.ok(claims(recipe, 'what can i make with chicken and rice'));
  assert.ok(claims(recipe, 'what can I cook with eggs'));
  for (const a of ['what is a recipe', 'what can i make with my money', 'what can i make with my time']) assert.ok(!claims(recipe, a), a);
});

test('convert text to Morse code', () => {
  assert.equal(payloadOf('convert hello to morse code'), 'hello');
  assert.equal(payloadOf('translate "sos" into morse'), 'sos');
  assert.equal(payloadOf('turn hi there to morse'), 'hi there');
  assert.ok(claims(morse, 'convert hello to morse code'));
  for (const a of ['convert to morse', 'morse code history', 'what is morse']) assert.ok(!claims(morse, a), a);
});

test('a question for the magic 8 ball', () => {
  assert.equal(questionOf('magic 8 ball will i pass my test?'), 'will i pass my test');
  assert.ok(claims(magic8, 'magic 8 ball, should I text them'));
  for (const a of ['8 ball pool', 'magic 8 ball is it going to rain', 'buy a magic 8 ball']) assert.ok(!claims(magic8, a), a);
  const el = { innerHTML: '' };
  magic8.run('magic 8 ball will i pass my test', { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/</g, '&lt;') });
  assert.ok(el.innerHTML.includes('Will i pass my test?'));
});

test('a pick asked by what it is, and never saved as an event', () => {
  assert.deepEqual(pickKind('good movies to watch tonight'), { kind: 'movie', chosen: false });
  assert.deepEqual(pickKind('what should i watch on netflix'), { kind: 'movie', chosen: false });
  assert.deepEqual(pickKind('some great songs to listen to'), { kind: 'music', chosen: false });
  assert.ok(claims(mediaPick, 'good movies to watch tonight'));
  assert.equal(parseCalendar('good movies to watch tonight'), null);
  // a real event with "watch" in it is still an event
  assert.equal(parseCalendar('watch the game tomorrow at 8pm').kind, 'add');
  assert.equal(parseCalendar('dentist tomorrow at 3').kind, 'add');
});
