// The news page's pure half (lib/news.js) and its API (functions/api/news.js) with FIXTURE feeds (tools/news-fixtures.mjs, made-up headlines): the three feed
// formats, the grouping of one story across sources, search and following, the closed lists, a failing feed, the ask bar's routes and the page's registrations
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, SECTIONS, LANGS, SOURCES, feedsFor, parseFeed, plain, stories, ageText, search, followed, shareLink, shareText, wordsOf } from '../void-live-deploy/lib/news.js';
import { askIn, lookNews, onRequestGet } from '../void-live-deploy/functions/api/news.js';
import { routeAsk, TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { rss, rdf, atom, fixtureFor } from './news-fixtures.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const fake = async (url) => { const x = fixtureFor(String(url)); return new Response(x, { status: 200 }); };

test('every feed is https, belongs to a known source, a known section and language, and each section has several', () => {
  for (const [src, sec, lang, url] of FEEDS) { assert.ok(SOURCES[src], src); assert.ok(SECTIONS[sec], sec); assert.ok(LANGS[lang], lang); assert.match(url, /^https:\/\/[a-z0-9.-]+\//); }
  for (const sec of Object.keys(SECTIONS)) assert.ok(feedsFor(sec, 'en').feeds.length >= 3, sec + ' has three or more feeds');
  for (const l of ['es', 'fr', 'de']) assert.ok(feedsFor('top', l).feeds.length >= 3, l);
  assert.equal(feedsFor('sport', 'de').sec, 'top', 'other languages only have their top stories'); assert.equal(feedsFor('nonsense', 'xx').lang, 'en');
  for (const sec of Object.keys(SECTIONS)) assert.ok(feedsFor(sec, 'en').feeds.length <= 10, sec + ' stays within the 10-feed budget');
});
test('RSS, RDF and Atom are all read; CDATA, entities and markup come out; only https links stay', () => {
  const a = parseFeed(rss([['Tom &amp; Jerry <b>win</b>', 'https://x.test/1', 'A <em>summary</em> that is long enough to keep, with &quot;quotes&quot;.', 5], ['Plain http link', 'http://x.test/2', 'ok', 5]]));
  assert.equal(a.length, 1); assert.equal(a[0].title, 'Tom & Jerry win'); assert.equal(a[0].summary, 'A summary that is long enough to keep, with "quotes".'); assert.ok(a[0].t > 0);
  const r = parseFeed(rdf([['Rdf headline', 'https://x.test/r', 'A summary that is long enough to keep on the row.', 30]])); assert.equal(r[0].link, 'https://x.test/r'); assert.ok(Math.abs(Date.now() - r[0].t - 30 * 6e4) < 5000);
  const t = parseFeed(atom([['Atom headline', 'https://x.test/t', 'A summary that is long enough to keep on the row.', 10]])); assert.equal(t[0].link, 'https://x.test/t'); assert.equal(t[0].title, 'Atom headline');
  assert.equal(parseFeed('<html>nope</html>').length, 0); assert.equal(parseFeed('').length, 0);
  assert.equal(plain('&lt;p&gt;hi&lt;/p&gt; &amp;amp;'), 'hi &'); assert.equal(parseFeed(rss([['T', 'https://x.test/s', 'T', 1]]))[0].summary, '', 'a summary that repeats the headline is dropped');
  const future = parseFeed('<rss><channel><item><title>F</title><link>https://x.test/f</link><pubDate>Mon, 01 Jan 2035 00:00:00 GMT</pubDate></item></channel></rss>', 1e12); assert.equal(future[0].t, 1e12, 'a time in the future is now');
});
test('one story told by three outlets becomes one story with "3 sources"; different stories stay apart; one outlet never groups with itself', () => {
  const now = Date.now(), it = (src, title, link, min) => ({ src, title, link, summary: '', t: now - min * 6e4 });
  const out = stories([it('bbc', 'Strong earthquake strikes off the coast of Chile', 'https://a/1', 12), it('gdn', 'Strong earthquake hits Chile coast, tsunami watch issued', 'https://b/1', 20), it('npr', 'Chile coast hit by strong earthquake; tsunami watch', 'https://c/1', 9),
    it('bbc', 'Parliament votes on the budget amendment', 'https://a/2', 50), it('gdn', 'Opinion: why the budget amendment matters', 'https://b/3', 240), it('bbc', 'Parliament votes on the budget amendment again', 'https://a/9', 55)], 60, now);
  const q = out.find((s) => /earthquake/i.test(s.title)); assert.equal(q.n, 3); assert.equal(q.also.length, 2); assert.equal(out[0].id, q.id, 'the story told by most outlets leads');
  assert.equal(out.filter((s) => /budget/i.test(s.title)).length, 3, 'two bbc budget headlines stay two (same outlet); the opinion piece stays its own');
  assert.ok(wordsOf('The Chile quake’s tsunami').includes('chile'));
});
test('age, search, following, share', () => {
  const now = 1e12; assert.equal(ageText(now - 30e3, now), 'just now'); assert.equal(ageText(now - 5 * 6e4, now), '5 min ago'); assert.equal(ageText(now - 3 * 36e5, now), '3 h ago'); assert.equal(ageText(now - 2 * 864e5, now), '2 d ago'); assert.equal(ageText(0, now), '');
  const list = [{ id: 'a', title: 'Wind farm opens', summary: 'Germany', src: 'dw', also: [] }, { id: 'b', title: 'Budget vote', summary: '', src: 'bbc', also: [{ src: 'npr', title: 'Senate budget vote' }] }];
  assert.deepEqual(search(list, 'budget vote').map((s) => s.id), ['b']); assert.deepEqual(search(list, 'germany').map((s) => s.id), ['a']); assert.equal(search(list, '  ').length, 2);
  assert.deepEqual(followed(list, ['wind'], []).map((s) => s.id), ['a']); assert.deepEqual(followed(list, [], ['npr']).map((s) => s.id), ['b']); assert.equal(followed(list, [], []).length, 0);
  assert.equal(shareLink({ sec: 'tech', lang: 'es', q: 'ai' }, 'https://x.test'), 'https://x.test/news/?sec=tech&lang=es&q=ai'); assert.equal(shareLink({ sec: 'top', lang: 'en' }, 'https://x.test'), 'https://x.test/news/');
  assert.equal(shareText({ title: 'Big news', src: 'bbc', also: [{ src: 'npr' }] }), 'Big news (BBC News, NPR)');
});
test('the API: only the closed lists are asked, a section is fetched from fixed feeds, a failing feed is named and left out, nothing is cached on failure', async () => {
  assert.deepEqual(askIn('https://x.test/api/news?sec=https://evil.test/&lang=../x'), { sec: 'top', lang: 'en' }); assert.deepEqual(askIn('https://x.test/api/news?sec=constructor'), { sec: 'top', lang: 'en' });
  assert.deepEqual(askIn('https://x.test/api/news?sec=tech&lang=fr'), { sec: 'top', lang: 'fr' }); assert.deepEqual(askIn('https://x.test/api/news?sec=world'), { sec: 'world', lang: 'en' });
  const asked = []; const out = await lookNews({ sec: 'top', lang: 'en' }, async (u, o) => { asked.push(String(u)); assert.ok(o.signal, 'every fetch has a timeout'); return fake(u); });
  assert.ok(out.ok); assert.ok(asked.every((u) => FEEDS.some((f) => f[3] === u)), 'only allowlisted addresses are asked'); assert.ok(asked.length <= 10);
  const names = out.sources.filter((s) => s.ok).map((s) => s.src); assert.ok(names.length >= 5, names.join()); assert.equal(out.sources.find((s) => s.src === 'f24').ok, false, 'a page that is not a feed is a failed source');
  assert.equal(out.sources.find((s) => s.src === 'sky').ok, false, 'a host with no answer is a failed source, the rest still show');
  const q = out.stories.find((s) => /earthquake/i.test(s.title)); assert.equal(q.n, 3); assert.ok(out.stories.length >= 10);
  const none = await lookNews({ sec: 'top', lang: 'en' }, async () => { throw new Error('down'); }); assert.equal(none.ok, false);
  const res = await onRequestGet({ request: new Request('https://x.test/api/news?sec=world'), env: {}, fetchFn: async () => { throw new Error('down'); } }); assert.equal(res.status, 502); assert.equal(res.headers.get('cache-control'), 'no-store');
  const good = await onRequestGet({ request: new Request('https://x.test/api/news?sec=world'), env: {}, fetchFn: fake }); assert.equal(good.status, 200); const j = await good.json(); assert.equal(j.sec, 'world'); assert.ok(j.stories.length);
});
test('the ask bar routes, and the page is registered everywhere a tool page is', () => {
  assert.equal(routeAsk('news page'), '/news/'); assert.equal(routeAsk('my news'), '/news/?sec=my'); assert.equal(routeAsk('saved news'), '/news/?sec=saved'); assert.notEqual(routeAsk('news'), '/news/', 'plain news stays the stage card');
  assert.equal(TOOLS['/news/'], 'News'); assert.ok(RELATED['/news/'].every((p) => TOOLS[p])); assert.ok(CARD_ASK['/news/']);
  assert.ok(PAGES.some((p) => p.path === '/news/' && p.asks.length >= 5)); assert.ok(/'\/news\/'/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')));
  const html = fs.readFileSync(path.join(root, 'news', 'index.html'), 'utf8'); assert.ok(/aria-busy="true"/.test(html) && /type="module"/.test(html) && /addEventListener\('load'/.test(html)); assert.ok(/<link rel="canonical" href="https:\/\/a-to-mind.com\/news\/">/.test(html));
});
