// Verse's SEO audit (lib/seo-audit.js) and the links tools/seo-pages.mjs writes from it. Run: node --test tools/seo-audit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditPage, auditSite, internalPath, served, OFFERS } from '../void-live-deploy/lib/seo-audit.js';
import { relatedLinks, withRelated, moreTools, offersRow, OFFER_PAGES } from './seo-pages.mjs';
import { run } from './seo-audit.mjs';

const page = (o = {}) => `<!doctype html><html${o.lang === false ? '' : ' lang="en"'}><head><title>${o.title ?? 'Word counter: words and characters · Verse'}</title>
<meta name="description" content="${o.desc ?? 'Count words, characters and sentences as you type. Kept on this device and it works offline.'}">
${o.canonical === false ? '' : `<link rel="canonical" href="https://a-to-mind.com${o.canon ?? o.path ?? '/a/'}">`}
<meta property="og:title" content="A"><meta property="og:image" content="https://a-to-mind.com/og.png">
${o.ld ?? '<script type="application/ld+json">{"a":1}</script>'}</head><body>${o.h1 ?? '<h1>A</h1>'}${o.body ?? ''}
<script>const x = '<a href="/nowhere/">';</script></body></html>`;
const files = new Set(['/a/index.html', '/b/index.html', '/og.png', '/icon.svg']);

test('a sound page has no defects; its links are read from the markup, not from scripts', () => {
  const r = auditPage(page({ body: '<a href="/b/">b</a> <a href="https://a-to-mind.com/a/">self</a> <a href="https://example.com/">out</a> <a href="#x">here</a> <img src="/icon.svg">' }), '/a/', files);
  assert.deepEqual(r.defects, []);
  assert.deepEqual(r.links, ['/b/', '/a/']);
  assert.ok(r.grade != null && r.grade < 12, 'the description is graded by the readability tool');
});

test('each fault is found: no canonical, a canonical elsewhere, bad JSON-LD, two h1, no lang, a broken link and picture', () => {
  const kinds = (o, body) => auditPage(page({ ...o, body }), '/a/', files).defects.map((d) => d.kind);
  assert.deepEqual(kinds({ canonical: false }), ['canonical']);
  assert.deepEqual(kinds({ canon: '/b/' }), ['canonical']);
  assert.deepEqual(kinds({ ld: '<script type="application/ld+json">{oops</script>' }), ['json-ld']);
  assert.deepEqual(kinds({ h1: '<h1>A</h1><h1>B</h1>' }), ['h1']);
  assert.deepEqual(kinds({ lang: false }), ['lang']);
  assert.deepEqual(kinds({}, '<a href="/gone/">x</a><img src="/gone.png">'), ['broken', 'broken']);
  assert.deepEqual(kinds({ title: '' }), ['title']);
  const long = auditPage(page({ desc: 'word '.repeat(60) }), '/a/', files);
  assert.deepEqual(long.defects, []); assert.equal(long.notes[0].kind, 'description', 'a long description is a note, not a fault');
});

test('internal paths: this site only, relative links resolved, the dynamic routes served without a file', () => {
  assert.equal(internalPath('../b/?q=1#x', '/a/c/'), '/a/b/');
  assert.equal(internalPath('https://example.com/a/'), null);
  assert.equal(internalPath('mailto:x@y.z'), null);
  assert.ok(served('/api/answer', files) && served('/is-it/christmas', files) && served('/b/', files) && !served('/c/', new Set()) === false);
  assert.ok(!served('/nope/', files));
});

test('over the site: duplicates, inbound counts, orphans and the pages that lead to an offer', () => {
  const a = auditPage(page({ path: '/a/', body: '<a href="/b/">b</a><a href="/store/">store</a>' }), '/a/', files);
  const b = auditPage(page({ path: '/b/' }), '/b/', files);
  const s = auditSite([a, b, auditPage(page({ path: '/store/', title: 'Store · Verse', desc: 'Things Verse sells, each with what it does and its price, on its own page.' }), '/store/', files)]);
  assert.equal(s.byKind.duplicate, 4, 'a and b share a title and a description');
  assert.deepEqual(s.orphans, ['/a/']);
  assert.equal(s.toOffers, 1); assert.deepEqual(s.offers['/store/'], ['/a/']);
  assert.ok(OFFERS.includes('/code-review/'));
});

test('the related row in the HTML is the same links the script draws, and the services lead to each other', () => {
  assert.match(relatedLinks('/word-count/'), /href="\/stopwatch\/"[^>]*>Stopwatch and timer<\/a> <a href="\/fanfic\/">Fan fiction<\/a> <a href="\/tools\/">All tools<\/a>$/);
  const html = '<main><nav id="related" aria-label="Related tools"></nav></main>';
  const once = withRelated(html, '/word-count/'); assert.match(once, /<nav id="related" aria-label="Related tools"><!-- related -->.*<!-- \/related --><\/nav>/);
  assert.equal(withRelated(once, '/word-count/'), once, 'written again, it is the same');
  assert.equal(withRelated('<main></main>', '/word-count/'), null);
  const more = moreTools('<a href="/color/">c</a>'); assert.ok(!more.includes('"/color/"') && more.includes('"/code-review/"') && more.includes('"/photos/"'));
  const single = moreTools(''); assert.equal((single.match(/>Unit converter: every unit at once, exact</g) || []).length, 1, 'a tool built twice for two sites is listed once');
  // every row has the same "Open here" button as the hand-written rows (2026-10-30: 70 tools could only be left, not opened beside the others),
  // and the searches people make for it, for the page's find box
  assert.equal((more.match(/<li/g) || []).length, (more.match(/<button type="button" data-open="\//g) || []).length, 'each More tools row can be opened on the bench');
  assert.ok(/<li data-find="[^"]*compress image online[^"]*"><a href="\/photos\/">Photo tools<\/a><button type="button" data-open="\/photos\/">Open here<\/button><\/li>/.test(more));
  for (const p of OFFER_PAGES) { const row = offersRow(p); assert.ok(!row.includes('href="' + p + '"'), p); assert.match(row, /href="\/fix\/"/); }
});

test('the site as committed: no more defects or orphans than the baseline, and no fewer pages leading to an offer', async () => {
  const { readFileSync } = await import('node:fs');
  const base = JSON.parse(readFileSync(new URL('./seo-audit.baseline.json', import.meta.url), 'utf8')), r = run();
  const held = (x) => x.defects - ((x.byKind && x.byKind.duplicate) || 0); // duplicates are told, not held (tools/seo-audit.mjs)
  assert.ok(held(r) <= held(base), r.pages.flatMap((p) => p.defects.map((d) => p.path + ' ' + d.message)).join('\n'));
  assert.ok(r.orphans.length <= base.orphans, r.orphans.join(' '));
  assert.ok(r.toOffers >= base.toOffers);
});
