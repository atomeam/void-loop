// tools/rival-inventory.mjs: robots first, sitemap parsing, embed folding, matching against Verse, and the PARITY/queue output. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as R from './rival-inventory.mjs';

const fx = (f) => fileURLToPath(new URL('./fixtures/rival/' + f, import.meta.url));

test('robots.txt: the * group, longest rule wins, a named group beats *, Sitemap lines kept', () => {
  const open = R.parseRobots(readFileSync(fx('robots-open.txt'), 'utf8'));
  assert.equal(R.allowed(open, '/'), true);
  assert.equal(R.allowed(open, '/cgi-bin/run'), false);
  assert.deepEqual(open.sitemaps, ['https://www.example-rival.test/sitemap.xml']);
  const closed = R.parseRobots(readFileSync(fx('robots-closed.txt'), 'utf8'));
  assert.equal(R.allowed(closed, '/'), false);
  assert.equal(R.allowed(closed, '/', 'Googlebot'), true);
  const wild = R.parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow:\n');
  assert.equal(R.allowed(wild, '/a/b.pdf'), false);
  assert.equal(R.allowed(wild, '/a/b.pdf?x'), true);
  assert.equal(R.allowed(R.parseRobots(''), '/anything'), true);
});

test('sitemap.xml: urlset and sitemapindex', () => {
  assert.deepEqual(R.parseSitemapXml('<urlset><url><loc>https://x.test/a.html</loc></url><url><loc> https://x.test/b?c=1&amp;d=2 </loc></url></urlset>'),
    { index: false, locs: ['https://x.test/a.html', 'https://x.test/b?c=1&d=2'] });
  assert.equal(R.parseSitemapXml('<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>').index, true);
});

test('HTML sitemap: same-site tool links with their section; home, about, sitemap and other sites left out; embeds folded', () => {
  const e = R.parseHtmlSitemap(readFileSync(fx('sitemap.html'), 'utf8'), 'https://www.example-rival.test/');
  assert.deepEqual(e.map((x) => x.name), ['Mortgage Calculator', 'Rent Calculator', 'Fraction Calculator', 'Fraction Calculator']);
  assert.equal(e[0].section, 'Financial Calculators');
  assert.equal(e[2].section, 'Math Calculators');
  const t = R.toolsOf(e);
  assert.equal(t.length, 3);
  assert.deepEqual(t[2], { url: 'https://www.example-rival.test/fraction-calculator.html', name: 'Fraction Calculator', section: 'Math Calculators', embeds: 1 });
});

test('embed addresses and names from addresses', () => {
  assert.equal(R.embedOf('https://x.test/embed/bmi-calculator.html'), 'https://x.test/bmi-calculator.html');
  assert.equal(R.embedOf('https://x.test/bmi-calculator-embed.html'), 'https://x.test/bmi-calculator.html');
  assert.equal(R.embedOf('https://x.test/bmi?embed=1'), 'https://x.test/bmi');
  assert.equal(R.embedOf('https://x.test/bmi-calculator.html'), null);
  assert.equal(R.nameFromUrl('https://x.test/mortgage-payoff-calculator.html'), 'Mortgage payoff calculator');
});

test('words and matching: alias first, then a Verse name or id starting with the words, fewest extra words', () => {
  assert.deepEqual(R.words('Mortgage Payoff Calculator'), ['mortgage', 'payoff']);
  assert.deepEqual(R.words('Base64 Encode / Decode'), ['base64']);
  const cat = [{ name: 'Mortgage payment', href: '/calculators/?calc=mortgage', seqs: [['mortgage', 'payment'], ['mortgage']] },
    { name: 'Mortgage payoff and extra payments', href: '/calculators/?calc=x', seqs: [['mortgage', 'payoff', 'extra', 'payment']] },
    { name: 'Pendulum period', href: '/calculators/?calc=pendulum', seqs: [['pendulum', 'period'], ['pendulum']] }];
  assert.deepEqual(R.matchTool('Mortgage Calculator', cat), { href: '/calculators/?calc=mortgage', by: 'words', name: 'Mortgage payment' });
  assert.equal(R.matchTool('Mortgage Payoff Calculator', cat).href, '/calculators/?calc=x');
  assert.equal(R.matchTool('Rent Calculator', cat), null);
  assert.equal(R.matchTool('Period Calculator', cat), null, 'a word in the middle of a name is not a match');
  assert.deepEqual(R.matchTool('Scientific Calculator', []), { href: '/calculators/#keypad', by: 'alias', name: '' });
});

test('every alias points at a Verse page or calculator that exists', async () => {
  const cat = await R.verseCatalogue(), hrefs = new Set(cat.map((c) => c.href));
  for (const [k, href] of Object.entries(R.ALIASES)) {
    const page = href.replace(/[?#].*$/, '');
    assert.ok(href.includes('?calc=') ? hrefs.has(href) : hrefs.has(page), 'alias "' + k + '" points at ' + href + ', which Verse does not have');
  }
});

test('rivals: one row a host, floors listed, noRival carried', () => {
  const rows = R.rivalsOf([{ id: 'a', url: 'https://www.r.test/x' }, { id: 'b', url: 'https://r.test/y' }, { id: 'c', url: 'https://v.test/', noRival: 'robots' }, { id: 'd' }]);
  assert.deepEqual(rows, [{ url: 'https://www.r.test/', floors: ['a', 'b'], noRival: '' }, { url: 'https://v.test/', floors: ['c'], noRival: 'robots' }]);
});

test('end to end from fixtures: robots-blocked site skipped unread, open site read from its HTML sitemap', async () => {
  const cat = [{ name: 'Mortgage', href: '/calculators/?calc=mortgage', seqs: [['mortgage']] }];
  const shut = await R.inventory({ url: 'https://shut.test/', floors: ['s'], noRival: '' }, cat, { 'shut.test/robots.txt': fx('robots-closed.txt'), __offline: true });
  assert.equal(shut.status, 'skipped'); assert.match(shut.why, /robots/); assert.equal(shut.tools.length, 0);
  const open = await R.inventory({ url: 'https://www.example-rival.test/', floors: ['calc'], noRival: '' }, cat,
    { 'example-rival.test/robots.txt': fx('robots-open.txt'), 'example-rival.test/sitemap.html': fx('sitemap.html'), __offline: true });
  assert.equal(open.status, 'read'); assert.equal(open.sitemap, 'https://www.example-rival.test/sitemap.html');
  assert.deepEqual(open.tools.map((t) => [t.name, !!t.verse]), [['Mortgage Calculator', true], ['Rent Calculator', false], ['Fraction Calculator', true]]);
  const none = await R.inventory({ url: 'https://empty.test/', floors: ['e'], noRival: '' }, cat, { __offline: true });
  assert.equal(none.status, 'no sitemap');
  const text = R.parityText([open, shut], '2026-10-28');
  assert.match(text, /\| example-rival\.test \| calc \| read https:\/\/www\.example-rival\.test\/sitemap\.html \| 3 \| 2 \| 1 \|/);
  assert.match(text, /\| shut\.test \| s \| skipped: robots\.txt turns robots away \| 0 \| 0 \| 0 \|/);
  assert.match(text, /\| Financial Calculators \| Rent Calculator \| https:\/\/www\.example-rival\.test\/rent-calculator\.html \|/);
  assert.match(text, /1 embeddable copies counted with their page/);
  const q = R.queueLines([open], '2026-10-28').map((l) => JSON.parse(l));
  assert.deepEqual(q, [{ kind: 'rival-gap', floor: 'calc', site: 'example-rival.test', section: 'Financial Calculators', tool: 'Rent Calculator', url: 'https://www.example-rival.test/rent-calculator.html', status: 'queued', seen: '2026-10-28' }]);
  const doc = '# Parity\n\nIntro.\n\n## Old entry\n\nBody.\n';
  const once = R.withParity(doc, text), twice = R.withParity(once, text.replace('2026-10-28', '2026-10-29'));
  assert.ok(once.indexOf('Rival inventory') < once.indexOf('## Old entry') && once.includes('Intro.') && once.includes('Body.'));
  assert.equal(twice.split('Rival inventory:').length, 2, 'a second run replaces the part, never adds another');
});
