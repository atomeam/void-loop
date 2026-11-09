// tools/journal.test.mjs - lib/journal.js: the feed and Crossref both normalize to one paper shape, the
// abstract's JATS tags come out, the saved list keeps one row per DOI on the device, and the length of a
// paper in the journal's publication units is worked out with its working
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromRssItem, fromCrossref, jatsText, searchCrossref, latestByIssn, latest, toggleSave, savedList, isSaved, parseFeed, pubUnits, puWithoutEquationExtra, ISSN } from '../void-live-deploy/lib/journal.js';

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item><media:content type="image/jpeg" url="https://img.example/a.jpg"/><title>  A study of sand  </title><pubDate>Thu, 05 Nov 2026 17:27:25 +0000</pubDate><description>  New mapping of a sand sea. </description><guid>https://doi.org/10.2475/001c.172254</guid><link>https://ajsonline.org/article/172254</link></item>
<item><title>No guid paper</title><pubDate>Mon, 02 Nov 2026 18:37:13 +0000</pubDate><description>d</description><link>https://ajsonline.org/article/1</link></item>
</channel></rss>`;

test('an RSS item becomes one paper shape: title trimmed, DOI read out of the guid, date as ISO', () => {
  const blocks = RSS.match(/<item>[\s\S]*?<\/item>/g);
  const p = fromRssItem(blocks[0]);
  assert.equal(p.title, 'A study of sand');
  assert.equal(p.doi, '10.2475/001c.172254');
  assert.equal(p.date, '2026-11-05');
  assert.equal(p.url, 'https://ajsonline.org/article/172254');
  assert.equal(p.abstract, 'New mapping of a sand sea.');
  assert.equal(p.image, 'https://img.example/a.jpg');
  const q = fromRssItem(blocks[1]);
  assert.equal(q.doi, '', 'no guid: the DOI stays empty, never invented');
  assert.ok(q.url.includes('/article/1'));
  assert.equal(parseFeed(RSS).length, 2, 'the whole feed parses, and a title-less item would be dropped');
});

test('a Crossref work becomes the same shape, authors joined, abstract kept raw for jatsText', () => {
  const w = { title: ['Clays and water'], DOI: '10.1/x', volume: '326', author: [{ given: 'A.', family: 'Smolen' }, { given: 'B.', family: 'Lee' }], published: { 'date-parts': [[2026, 9, 8]] }, abstract: '<jats:p>Hello <jats:italic>world</jats:italic></jats:p>', link: [{ URL: 'https://ajsonline.org/article/164723' }] };
  const p = fromCrossref(w);
  assert.equal(p.title, 'Clays and water');
  assert.equal(p.doi, '10.1/x');
  assert.equal(p.authors, 'A. Smolen, B. Lee');
  assert.equal(p.date, '2026-09-08', 'the day is zero-padded, so every route shows one date shape');
  assert.equal(p.volume, '326');
  assert.equal(p.url, 'https://ajsonline.org/article/164723');
  const noLink = fromCrossref({ title: ['T'], DOI: '10.1/y', URL: 'https://doi.org/10.1/y' });
  assert.equal(noLink.url, 'https://doi.org/10.1/y', 'with no link, the registry URL stands, never invented');
  assert.equal(fromCrossref({ title: ['T'], DOI: '10.1/z' }).date, '', 'no date: it stays empty');
});

test('latestByIssn reads the journal\'s own records by ISSN, newest first, each with its volume and authors', async () => {
  const calls = [];
  const fakeFetch = async (u) => { calls.push(u); return { ok: true, json: async () => ({ message: { items: [
    { title: ['Sand sea'], DOI: '10.2475/a', volume: '326', author: [{ given: 'S.', family: 'Stewart' }], published: { 'date-parts': [[2026, 11, 5]] }, abstract: '<jats:p>New mapping.</jats:p>' },
    { title: [''], DOI: '10.2475/b' },
  ] } }) }; };
  const r = await latestByIssn({ fetchImpl: fakeFetch });
  assert.equal(r.length, 1, 'a row with no title is dropped');
  assert.equal(r[0].volume, '326');
  assert.equal(r[0].authors, 'S. Stewart');
  assert.equal(r[0].date, '2026-11-05');
  assert.match(calls[0], /api\.crossref\.org\/works\?filter=issn:0002-9599/, 'the journal is found by its own ISSN');
  assert.match(calls[0], /sort=published&order=desc/, 'newest first');
  assert.ok(!/api[_-]?key/i.test(calls[0]), 'no key in the URL');
  assert.equal(ISSN, '0002-9599');
});

test('latest reads the registry first, and falls back to the journal\'s own feed when it does not answer', async () => {
  const byIssn = async (u) => ({ ok: true, json: async () => ({ message: { items: [{ title: ['From the registry'], DOI: '10.2475/a', volume: '326' }] } }) });
  const r = await latest({ fetchImpl: byIssn });
  assert.equal(r.length, 1); assert.equal(r[0].title, 'From the registry'); assert.equal(r[0].volume, '326');
  const feedOnly = async (u) => { if (/crossref/.test(u)) throw new Error('registry down'); return { ok: true, text: async () => RSS }; };
  const f = await latest({ fetchImpl: feedOnly });
  assert.equal(f.length, 2, 'the feed answers when the registry does not');
  assert.equal(f[0].doi, '10.2475/001c.172254');
});

test('jatsText strips the tags and the extra spaces', () => {
  assert.equal(jatsText('<jats:p>  Hello   <jats:italic>world</jats:italic> </jats:p>'), 'Hello world');
  assert.equal(jatsText(''), '');
});

test('searchCrossref reads the public API with no key and drops rows with no title or DOI', async () => {
  const calls = [];
  const fakeFetch = async (u) => { calls.push(u); return { ok: true, json: async () => ({ message: { items: [
    { title: ['Real'], DOI: '10.1/a' }, { title: [''], DOI: '10.1/b' }, { title: ['No DOI'] },
  ] } }) }; };
  const r = await searchCrossref('sand sea', { fetchImpl: fakeFetch });
  assert.equal(r.length, 1);
  assert.equal(r[0].doi, '10.1/a');
  assert.match(calls[0], /api\.crossref\.org\/works\?query\.bibliographic=sand%20sea/);
  assert.ok(!/api[_-]?key/i.test(calls[0]), 'no key in the URL');
});

test('the saved list keeps one row per DOI, newest first, capped', () => {
  const key = 'test.journal.saved';
  globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
  toggleSave(key, { doi: '10.1/a', title: 'A', url: 'u', date: '2026-11-05' });
  toggleSave(key, { doi: '10.1/b', title: 'B', url: 'u', date: '2026-11-04' });
  assert.equal(savedList(key).length, 2);
  assert.equal(savedList(key)[0].doi, '10.1/b', 'newest first');
  assert.ok(isSaved(key, '10.1/a'));
  toggleSave(key, { doi: '10.1/a', title: 'A', url: 'u', date: '2026-11-05' }); // again: taken back off
  assert.ok(!isSaved(key, '10.1/a'));
  assert.equal(savedList(key).length, 1);
  delete globalThis.localStorage;
});

test('the length of a paper in publication units, with the journal\'s own examples', () => {
  // 15,000 words and 10 figures or tables: 30 PU of words and 15 PU of figures, 45 PU, the free limit
  const one = pubUnits({ words: 15000, figures: 10 });
  assert.equal(one.textPU, 30); assert.equal(one.figPU, 15); assert.equal(one.pu, 45); assert.equal(one.over, 0); assert.equal(one.fee, 0);
  // 20,000 words and 12 figures or tables: 58 PU, 13 PU over the limit, $1,300
  const two = pubUnits({ words: 20000, figures: 12 });
  assert.equal(two.pu, 58); assert.equal(two.over, 13); assert.equal(two.fee, 1300);
  // 8,000 words, 4 figures and 32 equations: 23 PU as the guidelines print it, 3 excess equation PU, $300
  const three = pubUnits({ words: 8000, figures: 4, equations: 32 });
  assert.equal(puWithoutEquationExtra(three), 23, 'the total the guidelines\' example prints');
  assert.equal(three.eqPU, 1, 'the first ten equations count as one unit');
  assert.equal(three.eqExtraPU, 3, 'one more for every ten equations past the first ten');
  assert.equal(three.over, 0); assert.equal(three.eqFee, 300); assert.equal(three.fee, 300);
  // a short-form paper may be 4 PU at most
  const short = pubUnits({ words: 2500, limit: 4 });
  assert.equal(short.pu, 5); assert.equal(short.over, 1); assert.equal(short.fee, 100);
  // a table counts like a figure, the total is rounded up, and a number below zero is no number
  assert.equal(pubUnits({ words: 100, tables: 2 }).pu, 4);
  assert.equal(pubUnits({ words: 1 }).pu, 1);
  assert.equal(pubUnits({}).pu, 0);
  assert.equal(pubUnits({ words: -5, figures: -2 }).pu, 0);
});
