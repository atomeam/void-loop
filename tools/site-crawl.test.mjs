import test from 'node:test';
import assert from 'node:assert/strict';
import { readHtml, featuresOf, templateFeatures, templateOf, sitemapGroup, sitemapUrls, pageWorth, wording, markAgainst, siteFeatures, publishOf, mergeCrawl, crawlSite } from './site-crawl.mjs';

const EMOJI_PAGE = (c, name) => `<html lang="en"><head><title>${c} ${name} emoji</title><link rel="alternate" hreflang="de" href="/de/x/"><link rel="alternate" hreflang="fr" href="/fr/x/"><link rel="alternate" hreflang="es" href="/es/x/"></head><body>
<header><nav><a href="/">Home</a><button>Menu</button></nav></header>
<h1>${c} ${name}</h1><h2>Copy and paste this ${c} emoji:</h2><button class="copy" data-clipboard-text="${c}">Copy to clipboard</button>
<h2>Also Called</h2><h2>Apple Name</h2><h2>How emoji looks on Apple Iphone, Android and other platforms</h2>
<h3>Apple</h3><h3>Google</h3><h3>Samsung</h3><h3>Microsoft</h3><h3>Whatsapp</h3>
<h2>Tags and Keywords:</h2><table><tr><td>U+1F600</td></tr></table>
<footer><a href="/privacy/">Privacy</a></footer></body></html>`;

test('a page read from its HTML: headings in order, buttons, languages; the header, navigation and footer left out', () => {
  const p = readHtml(EMOJI_PAGE('😀', 'Grinning Face'), 'https://emoji.test/grinning-face/');
  assert.equal(p.h1, '😀 Grinning Face'); assert.ok(p.headings.some((h) => h.t === 'Also Called'));
  assert.ok(!p.buttons.includes('Menu')); assert.ok(p.buttons.includes('Copy to clipboard')); assert.equal(p.alternates.length, 3); assert.equal(p.tables, 1);
});
test('features of a template: the subject taken out, a run of short headings folded into one grid, kept when half the pages show it', () => {
  const pages = [readHtml(EMOJI_PAGE('😀', 'Grinning Face'), 'https://emoji.test/grinning-face/'), readHtml(EMOJI_PAGE('🔥', 'Fire'), 'https://emoji.test/fire/')];
  const f = templateFeatures(pages), names = f.map((x) => x.name);
  assert.ok(names.includes('Copy and paste this emoji'), names.join(' | ')); assert.ok(names.includes('Apple Name'));
  assert.ok(names.some((n) => /^How emoji looks on Apple Iphone, Android and other platforms \(5: Apple, Google/.test(n)), 'the vendor headings are one grid');
  assert.ok(!names.some((n) => n === 'Apple' || n === 'Google')); assert.ok(names.includes('In 3 languages')); assert.ok(names.includes('A table'));
  assert.equal(wording('Grinning Face 😀 emoji codes for devs:', '😀 Grinning Face'), 'emoji codes for devs');
});
test('templates: sitemap pages by sitemap and depth, languages folded, top pages their own, legal pages never read', () => {
  const sm = new Map([['https://e.test/fire/', 'emoji']]);
  assert.equal(templateOf('https://e.test/fire/', sm), 'sitemap:emoji:/*'); assert.equal(templateOf('https://e.test/', sm), 'home'); assert.equal(templateOf('https://e.test/de/', sm), 'home');
  assert.equal(templateOf('https://e.test/copy-keyboard/', sm), 'page:/copy-keyboard'); assert.equal(templateOf('https://e.test/search/?q=cat', sm), 'search');
  assert.equal(templateOf('https://e.test/theme/love/', sm), 'path:/theme/*');
  assert.equal(sitemapGroup('https://e.test/emoji_de.xml.gz'), 'emoji'); assert.equal(sitemapGroup('https://e.test/emoji_en.xml.gz'), 'emoji'); assert.equal(sitemapGroup('https://e.test/sitemap-posts-2.xml'), 'sitemap-posts');
  assert.equal(pageWorth('https://e.test/privacy-policy/', 'e.test'), false); assert.equal(pageWorth('https://e.test/a.png', 'e.test'), false); assert.equal(pageWorth('https://other.test/x', 'e.test'), false); assert.equal(pageWorth('https://www.e.test/x/', 'e.test'), true);
  assert.deepEqual(sitemapUrls('<sitemapindex><sitemap><loc>https://e.test/a.xml</loc></sitemap></sitemapindex>'), { maps: ['https://e.test/a.xml'], urls: [] });
});
test('a feature is marked against Verse\'s pages, navigation never blocks, and the summary lists only the missing', () => {
  const m = markAgainst([{ key: 'section apple name', name: 'Apple Name', kind: 'section', templates: ['x'] }, { key: 'nav pages', name: 'Pages of results', kind: 'navigation', templates: ['x'] }], 'Emoji keyboard and copy');
  assert.equal(m[0].verse, 'missing'); assert.equal(m[1].verse, 'has');
  const file = mergeCrawl(null, { id: 'emoji combos', page: '/emoji-combos/' }, 'e.test', { pages: 12, templates: [{ key: 'home' }], features: m, verse_pages: 3 }, '2026-11-03');
  assert.equal(file.source, 'auto'); const s = publishOf({ 'emoji-combos': file }).sites['e.test'];
  assert.deepEqual(s.missing, ['Apple Name']); assert.equal(s.pages, 12); assert.equal(s.features, 2); assert.equal(s.verse_features, 1); assert.equal(s.crawled, '2026-11-03');
  assert.deepEqual(siteFeatures([{ key: 'page:/k', kind: 'tool', title: 'Emoji Keyboard', features: [] }]).map((x) => x.name), ['A page: Emoji Keyboard']);
});
test('the crawl respects robots.txt, reads the sitemaps and samples each template, within the page cap', async () => {
  const pages = { '/robots.txt': 'User-agent: *\nDisallow: /secret/\nSitemap: https://e.test/sitemap.xml', '/sitemap.xml': '<urlset>' + ['a', 'b', 'c', 'd', 'e'].map((x) => '<url><loc>https://e.test/' + x + '/</loc></url>').join('') + '</urlset>',
    '/': '<body><h1>Emoji</h1><a href="/secret/x/">s</a><a href="/keyboard/">k</a><a href="/a/">a</a></body>', '/keyboard/': '<body><h1>Keyboard</h1><textarea placeholder="Type"></textarea></body>' };
  for (const x of 'abcde') pages['/' + x + '/'] = EMOJI_PAGE(x, 'Thing ' + x);
  const asked = [];
  const fetcher = async (u) => { const p = new URL(u).pathname; asked.push(p); return p in pages ? { ok: true, status: 200, url: u, type: p.endsWith('.xml') || p.endsWith('.txt') ? 'text/xml' : 'text/html', text: pages[p] } : { ok: false, status: 404, url: u }; };
  const r = await crawlSite('https://e.test/', { cap: 50, pause: 0, fetcher });
  assert.ok(!asked.includes('/secret/x/'), 'robots.txt is respected'); assert.equal(r.urls_found, 5); assert.ok(r.read <= 50);
  const item = r.templates.find((t) => t.key === 'sitemap:sitemap:/*'); assert.ok(item && item.sampled.length === 3, JSON.stringify(r.templates.map((t) => [t.key, t.sampled.length])));
  assert.ok(r.features.some((f) => f.name === 'A page: Keyboard')); assert.ok(r.features.some((f) => f.name === 'Apple Name'));
});
