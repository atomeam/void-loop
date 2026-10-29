// tools/sitemap.mjs: the sitemap lists every tool page exactly once, the home page, the tower, the /fix/ pages and every /is-it/ day the function
// answers; it is valid XML; and the committed void-live-deploy/sitemap.xml lists the same pages (lastmod aside: the deploy sets that from git).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, OUT, pages, xml, locsOf, isItSlugs, lastmod } from './sitemap.mjs';
import { TOOLS } from '../void-live-deploy/lib/toolkit.js';
import { isIt } from '../void-live-deploy/skills/is-it.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixPages = JSON.parse(readFileSync(resolve(root, 'tools/fix-pages.json'), 'utf8'));
const lab = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/lab/catalog.json'), 'utf8')).filter((e) => e.status !== 'broken').map((e) => e.slug).sort();
const entries = pages({ fixPages, lab }).map((p) => ({ ...p, lastmod: '2026-10-25' }));
const locs = entries.map((e) => e.loc);

test('every tool page, the home page, the tower and every fix page, each exactly once', () => {
  for (const p of Object.keys(TOOLS)) assert.equal(locs.filter((l) => l === p).length, 1, p);
  for (const p of ['/', '/conquered/', '/compare/', '/fix/', '/store/', '/code-review/', '/llms.txt']) assert.equal(locs.filter((l) => l === p).length, 1, p);
  for (const p of fixPages) assert.ok(locs.includes('/fix/' + p.slug + '/'), p.slug);
  assert.equal(new Set(locs).size, locs.length, 'no page listed twice');
  for (const l of locs) assert.match(l, /^\/(?:[a-z0-9-]+\/?|[a-z0-9-]+\/[a-z0-9-]+\/?|llms\.txt)?$/, l);
});

test('the lab: the gallery and every experiment the catalog publishes, none that is broken', () => {
  assert.ok(locs.includes('/lab/'));
  for (const slug of lab) assert.ok(locs.includes('/lab/' + slug + '/'), slug);
  assert.equal(locs.filter((l) => l.startsWith('/lab/')).length, lab.length + 1);
  assert.ok(!pages({ fixPages }).some((p) => p.loc.startsWith('/lab/')), 'no lab entries without a catalog');
});

test('the /is-it/ days: one slug per day the function knows, every one answered by isIt, no aliases', () => {
  const slugs = isItSlugs();
  assert.ok(slugs.includes('christmas') && !slugs.includes('xmas') && !slugs.includes('christmas-day'), 'christmas once, under its first name');
  assert.ok(slugs.includes('friday') && slugs.includes('the-weekend') && slugs.includes('leap-year') && slugs.includes('halloween') && slugs.includes('thanksgiving'));
  for (const s of slugs) assert.ok(isIt('is it ' + s.replace(/-/g, ' ')), s + ' answers');
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.ok(locs.includes('/is-it/' + s), s + ' in the sitemap');
  assert.deepEqual(isItSlugs({ a: ['A', () => 0], b: ['A', () => 0] }).filter((s) => !/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|the-weekend|weekday|leap-year)$/.test(s)), [], 'a made-up day isIt does not answer is left out');
});

test('the XML is well formed: a declaration, one urlset, balanced url tags, absolute https locs, nothing unescaped', () => {
  const text = xml(entries);
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(text.trimEnd().endsWith('</urlset>'));
  for (const tag of ['url', 'loc', 'lastmod', 'changefreq', 'priority']) assert.equal((text.match(new RegExp('<' + tag + '>', 'g')) || []).length, (text.match(new RegExp('</' + tag + '>', 'g')) || []).length, tag + ' balanced');
  assert.equal((text.match(/<url>/g) || []).length, entries.length);
  for (const l of locsOf(text)) assert.ok(l.startsWith(SITE + '/'), l);
  assert.doesNotMatch(text, /&(?!amp;|lt;|gt;|quot;|apos;)/, 'every & escaped');
  assert.doesNotMatch(text.replace(/<[^>]+>/g, ''), /[<>]/, 'no tag characters in text');
  assert.match(text, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.equal(xml([{ loc: '/a?b=1&c=2', lastmod: '2026-01-01', changefreq: 'daily', priority: '0.5' }]).includes('<loc>' + SITE + '/a?b=1&amp;c=2</loc>'), true);
});

test('the committed sitemap.xml lists the same pages as the generator (run node tools/sitemap.mjs when not)', () => {
  const have = locsOf(readFileSync(resolve(root, OUT), 'utf8')), want = locsOf(xml(entries));
  assert.deepEqual(have.filter((u) => !want.includes(u)), [], 'pages the generator no longer lists');
  assert.deepEqual(want.filter((u) => !have.includes(u)), [], 'pages the committed file is missing');
});

test('lastmod is a day from git, and today for a file git does not know', () => {
  assert.match(lastmod(['AGENTS.md']), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(lastmod(['no/such/file.html'], root, '2026-10-25'), '2026-10-25');
});
