// Knowledge cards (owner, 2026-11-06, the Treasury card): whole sentences in the code line, a list of senses shown as senses, a picture only of
// what the card is about, a take that stands on something real, stats that say what they count, a true Adds to Verse line, Verse's own page
// first for a term it has a page for, and each outside sense with its own source. Run: node --test tools/term-card.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../void-live-deploy/lib/term-card.js';
import { codeOf, parse, cutSentence, shareText } from '../void-live-deploy/lib/card-share.js';
import { cardOf, chromeHtml } from '../void-live-deploy/lib/card-frame.js';
import { cardSvg } from '../void-live-deploy/lib/card-image.js';
import { takeHtml, groundedTake } from '../void-live-deploy/skills/take.js';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// the Treasury lead as Wikipedia's summary gives it: the colon glued to the list, the two list items joined by a line break
const TREASURY = 'A treasury is either:a government department related to finance and taxation, a finance ministry; in a business context, corporate treasury\na place or location where treasure, such as currency or precious items are kept. These can be state or royal property, church treasure or in private ownership.';
const FILLER = 'Effective treasury management is less about the storage of assets and more about the liquidity and risk mitigation strategies used to ensure capital is available when needed. In modern banking, central treasuries serve as the ultimate liquidity backstops during systemic financial crises.';

test('1. the code line carries whole sentences, never the start of one ("\\na place or location")', () => {
  const back = parse(codeOf({ t: 'Treasury', k: 'Organisation', b: TREASURY }));
  assert.equal(back.b, TREASURY.split('\n')[0], 'cut where the first list item ends');
  assert.doesNotMatch(back.b, /a place or location$/);
  const two = 'One short sentence here. ' + 'A second sentence that runs on and on with many words so that the whole body is longer than the code line may carry, past two hundred letters in all, with a few more words ' + 'and more '.repeat(6) + 'here. And a third.';
  assert.ok(two.length > 200);
  assert.equal(cutSentence(two, 200), 'One short sentence here.');
  const long = 'A first sentence that is longer than two hundred letters, ' + 'with clause after clause, '.repeat(10) + 'and it ends here. Then more.';
  assert.equal(cutSentence(long, 200), long.slice(0, long.indexOf('here.') + 5), 'a long first sentence rides whole');
  assert.equal(cutSentence('word '.repeat(400), 200), '', 'a long run with no sentence end rides as no body, never a cut one');
  assert.equal(cutSentence('short', 200), 'short');
  assert.equal(parse(shareText({ t: 'Treasury', k: 'Organisation', b: TREASURY })).b, TREASURY, 'the copied text still gives the whole body back');
});

test('2. a lead that lists senses is split into them, and a colon glued to a word gets its space', () => {
  assert.equal(T.fixColons('either:a government'), 'either: a government');
  assert.equal(T.fixColons('at 10:30, see https://x.org and John 3:16'), 'at 10:30, see https://x.org and John 3:16');
  const p = T.leadParts(TREASURY);
  assert.equal(p.intro, 'A treasury is either:');
  assert.deepEqual(p.senses, ['a government department related to finance and taxation, a finance ministry; in a business context, corporate treasury', 'a place or location where treasure, such as currency or precious items are kept. These can be state or royal property, church treasure or in private ownership.']);
  assert.deepEqual(T.leadParts('Paris is the capital of France.').senses, []);
  const h = T.sensesHtml(esc, { ...p, source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Treasury' });
  assert.equal((h.match(/class="vt-sense"/g) || []).length, 2, 'two senses, two blocks, never one paragraph');
  assert.match(h, /Sense 1 · Wikipedia/); assert.match(h, /Sense 2 · Wikipedia/);
  assert.equal(T.sensesHtml(esc, { senses: ['only one'] }), '', 'one sense is the plain paragraph');
});

test('each outside sense keeps its own cited source', () => {
  const p = T.leadParts(TREASURY), h = T.sensesHtml(esc, { ...p, source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Treasury' });
  const blocks = h.split('<div class="vt-sense"').slice(1);
  assert.equal(blocks.length, 2);
  for (const b of blocks) assert.match(b, /class="vt-cite"[^>]*>Source: <a href="https:\/\/en\.wikipedia\.org\/wiki\/Treasury"[^>]*>Wikipedia<\/a>/);
  assert.doesNotMatch(h, /class="src"/, 'a sense cite is not a second .src box, so one source still counts as one');
});

test('3. a picture shows only when it is of what the card is about', () => {
  assert.equal(T.imageFits({ title: 'Treasury', extract: TREASURY, src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Treasury_Casino.jpg/640px-Treasury_Casino.jpg' }), false, 'a lead of two senses: the picture belongs to neither');
  assert.equal(T.imageFits({ title: 'Treasury', extract: 'A treasury is a place where treasure is kept.', src: 'https://upload.wikimedia.org/x/640px-Brisbane_Casino_at_night.jpg' }), false, 'a file about another subject');
  assert.equal(T.imageFits({ title: 'Cat', extract: 'The cat (Felis catus) is a small mammal.', src: 'https://upload.wikimedia.org/x/Cat_November_2010-1a.jpg' }), true);
  assert.equal(T.imageFits({ title: 'Cat', extract: 'The cat (Felis catus) is a small mammal.', src: 'https://upload.wikimedia.org/x/Felis_catus-cat_on_snow.jpg' }), true, 'a word of the lead counts');
  assert.equal(T.imageFits({ title: 'The Fourth Kind', extract: 'A 2009 film.', src: 'https://upload.wikimedia.org/test/fourth.svg' }), true);
  assert.equal(T.imageFits({ title: 'Some thing', extract: 'x', src: 'https://upload.wikimedia.org/x/DSC_0012.JPG' }), true, 'a file name with no words is not judged');
  assert.equal(T.imageFits({ title: 'Cat', extract: 'x', src: 'http://upload.wikimedia.org/x/Cat.jpg' }), false);
  // the article's own photo (lib/page-picture.js) is of the subject by where it comes from: the K-pop card's concert photo is kept
  // (owner, 2026-10-17; the browser check "Verse card art: an answer with no lead image looks up the article's own photo" went red without it)
  const KPOP = 'K-pop is a form of popular music originating in South Korea, from idol groups and bands.';
  assert.equal(T.imageFits({ title: 'K-pop', extract: KPOP, src: 'https://upload.wikimedia.org/t/640px-Seoul_concert.jpg' }), false, 'as a lead thumbnail, a file named for another thing is judged');
  assert.equal(T.imageFits({ title: 'K-pop', extract: KPOP, src: 'https://upload.wikimedia.org/t/640px-Seoul_concert.jpg', own: true }), true, 'the article\'s own photo is kept');
  assert.equal(T.imageFits({ title: 'Treasury', extract: TREASURY, src: 'https://upload.wikimedia.org/x/Treasury.jpg', own: true }), false, 'a lead of several senses: not even its own photo');
  assert.equal(T.imageFits({ title: 'K-pop', extract: KPOP, src: 'http://upload.wikimedia.org/t/concert.png', own: true }), false, 'https only');
});

test('4. Verse\'s take is shown only when it stands on something real, under the sense it matches', () => {
  const p = T.leadParts(TREASURY), grounds = p.senses.map((t, i) => ({ key: String(i), text: t }));
  assert.equal(T.bindTake(FILLER, grounds, 'Treasury'), null, 'the generic filler stands on no sense');
  assert.equal(T.bindTake('Church treasure such as precious items was often kept in a sacristy, and royal property in a palace.', grounds, 'Treasury'), '1', 'a take about kept treasure binds to sense 2 only');
  assert.equal(T.bindTake('Most finance ministries also run taxation and the government department budget.', grounds, 'Treasury'), '0');
  assert.equal(T.bindTake(FILLER, [...grounds, { key: 'verse', text: "Verse's treasury: its own money, the reserve, the realized revenue, every allocation and its return" }], 'Treasury'), null);
  assert.equal(T.bindTake('Verse keeps its reserve first and reinvests realized revenue by expected return.', [...grounds, { key: 'verse', text: "Verse's treasury: Verse's own money, Atom's cut paid first, the reserve, where the rest is reinvested and why, realized revenue" }], 'Treasury'), 'verse', 'Verse\'s own page is a fact a take can stand on');
  assert.equal(groundedTake(FILLER, TREASURY, 'Treasury'), '');
  assert.equal(takeHtml(esc, FILLER, [], { ground: TREASURY, title: 'Treasury' }), '', 'no grounded take and nothing to do: no block at all');
  assert.match(takeHtml(esc, 'A found-footage scare that blurs fact and fiction.', [], { ground: 'The Fourth Kind is a 2009 science fiction thriller film with archival footage.', title: 'The Fourth Kind' }), /a model’s reading/);
});

test('the picture and the take bind to one sense: a picture to a one-sense card only, a take to a single sense key', () => {
  const p = T.leadParts(TREASURY);
  const takes = p.senses.map((_, i) => T.bindTake('Church treasure and precious items, royal property, were kept there.', p.senses.map((t, k) => ({ key: String(k), text: t })), 'Treasury'));
  assert.ok(takes.every((k) => k === '1'), 'one key, the same every time');
  assert.equal(T.imageFits({ title: 'Treasury', extract: TREASURY, src: 'https://upload.wikimedia.org/x/Treasury.jpg' }), false, 'even a file named for the term binds to no single sense');
  assert.equal(T.imageFits({ title: 'Treasury', extract: TREASURY.split('\n')[1], src: 'https://upload.wikimedia.org/x/Treasury.jpg' }), true, 'one sense: its picture');
});

test('5. a fetched answer\'s stats say what they count, on the card and in its saved picture', () => {
  const c = cardOf({ sources: 1, ageDays: 120 });
  const foot = chromeHtml(c, esc).foot;
  assert.doesNotMatch(foot, />P<b>|>R<b>/, 'no bare P and R');
  assert.match(foot, /<b>1<\/b> source</); assert.match(foot, /<b>3<\/b> of 9 fresh/, '120 days ago is 3 of 9');
  assert.match(chromeHtml(cardOf({ sources: 3, ageDays: 0 }), esc).foot, /<b>3<\/b> sources</);
  const svg = cardSvg({ title: 'Treasury', typeLine: 'Organisation', text: 'x', power: 1, toughness: 2, fetched: true, hue: 200 });
  assert.match(svg, />SOURCES</); assert.match(svg, />FRESH \/9</); assert.doesNotMatch(svg, />P<\/text>/);
});

test('6. Adds to Verse says what this card added, or nothing', () => {
  const p = T.leadParts(TREASURY);
  assert.equal(T.addsFor({ title: 'Treasury', desc: 'Place or organization holding wealth', senses: p.senses }), 'The term treasury, in 2 senses from Wikipedia.');
  assert.equal(T.addsFor({ title: 'Cat', desc: 'Small domesticated carnivorous mammal' }), 'The term cat, in Wikipedia’s sense: small domesticated carnivorous mammal.');
  assert.equal(T.addsFor({ title: 'Treasury', senses: p.senses, page: { href: '/treasury/', name: "Verse's treasury" } }), "Links the term treasury to Verse’s own page, Verse's treasury (/treasury/), then 2 senses from Wikipedia.");
  assert.equal(T.addsFor({ title: '' }), '');
  assert.equal(T.addsFor({ title: 'Thing' }), '', 'nothing filed, no line');
  assert.equal(cardOf({ sources: 1, ageDays: 3 }).adds, '', 'the generic "fetched, sourced and dated" line is gone');
  assert.equal(chromeHtml(cardOf({ sources: 1, ageDays: 3 }), esc).adds.includes('Adds to Verse'), false);
  assert.match(chromeHtml(cardOf({ sources: 1, ageDays: 3, filed: 'The term cat, in Wikipedia’s sense: small mammal.' }), esc).adds, /Adds to Verse<\/b> The term cat/);
});

test('a term leads to Verse\'s own page: a match, no match, a plural', () => {
  assert.deepEqual(T.candidatePages('Treasury'), ['/treasury/']);
  assert.deepEqual(T.candidatePages('treasuries'), ['/treasury/'], 'a plural is the same term');
  assert.deepEqual(T.candidatePages('  TREASURY  '), ['/treasury/']);
  assert.ok(T.candidatePages('Calendar').includes('/calendar/'), 'a listed page by its name');
  assert.ok(T.candidatePages('Word counts').includes('/word-count/'));
  assert.deepEqual(T.candidatePages('The Fourth Kind of a very long name'), [], 'four words or more is no slug');
  const html = readFileSync(resolve(site, 'treasury/index.html'), 'utf8');
  const p = T.pageFromHtml(html, '/treasury/');
  assert.equal(p.href, '/treasury/'); assert.equal(p.name, "Verse's treasury"); assert.match(p.about, /^Verse's own money/);
  assert.deepEqual(p.state, ['/api/treasury', '/treasury/found.json'], 'the page names its own live data');
  assert.equal(T.pageFromHtml('<html><title>Not found</title></html>', '/cat/'), null, 'a 404 page is no match');
  assert.equal(T.pageFromHtml('<link rel="canonical" href="https://a-to-mind.com/"><title>Verse</title>', '/cat/'), null, 'the home page served for any path is no match');
});

test('the live line is read from the page\'s own data, and with none the link stands alone', async () => {
  const html = readFileSync(resolve(site, 'treasury/index.html'), 'utf8');
  const getText = async (p) => (p === '/treasury/' ? html : '<title>Not found</title>');
  const live = await T.termPage('Treasuries', getText, async (p) => (p === '/api/treasury' ? { as_of: '2026-11-06T06:00:00Z', balance_cents: 0 } : { as_of: '2026-11-06T06:33:40Z', counts: { places: 28, live_finds: 15, ready_to_claim: 36 } }));
  assert.equal(live.href, '/treasury/'); assert.equal(live.line, 'balance $0.00, 28 places, 15 live finds, 36 ready to claim (as of Nov 6, 2026)');
  const bare = await T.termPage('Treasury', getText, async () => null);
  assert.equal(bare.href, '/treasury/'); assert.equal(bare.line, '', 'no data read: no figure at all');
  const h = T.verseHtml(esc, bare);
  assert.match(h, /href="\/treasury\/"/); assert.doesNotMatch(h, /vt-state/, 'the link alone');
  assert.equal(T.stateLine([{ error: 'treasury unavailable' }, null]), '');
  assert.equal(await T.termPage('Cat', getText, async () => null), null, 'no Verse page: no lead block');
  assert.equal(await T.termPage('Treasury', async () => { throw new Error('offline'); }, async () => null), null, 'never throws');
});

test('Verse\'s page leads the card, then the outside senses, in the article card the page builds', () => {
  const html = readFileSync(resolve(site, 'index.html'), 'utf8'), at = html.indexOf("const KC = await import('/lib/term-card.js')");
  assert.ok(at > 0, 'the article card uses lib/term-card.js');
  const body = html.slice(at, at + 4000), vs = body.indexOf('<div class="verse-slot"></div>'), senses = body.indexOf('KC.sensesHtml(');
  assert.ok(vs > 0 && senses > vs, 'the Verse slot comes before the senses');
  assert.match(body, /KC\.imageFits\(/, 'the lead picture passes the guard');
  assert.match(body, /m\.pictureFor\([\s\S]{0,400}KC\.imageFits\(\{[^}]*own: true \}\)/, 'the article\'s own photo passes the guard as its own');
  assert.equal(readFileSync(resolve(site, 'void.html'), 'utf8'), html, 'index.html and void.html stay copies');
});
