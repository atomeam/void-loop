// The quote skill (skills/quote.js), 2026-10-30: api.quotable.io no longer answered, so "give me a motivational quote" and
// "another quote" on a-to-mind.com both showed one fixed line with no source. The skill now shows Wikiquote's quote of the day
// for a random past day, attributed as Wikiquote attributes it, with that day's page as its source.
//   node --test tools/quote-wikiquote.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import quote, { qotdTitle, qotdFrom, themeOf, pickSection, themeQuotes } from '../void-live-deploy/skills/quote.js';

// the two shapes Wikiquote's parse API gave on 2026-10-30, trimmed (October 30, 2024: a nested table; March 3, 2011: paragraphs)
const adams = '<div class="mw-parser-output"><table><tbody><tr><td align="center"><span typeof="mw:File"><a href="/wiki/File:X.jpg"><img src="//x"/></a></span>\n</td>\n<td align="center"> \n</td>\n'
  + '<td align="center">\n<table><tbody><tr>\n<td>The <a href="/wiki/Rights">right</a> of a nation to kill a tyrant, in cases of necessity, can no more be doubted, than to hang a robber, or kill a flea.\n</td></tr>\n'
  + '<tr>\n<td style="font-size:smaller;">~ <a href="/wiki/John_Adams" title="John Adams">John Adams</a> ~\n</td></tr></tbody></table>\n</td></tr></tbody></table>\n<!-- NewPP limit report\nCPU time usage: 0.013 seconds\n--></div>';
const jorn = '<div class="mw-parser-output"><table>\n<tbody><tr>\n<td align="center"><span typeof="mw:File"><img src="//y"/></span>\n</td>\n<td align="center"> \n</td>\n'
  + '<td align="center"><p>Those who try to combat the production of shoddy pictures are enemies of the best art today. It always feels tragic to see people labouring to saw off the branch they are sitting on. </p>'
  + '<p> ~ <a href="/wiki/Asger_Jorn" title="Asger Jorn">Asger Jorn</a> ~ </p>\n</td></tr></tbody></table></div>';

test('the day page names a real past day', () => {
  assert.equal(qotdTitle(() => 0), 'Wikiquote:Quote of the day/January 1, 2008');
  const now = Date.UTC(2026, 9, 30, 12);
  for (const r of [0.25, 0.5, 0.999999]) {
    const m = qotdTitle(() => r, now).match(/\/(\w+) (\d{1,2}), (\d{4})$/);
    assert.ok(m, r); assert.ok(Date.UTC(+m[3], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(m[1]), +m[2]) < now);
  }
});

test('both page shapes give the quote and its author, as plain text', () => {
  assert.deepEqual(qotdFrom(adams), { quote: 'The right of a nation to kill a tyrant, in cases of necessity, can no more be doubted, than to hang a robber, or kill a flea.', author: 'John Adams' });
  assert.deepEqual(qotdFrom(jorn), { quote: 'Those who try to combat the production of shoddy pictures are enemies of the best art today. It always feels tragic to see people labouring to saw off the branch they are sitting on.', author: 'Asger Jorn' });
  // no "~ Name ~" line, an empty page or an author with no quote: nothing, never a guess
  assert.equal(qotdFrom('<p>Just some text with no author line.</p>'), null);
  assert.equal(qotdFrom(''), null);
  assert.equal(qotdFrom('<p>~ Somebody ~</p>'), null);
  // the 2008 shape: italics, a line break inside the quote, and a footer after the author line
  assert.deepEqual(qotdFrom('<p><i>Be a clown, be a clown, <br/>All the world loves a clown.</i> </p><p> ~ <a href="/wiki/Cole_Porter">Cole Porter</a> ~ </p><div class="noprint">Past months \u2013 email</div>'), { quote: 'Be a clown, be a clown, All the world loves a clown.', author: 'Cole Porter' });
  // entities are decoded once; markup in the page never reaches the card as markup
  assert.equal(qotdFrom('<p>Fish &amp; chips &#8220;always&#8221; &lt;b&gt;win&lt;/b&gt;.</p><p>~ A. Cook ~</p>').quote, 'Fish & chips “always” <b>win</b>.');
});

async function ask(text, pages) {
  const el = { innerHTML: '' }, real = globalThis.fetch, asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); const p = pages.shift(); if (p instanceof Error) throw p; return { ok: true, json: async () => p }; };
  try {
    const r = await quote.run(text, { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), _pageStill: () => true });
    return { r, html: el.innerHTML, asked };
  } finally { globalThis.fetch = real; }
}

test('an ask shows a Wikiquote quote with its author and that day\'s page as the source', async () => {
  const { r, html, asked } = await ask('tell me a quote', [{ parse: { text: adams } }]);
  assert.equal(r, 'quote');
  assert.ok(asked[0].startsWith('https://en.wikiquote.org/w/api.php?') && asked[0].includes('origin=*') && asked[0].includes('Quote%20of%20the%20day%2F'), asked[0]);
  assert.ok(html.includes('kill a flea.”') && html.includes('>John Adams</p>'), html);
  assert.match(html, /Source: <a href="https:\/\/en\.wikiquote\.org\/wiki\/Wikiquote:Quote_of_the_day\/\w+_\d{1,2},_\d{4}"[^>]*>Wikiquote, \w+ \d{1,2}, \d{4}<\/a>/);
  assert.ok(!html.includes('Steve Jobs'));
});

test('a missing day is skipped for another, and no answer at all says so instead of a fixed quote', async () => {
  let o = await ask('another quote', [{ error: { code: 'missingtitle' } }, { parse: { text: jorn } }]);
  assert.equal(o.r, 'quote'); assert.equal(o.asked.length, 2); assert.ok(o.html.includes('Asger Jorn'));
  o = await ask('random quote', [new Error('offline'), new Error('offline'), new Error('offline')]);
  assert.equal(o.r, 'none'); assert.equal(o.asked.length, 3);
  assert.match(o.html, /Wikiquote didn't answer just now/); assert.ok(!o.html.includes('Steve Jobs'));
});

test('the asks it claims are unchanged', () => {
  for (const a of ['tell me a quote', 'random quote', 'inspirational quote', 'another quote', 'give me a motivational quote', 'famous quotes']) assert.ok(quote.match(a.toLowerCase(), a), a);
  for (const a of ['what is a quote', 'stock quotes', 'quote of the day news']) assert.ok(!quote.match(a.toLowerCase(), a), a);
});

// the shape of a Wikiquote theme page on 2026-10-30 (Perseverance, section "F"; Motivation, section "Quotes"), trimmed
const persevere = '<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="F">F</h2></div>\n<ul><li>Run every day. If you can\'t run, walk fast. If you can\'t walk fast, walk as fast as you can.\n'
  + '<ul><li>Michael Fitzgerald, quoted in <i>The Writer\'s Hustle</i> by Joey Franklin (2023)</li></ul></li></ul>\n'
  + '<ul><li>Motivation is a battle for the heart, not just an appeal to the mind.\n<ul><li><a href="/wiki/Patrick_Dixon" title="Patrick Dixon">Patrick Dixon</a>, <i>Building a Better Business</i> (2005), p. 159.</li></ul></li></ul>\n'
  + '<ul><li>When the going gets tough, the tough get going.\n<ul><li>First attestation: John Thomas (football coach); quoted September 15, 1953</li></ul></li></ul></div>';

test('a theme ask names its Wikiquote page; other asks name none', () => {
  assert.equal(themeOf('give me a motivational quote', () => 0), 'Perseverance');
  assert.equal(themeOf('inspirational quote', () => 0.9), 'Courage');
  assert.equal(themeOf('quote about the sea'), 'Sea');
  assert.equal(themeOf('quotes about courage please'), 'Courage');
  for (const a of ['tell me a quote', 'random quote', 'another quote', 'famous quotes']) assert.equal(themeOf(a), null, a);
});

test('a section of quotes is picked, never Misattributed, Disputed or See also', () => {
  const secs = [{ level: '2', line: 'A', index: '1', anchor: 'A' }, { level: '3', line: 'Sub', index: '2' }, { level: '2', line: 'Misattributed', index: '3' },
    { level: '2', line: 'Disputed', index: '4' }, { level: '2', line: 'See also', index: '5' }, { level: '2', line: '<i>Hoyt\'s New Cyclopedia</i>', index: '6', anchor: 'Hoyt' }];
  for (const r of [0, 0.5, 0.99]) assert.ok(['1', '6'].includes(pickSection(secs, () => r).index));
  assert.equal(pickSection([{ level: '2', line: 'Misattributed', index: '1' }]), null);
  assert.equal(pickSection(undefined), null);
});

test('a theme page gives each quote with the author named under it, and drops an author line that is not a name', () => {
  assert.deepEqual(themeQuotes(persevere), [
    { quote: 'Run every day. If you can\'t run, walk fast. If you can\'t walk fast, walk as fast as you can.', author: 'Michael Fitzgerald' },
    { quote: 'Motivation is a battle for the heart, not just an appeal to the mind.', author: 'Patrick Dixon' },
  ]);
  assert.deepEqual(themeQuotes(''), []);
});

test('a motivational ask shows a quote from the theme page, linked to that section', async () => {
  const { r, html, asked } = await ask('give me a motivational quote', [{ parse: { title: 'Perseverance', sections: [{ level: '2', line: 'F', index: '5', anchor: 'F' }] } }, { parse: { text: persevere } }]);
  assert.equal(r, 'quote'); assert.equal(asked.length, 2);
  assert.ok(asked[0].includes('prop=sections') && asked[0].includes('redirects=1') && asked[1].includes('section=5'), asked.join(' '));
  assert.ok(/Michael Fitzgerald|Patrick Dixon/.test(html), html);
  assert.match(html, /Source: <a href="https:\/\/en\.wikiquote\.org\/wiki\/Perseverance#F"[^>]*>Wikiquote, Perseverance<\/a>/);
});

test('no theme page: the quote of the day, and an "about" ask says so', async () => {
  const o = await ask('quote about zzyzx', [{ error: { code: 'missingtitle' } }, { parse: { text: adams } }]);
  assert.equal(o.r, 'quote'); assert.match(o.html, /Wikiquote has no quotes page on “Zzyzx”, so this is its quote of the day/); assert.ok(o.html.includes('John Adams'));
  const m = await ask('inspirational quote', [new Error('offline'), { parse: { text: jorn } }]);
  assert.equal(m.r, 'quote'); assert.ok(m.html.includes('Asger Jorn') && !m.html.includes('no quotes page'), m.html);
});
