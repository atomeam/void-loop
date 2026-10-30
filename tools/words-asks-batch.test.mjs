// Asks in the words family that a-to-mind.com answered wrongly or thinly on 2026-10-30, and what answers them now:
// - "tell me a fun fact", "random fact": the page's small talk answered from 12 lines with no source, so the fact skill never saw its own examples
// - "ask the 8 ball ...": without "magic" it fell to an article
// - "quote of the day": fell to an article; Wikiquote has a page for each day (and its 2026 pages have a new shape the parser did not read)
// - "a joke about cats": fell to an article; icanhazdadjoke has a search
// - "an old saying", "book recommendations like the hobbit": fell to an article
//   node --test tools/words-asks-batch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fact, { isFact } from '../void-live-deploy/skills/fact.js';
import quote, { isDayQuote, dayTitle, qotdFrom } from '../void-live-deploy/skills/quote.js';
import joke, { jokeTopic, aboutTopic } from '../void-live-deploy/skills/joke.js';
import proverb from '../void-live-deploy/skills/proverb.js';
import book, { bookOf } from '../void-live-deploy/skills/book.js';

const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function ask(skill, text, answer) {
  const el = { innerHTML: '' }, real = globalThis.fetch, seen = [];
  globalThis.fetch = async (u) => { seen.push(String(u)); const b = answer(String(u)); if (b instanceof Error) throw b; return { ok: true, json: async () => b }; };
  try { const r = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true }); return { r, html: el.innerHTML, seen }; }
  finally { globalThis.fetch = real; }
}

test('fun-fact asks reach the fact skill, and the page no longer answers them from its own list', () => {
  for (const a of ['tell me a fun fact', 'give me a random fact', 'tell me something interesting', 'an interesting fact', 'fun fact', 'random fact', 'tell me a fact']) assert.ok(fact.match(a.toLowerCase(), a), a);
  for (const a of ['what is a fact', 'fact or opinion', 'facts about space', 'tell me something about rome']) assert.ok(!isFact(a), a);
  assert.ok(!page.includes('FUN_FACTS'), 'the small-talk fact list is gone');
  assert.ok(!/smallTalk[\s\S]{0,4000}interesting\)\\s\+fact/.test(page));
});

test('"ask the 8 ball" and "shake the 8 ball" shake the ball, with or without "magic"', () => {
  const line = page.split('\n').find((l) => l.includes("note: 'for fun: it is a random pick of the classic 20 answers', eight: true"));
  const re = new RegExp(line.match(/if \(\/(.+?)\/\.test\(l\)\)/)[1]);
  for (const a of ['ask the 8 ball will it work', 'shake the 8 ball', 'ask the magic 8 ball', 'magic 8 ball will i get the job', 'shake the magic 8-ball']) assert.ok(re.test(a), a);
  for (const a of ['8 ball', '8 ball pool', 'ask the eight ball team']) assert.ok(!re.test(a), a);
});

// today's page as Wikiquote's parse API gave it on 2026-10-30, trimmed: a Cquote table, the author in <cite>
const stewart = '<div class="mw-parser-output"><table><tbody><tr><td align="center"><span typeof="mw:File"><img src="//x"/></span>\n</td>\n<td align="center">\n'
  + '<table style="margin:auto;" class="cquote">\n<tbody><tr>\n<td width="20" valign="top" style="font-size:35px;">\u201c\n</td>\n<td valign="top" style="padding:4px 10px;">I could walk onto the set '
  + '<a href="/wiki/Confident" title="Confident">confident</a> that I knew how he would respond to almost any situation.\n</td>\n<td width="20" valign="bottom">\u201d\n</td></tr>\n'
  + '<tr>\n<td colspan="3"><p style="font-size:smaller;text-align: right"><cite style="font-style:normal;">\u2014<a href="/wiki/Patrick_Stewart" title="Patrick Stewart">Patrick Stewart</a></cite></p>\n</td></tr></tbody></table>\n</td></tr></tbody></table></div>';

test('"quote of the day" asks for today\'s Wikiquote page, and the 2026 page shape is read', async () => {
  for (const a of ['quote of the day', 'what is the quote of the day?', "what's today's quote", 'daily quote']) { assert.ok(isDayQuote(a), a); assert.ok(quote.match(a.toLowerCase(), a), a); }
  for (const a of ['quote of the day news', 'stock quotes', 'what is a quote']) assert.ok(!quote.match(a.toLowerCase(), a), a);
  assert.equal(dayTitle(new Date(2026, 9, 30)), 'Wikiquote:Quote of the day/October 30, 2026');
  assert.deepEqual(qotdFrom(stewart), { quote: 'I could walk onto the set confident that I knew how he would respond to almost any situation.', author: 'Patrick Stewart' });
  const o = await ask(quote, 'quote of the day', () => ({ parse: { text: stewart } }));
  assert.equal(o.r, 'quote');
  assert.ok(o.seen[0].includes(encodeURIComponent(dayTitle(new Date()))), o.seen[0]);
  assert.match(o.html, /<h2>Quote of the day<\/h2>/); assert.ok(o.html.includes('Patrick Stewart'));
  assert.match(o.html, /Source: <a href="https:\/\/en\.wikiquote\.org\/wiki\/Wikiquote:Quote_of_the_day\/\w+_\d{1,2},_\d{4}"[^>]*>Wikiquote, quote of the day for \w+ \d{1,2}, \d{4}<\/a>/);
  // no page for today: a quote from another day, and the card says so
  const m = await ask(quote, 'quote of the day', (u) => (u.includes(encodeURIComponent(dayTitle(new Date()))) || u.includes(encodeURIComponent(dayTitle(new Date(), false))) ? { error: { code: 'missingtitle' } } : { parse: { text: stewart } }));
  assert.equal(m.r, 'quote'); assert.match(m.html, /no quote of the day for today, so this is one from another day/); assert.match(m.html, /<h2>A quote<\/h2>/);
});

test('a joke about a topic: the search, only jokes that name it as a word, and a plain "none" when there is none', async () => {
  assert.equal(jokeTopic('a joke about cats'), 'cat'); assert.equal(jokeTopic('a joke about cats', true), 'cats');
  assert.equal(jokeTopic('tell me a dad joke about pizza'), 'pizza'); assert.equal(jokeTopic('any jokes about buses'), 'bus'); assert.equal(jokeTopic('a joke about tennis'), 'tennis');
  for (const a of ['jokes about me', 'is this a joke about money', 'tell me a joke']) assert.equal(jokeTopic(a), '', a);
  assert.deepEqual(aboutTopic([{ joke: 'She was a roman catholic.' }, { joke: 'My cats ran off.' }, { joke: 'The cat sat.' }], 'cat').map((j) => j.joke), ['My cats ran off.', 'The cat sat.']);
  for (const a of joke.examples) assert.ok(joke.match(a.toLowerCase(), a), a);
  for (const a of joke.nearMisses) assert.ok(!joke.match(a.toLowerCase(), a), a);
  let o = await ask(joke, 'a joke about cats', () => ({ results: [{ id: 'a1', joke: 'She was a roman catholic.' }, { id: 'b2', joke: 'Why was the big cat disqualified? Because it was a cheetah.' }] }));
  assert.equal(o.r, 'joke'); assert.ok(o.seen[0].startsWith('https://icanhazdadjoke.com/search?') && o.seen[0].includes('term=cat'), o.seen[0]);
  assert.ok(o.html.includes('<h2>A joke about cats</h2>') && o.html.includes('cheetah') && !o.html.includes('catholic'), o.html);
  assert.ok(o.html.includes('href="https://icanhazdadjoke.com/j/b2"'));
  o = await ask(joke, 'a joke about zzyzx', () => ({ results: [] }));
  assert.equal(o.r, 'joke'); assert.match(o.html, /icanhazdadjoke has no joke about zzyzx/);
  o = await ask(joke, 'a joke about cats', () => new Error('offline'));
  assert.equal(o.r, 'none'); assert.match(o.html, /didn't answer just now/);
});

test('"an old saying" is a proverb, and "book recommendations like the hobbit" is the book skill\'s "books like"', () => {
  for (const a of ['an old saying', 'tell me an old saying', 'a famous saying', 'wise saying']) assert.ok(proverb.match(a.toLowerCase(), a), a);
  for (const a of proverb.nearMisses) assert.ok(!proverb.match(a.toLowerCase(), a), a);
  assert.deepEqual(bookOf('book recommendations like the hobbit'), { q: 'hobbit', isbn: false, like: true });
  assert.deepEqual(bookOf('recommend me books like dune'), { q: 'dune', isbn: false, like: true });
  for (const a of book.nearMisses) assert.ok(!book.match(a.toLowerCase(), a), a);
});
