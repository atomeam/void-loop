// tools/indexnow-urls.mjs: changed files map to the sitemap pages they make (and only listed ones), the sitemap parse, the key file, the
// 10,000-URL batches and what each engine answer means. Pure: no git, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitemapUrls, keyFromFile, changedUrls, bodies, meaning, MAX_URLS } from './indexnow-urls.mjs';
import { pages, SITE, OUT } from './sitemap.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listed = sitemapUrls(readFileSync(resolve(root, OUT), 'utf8'));
const all = pages({ fixPages: JSON.parse(readFileSync(resolve(root, 'tools/fix-pages.json'), 'utf8')) });
const map = (changed) => changedUrls(changed, all, listed, SITE);

test('the sitemap parse: every <loc>, unescaped, once', () => {
  assert.deepEqual(sitemapUrls('<urlset><url><loc>https://x.com/a?b=1&amp;c=2</loc></url><url><loc> https://x.com/ </loc></url><url><loc>https://x.com/</loc></url></urlset>'), ['https://x.com/a?b=1&c=2', 'https://x.com/']);
  assert.ok(listed.length > 50 && listed.includes(SITE + '/') && listed.includes(SITE + '/base64/'));
});

test('a tool page, a fix page and a page folder file map to their own URL', () => {
  assert.deepEqual(map(['void-live-deploy/base64/index.html']), [SITE + '/base64/']);
  const fix = all.find((p) => p.loc.startsWith('/fix/') && p.loc !== '/fix/');
  assert.deepEqual(map(['void-live-deploy' + fix.loc + 'index.html']), [SITE + fix.loc]);
  // a file in a nested page folder is that page's, not its parent's
  assert.deepEqual(map(['void-live-deploy/pdf/merge/app.js']), [SITE + '/pdf/merge/']);
});

test('the home page: its index.html or the repo void.html, never every file under the site', () => {
  assert.deepEqual(map(['void.html']), [SITE + '/']);
  assert.deepEqual(map(['void-live-deploy/index.html']), [SITE + '/']);
  assert.deepEqual(map(['void-live-deploy/skills/chess.js', 'void-live-deploy/functions/api/answer.js', 'tools/checks.mjs', 'domains/void.agents.log.md']), []);
});

test('the /is-it/ function is every day it answers', () => {
  const urls = map(['void-live-deploy/functions/is-it/[what].js']);
  assert.ok(urls.length > 10 && urls.every((u) => u.startsWith(SITE + '/is-it/')) && urls.includes(SITE + '/is-it/friday'));
});

test('only URLs the sitemap lists are ever sent', () => {
  const pagesX = [{ loc: '/new/', files: ['void-live-deploy/new/index.html'] }, { loc: '/old/', files: ['void-live-deploy/old/index.html'] }];
  assert.deepEqual(changedUrls(['void-live-deploy/new/index.html', 'void-live-deploy/old/index.html'], pagesX, ['https://x.com/old/'], 'https://x.com'), ['https://x.com/old/']);
  assert.deepEqual(changedUrls([], pagesX, ['https://x.com/old/'], 'https://x.com'), []);
});

test('the key file: named <key>.txt and holding exactly that key', () => {
  const k = 'abcdef0123456789abcdef0123456789'; // secret-scan: ok (a made-up IndexNow key; a real one is public anyway)
  assert.equal(keyFromFile(k + '.txt', k + '\n'), k);
  assert.equal(keyFromFile(k + '.txt', 'something else'), null);
  assert.equal(keyFromFile('short.txt', 'short'), null); // under 8 characters
  assert.equal(keyFromFile('humans.txt', 'hello'), null);
  const real = readdirSync(resolve(root, 'void-live-deploy')).filter((n) => n.endsWith('.txt') && keyFromFile(n, readFileSync(resolve(root, 'void-live-deploy', n), 'utf8')));
  assert.equal(real.length, 1, 'exactly one key file is served at the site root');
});

test('batches of at most 10,000 URLs; nothing to send is no request', () => {
  const urls = Array.from({ length: MAX_URLS + 5 }, (_, i) => 'https://x.com/' + i);
  const b = bodies(urls, { host: 'x.com', key: 'k', keyLocation: 'https://x.com/k.txt' });
  assert.equal(b.length, 2);
  assert.equal(b[0].urlList.length, MAX_URLS);
  assert.deepEqual(Object.keys(b[0]), ['host', 'key', 'keyLocation', 'urlList']);
  assert.deepEqual(bodies([], { host: 'x.com' }), []);
});

test('engine answers: 200 and 202 accepted, the rest not', () => {
  assert.ok(meaning(200).ok && meaning(202).ok);
  for (const s of [400, 403, 422, 429, 500]) assert.equal(meaning(s).ok, false, String(s));
  assert.match(meaning(403).text, /key/i);
  assert.match(meaning(429).text, /many/i);
});
