// lib/seo.js and tools/seo-pages.mjs: the table covers every tool page and only tool pages, the JSON-LD parses and names the page's own url, each
// page file carries the one canonical and JSON-LD the table gives it, and every link in the table reaches its own page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGES, pageOf, jsonLd, headTags, asksRow, llmsLines, SITE } from '../void-live-deploy/lib/seo.js';
import { TOOLS } from '../void-live-deploy/lib/toolkit.js';
import { build, withBlock, seoOf, llmsOf, SKIP, HEAD } from './seo-pages.mjs';

test('the table has one row per tool page (lib/toolkit.js TOOLS), each with 5 to 8 search phrases and a true description', () => {
  assert.deepEqual(PAGES.map((p) => p.path).sort(), Object.keys(TOOLS).sort());
  assert.equal(new Set(PAGES.map((p) => p.path)).size, PAGES.length);
  for (const p of PAGES) {
    assert.ok(p.name && p.does.length > 40, p.path);
    assert.ok(p.asks.length >= 5 && p.asks.length <= 8, p.path + ' phrases: ' + p.asks.length);
    assert.equal(new Set(p.asks).size, p.asks.length, p.path + ' no phrase twice');
    assert.doesNotMatch(p.does + p.asks.join(' '), /best|#1|better than|\.com\b|\.org\b|\.net\b/i, p.path + ' says nothing about other sites');
  }
  assert.equal(pageOf('/nope/'), null);
});

test('the JSON-LD parses, names the page url, is a free WebApplication for any OS with a BreadcrumbList', () => {
  for (const p of PAGES) {
    const ld = JSON.parse(JSON.stringify(jsonLd(p.path))), [app, crumbs] = ld['@graph'];
    assert.equal(ld['@context'], 'https://schema.org');
    assert.equal(app['@type'], 'WebApplication'); assert.equal(app.url, SITE + p.path); assert.equal(app.name, p.name); assert.equal(app.description, p.does);
    assert.equal(app.applicationCategory, 'UtilitiesApplication'); assert.equal(app.operatingSystem, 'Any'); assert.equal(app.isAccessibleForFree, true);
    assert.equal(app.offers.price, '0'); assert.equal(app.offers['@type'], 'Offer');
    assert.equal(crumbs['@type'], 'BreadcrumbList'); assert.equal(crumbs.itemListElement.length, 2); assert.equal(crumbs.itemListElement[1].item, SITE + p.path); assert.equal(crumbs.itemListElement[0].item, SITE + '/');
    if (p.action) {
      const a = app.potentialAction;
      assert.ok(a.target.urlTemplate.startsWith(SITE + p.path + '?') && /\{[a-z_]+\}/.test(a.target.urlTemplate), p.path + ' urlTemplate reaches the page with a placeholder');
      assert.ok(a.target.urlTemplate.includes('{' + p.action.input + '}'), p.path);
      assert.equal(a['@type'], p.action.search ? 'SearchAction' : 'ViewAction');
      assert.equal(a[(p.action.search ? 'query' : p.action.input) + '-input'], 'required name=' + p.action.input);
    } else assert.equal(app.potentialAction, undefined);
  }
  assert.equal(jsonLd('/nope/'), null);
  assert.equal(jsonLd('/base64/', 'http://localhost:8788')['@graph'][0].url, 'http://localhost:8788/base64/');
});

test('the head tags: one canonical, one JSON-LD script, and no </ inside the JSON', () => {
  const h = headTags('/convert/');
  assert.equal((h.match(/<link rel="canonical"/g) || []).length, 1); assert.ok(h.includes('href="' + SITE + '/convert/"'));
  assert.equal((h.match(/<script type="application\/ld\+json">/g) || []).length, 1);
  const json = /<script type="application\/ld\+json">([\s\S]*)<\/script>$/.exec(h)[1];
  assert.doesNotMatch(json, /<\/(?!\\)/, 'nothing closes the script early'); assert.ok(JSON.parse(json.replace(/<\\\//g, '</')));
  assert.equal(headTags('/nope/'), '');
});

test('the common asks: 5 to 8 real links per page that takes a setting in the link, each to its own page, no link twice', () => {
  for (const p of PAGES.filter((x) => x.links)) {
    assert.ok(p.links.length >= 5 && p.links.length <= 8, p.path + ' links: ' + p.links.length);
    assert.equal(new Set(p.links.map((l) => l[1])).size, p.links.length, p.path);
    for (const [label, href] of p.links) { assert.ok(href.startsWith(p.path + '?'), href + ' reaches ' + p.path); assert.ok(label.length >= 2, href); assert.ok(p.action, p.path + ' takes a setting'); }
    const row = asksRow(p.path);
    assert.ok(row.startsWith('<nav id="asks" class="tk-row" aria-label="Common asks">') && (row.match(/<a href=/g) || []).length === p.links.length, p.path);
  }
  assert.equal(asksRow('/wheel/'), ''); assert.equal(asksRow('/nope/'), '');
  assert.ok(asksRow('/base64/').includes('href="/base64/?t=Hello%2C+world"'));
});

test('withBlock inserts before the anchor once and rewrites between the markers after; null without an anchor', () => {
  const once = withBlock('<head>\n<title>x</title>\n</head>', HEAD, 'A', '</head>');
  assert.equal(once, '<head>\n<title>x</title>\n<!-- seo -->\nA\n<!-- /seo -->\n</head>');
  assert.equal(withBlock(once, HEAD, 'B', '</head>'), '<head>\n<title>x</title>\n<!-- seo -->\nB\n<!-- /seo -->\n</head>');
  assert.equal(withBlock('<html>', HEAD, 'A', '</head>'), null);
  assert.ok(seoOf('<head></head>', '/base64/').includes('<link rel="canonical" href="' + SITE + '/base64/">'));
  const own = '<head><link rel="canonical" href="https://a-to-mind.com/base64/"></head>', kept = seoOf(own, '/base64/');
  assert.equal((kept.match(/rel="canonical"/g) || []).length, 1, 'a page with its own canonical keeps the one'); assert.ok(kept.includes('ld+json'));
  assert.equal((seoOf(kept, '/base64/').match(/rel="canonical"/g) || []).length, 1, 'and stays at one when rewritten');
  assert.equal(headTags('/base64/', SITE, { canonical: false }).startsWith('<script'), true);
});

test('every tool page file carries exactly the block the table gives it (node tools/seo-pages.mjs when not), one canonical and one JSON-LD', () => {
  // build() also reaches the pages it writes only links into (each tool's "Use with" row, /tools/, the paid pages): up to date like the rest
  const all = build(), llms = all.find((x) => x.path === '/llms.txt'), pages = all.filter((x) => x !== llms && PAGES.some((p) => p.path === x.path));
  for (const { path, html, want } of all) assert.equal(html, want, path + ' is out of date');
  assert.equal(pages.length, PAGES.length - Object.keys(SKIP).length);
  assert.ok(llms && llms.want === llms.html, 'llms.txt is reached and up to date');
  for (const { path, html, want } of pages) {
    assert.equal(html, want, path + ' is out of date');
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, path); assert.equal((html.match(/application\/ld\+json/g) || []).length, 1, path);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1].replace(/<\\\//g, '</'));
    assert.equal(ld['@graph'][0].url, SITE + path);
    const rows = (html.match(/<nav id="asks"/g) || []).length;
    assert.equal(rows, pageOf(path).links ? 1 : 0, path + ' common asks row'); // the row sits above "Use with", so people see the asks before the hand-offs
    if (rows) assert.ok(html.indexOf('<nav id="asks"') < html.indexOf('<nav id="related"'), path);
  }
  for (const [p, why] of Object.entries(SKIP)) { assert.ok(pageOf(p), p + ' still has a row'); assert.ok(why.length > 10); }
});

test('every tool page and both tower pages carry a link preview: og:title, og:description, og:image and twitter:card', () => {
  for (const p of [...PAGES.map((x) => x.path), '/conquered/', '/compare/']) {
    const html = readFileSync(new URL('../void-live-deploy' + p + 'index.html', import.meta.url), 'utf8');
    for (const tag of ['property="og:title"', 'property="og:description"', 'property="og:image"', 'name="twitter:card"']) assert.ok(html.includes(tag), p + ' has ' + tag);
    assert.match(html, /property="og:image" content="https:\/\/a-to-mind\.com\/[^"]+\.(?:png|jpg|svg)"/, p + ' og:image is an absolute image url');
  }
});

test('llms.txt lines: one per page, honest, each ending in its url; and llms.txt carries them once each under "Tool pages"', () => {
  const lines = llmsLines();
  assert.equal(lines.length, PAGES.length);
  for (const [i, l] of lines.entries()) assert.ok(l.startsWith('- ' + PAGES[i].name + ': ') && l.endsWith(' ' + SITE + PAGES[i].path), l);
  const text = readFileSync(new URL('../void-live-deploy/llms.txt', import.meta.url), 'utf8');
  assert.ok(text.includes('## Tool pages'), 'the section is there');
  assert.equal(llmsOf(text), text, 'llms.txt is up to date (node tools/seo-pages.mjs)');
  for (const p of PAGES) assert.equal((text.match(new RegExp(SITE.replace(/\./g, '\\.') + p.path.replace(/\//g, '\\/') + '(?=[\\s.,)]|$)', 'g')) || []).length, p.path === '/tools/' ? 2 : 1, p.path + ' once in llms.txt (the kit page twice: the intro and its own line); a link with a setting (?q=) is not the page');
  assert.equal(llmsOf('no markers here'), null);
});

test('the sitemap and the table agree on which tool pages exist', () => {
  const sitemap = readFileSync(new URL('../void-live-deploy/sitemap.xml', import.meta.url), 'utf8');
  for (const p of PAGES) assert.ok(sitemap.includes('<loc>' + SITE + p.path + '</loc>'), p.path + ' in the sitemap');
});
