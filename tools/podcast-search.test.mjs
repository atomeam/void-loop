// podcast-search: a podcast search on the stage (skills/podcast-search.js) shows shows from the directory the Podcasts page uses, each
// opening on that page, and the card opens the page searched for the same words. Checks: the asks it takes and leaves, the card from a
// directory answer, the fallback to Apple when the edge does not answer, a miss, and that every show and the page link are plain links.
// Run: node --test tools/podcast-search.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import S, { podcastTopicOf, pageOfPodcasts, showHref, showsHtml } from '../void-live-deploy/skills/podcast-search.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = () => { const el = { dataset: {}, innerHTML: '' }; return { el, api: { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true } }; };
async function withFetch(answer, body) { const was = globalThis.fetch, seen = []; globalThis.fetch = async (u) => { seen.push(String(u)); const j = answer(String(u)); if (j instanceof Error) throw j; return { json: async () => j }; }; try { await body(seen); } finally { globalThis.fetch = was; } }

test('the asks it takes, with their topic, and the ones it leaves to other skills', () => {
  for (const [ask, topic] of [['podcasts about history', 'history'], ['find a podcast about cooking', 'cooking'], ['search podcasts for true crime', 'true crime'], ['best podcasts about science', 'science'], ['Podcasts on Stoicism?', 'Stoicism'], ['search podcasts serial', 'serial'], ['recommend some podcasts about the roman empire', 'the roman empire'], ['any good podcasts about space', 'space']])
    assert.equal(podcastTopicOf(ask), topic, ask);
  for (const ask of [...S.nearMisses, 'search podcasts', 'top podcasts', 'podcast', 'podcasts about', 'podcasts about ?', 'what is a podcast about', 'history podcasts are boring']) assert.equal(podcastTopicOf(ask), null, ask);
  for (const ask of S.examples) assert.ok(S.match(ask.toLowerCase(), ask), ask);
});

test('the card: shows from the directory, best match first, each opening on the Podcasts page; the card opens the page searched', async () => {
  const shows = [{ id: '123', title: 'Hardcore History', author: 'Dan Carlin', genre: 'History', image: 'https://img.example/a.jpg' }, { id: '', feed: 'https://feeds.example/rest.xml', title: 'The Rest Is History', author: 'Goalhanger' }, { id: '', feed: 'http://no.example/x', title: 'No way to open it' }];
  const p = page();
  await withFetch(() => ({ ok: true, shows }), async (seen) => { assert.equal(await S.run('podcasts about history', p.api), 'podcast-search'); assert.deepEqual(seen, ['/api/podcasts?q=history']); });
  assert.equal(p.el.dataset.page, '/podcasts/?q=history');
  assert.match(p.el.innerHTML, /<h2>Podcasts about history<\/h2>.*2 shows, best match first.*href="\/podcasts\/\?show=123">Hardcore History<\/a>.*Dan Carlin · History.*href="\/podcasts\/\?feed=https%3A%2F%2Ffeeds\.example%2Frest\.xml">The Rest Is History.*Source: .*Apple Podcasts directory/s);
  assert.doesNotMatch(p.el.innerHTML, /No way to open it/, 'a show the page cannot open is left out');
  assert.equal(pageOfPodcasts('true crime'), '/podcasts/?q=true%20crime'); assert.equal(pageOfPodcasts("rock 'n' roll"), '', 'a topic that does not fit a plain query keeps the plain Podcasts link');
  assert.equal(showHref({ id: '1200361736' }), '/podcasts/?show=1200361736'); assert.equal(showHref({ id: 1200361736 }), '/podcasts/?show=1200361736');
  assert.equal(showHref({ id: 'a b' }), ''); assert.equal(showHref({ id: 'a b', feed: 'https://x.test/f.xml' }), '/podcasts/?feed=https%3A%2F%2Fx.test%2Ff.xml'); assert.equal(showHref({}), '');
  assert.doesNotMatch(showsHtml([{ id: '1', title: '<img onerror=x>', author: '"x"', image: 'javascript:alert(1)' }], esc), /<img onerror|javascript:|"x"/, 'every field is escaped and only https pictures show');
});

test('the edge does not answer: Apple straight; fyyd is named; a miss and a silent directory say so', async () => {
  let p = page();
  await withFetch((u) => (u.startsWith('/api/') ? new Error('away') : { results: [{ collectionId: 9, collectionName: 'Cooking Show', artistName: 'A Cook', primaryGenreName: 'Food' }] }), async (seen) => { await S.run('find a podcast about cooking', p.api); assert.match(seen[1], /^https:\/\/itunes\.apple\.com\/search\?media=podcast&entity=podcast&limit=25&term=cooking$/); });
  assert.match(p.el.innerHTML, /1 show, best match first.*href="\/podcasts\/\?show=9">Cooking Show/);
  p = page(); await withFetch(() => ({ ok: true, shows: [{ id: '', feed: 'https://f.example/a', title: 'A' }], source: 'fyyd' }), async () => { await S.run('podcasts about birds', p.api); });
  assert.match(p.el.innerHTML, /fyyd\.de.*Apple did not answer/s);
  p = page(); await withFetch(() => ({ ok: true, shows: [] }), async () => { await S.run('podcasts about zzqx', p.api); });
  assert.match(p.el.innerHTML, /No show in the directory matches “zzqx”/);
  p = page(); await withFetch(() => new Error('down'), async () => { await S.run('podcasts about birds', p.api); });
  assert.match(p.el.innerHTML, /did not answer just now/);
});
