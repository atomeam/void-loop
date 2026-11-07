// Web Lore (owner, 2026-11-06): every site Verse has met gets a sorted, cited record at /lore/<site>, readable as text, JSON or a page,
// and the stage answers "history of <site>" from it. tools/lore.mjs builds lore.json and lib/lore-names.js; functions/lore/[[path]].js answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { shelfOf, categoryOf, namesOf, AMBIGUOUS } from './lore.mjs';
import { rowOf, recordOf, textOf, page, slugOf } from '../void-live-deploy/functions/lore/[[path]].js';
import skill, { loreAsk } from '../void-live-deploy/skills/web-lore.js';
import { histRender } from '../void-live-deploy/skills/tower.js';

const LORE = JSON.parse(readFileSync(new URL('../void-live-deploy/lore.json', import.meta.url), 'utf8'));

test('lore.mjs builds lore.json and lib/lore-names.js from the repo (the deploy rebuilds both, so the committed copies only have to be well formed)', () => {
  const r = spawnSync(process.execPath, [new URL('./lore.mjs', import.meta.url).pathname, '--dry'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const names = readFileSync(new URL('../void-live-deploy/lib/lore-names.js', import.meta.url), 'utf8');
  assert.match(names, /^\/\/.*\nexport const LORE_NAMES = new Set\(\[/s);
});

test('every site has one row, a category, a state, and the counts add up', () => {
  assert.equal(LORE.sites.length, LORE.count);
  assert.equal(new Set(LORE.sites.map((s) => s.s)).size, LORE.count, 'no site twice');
  assert.equal(LORE.cats.reduce((n, [, c]) => n + c, 0), LORE.count);
  assert.equal(LORE.documented, LORE.sites.filter((s) => s.f).length);
  for (const s of LORE.sites) { assert.ok(s.c && s.n && s.st, s.s); assert.match(s.s, /^[a-z0-9.-]+$/, s.s); }
  assert.ok(LORE.cats.at(-1)[0] === 'Not sorted yet' || !LORE.cats.some(([c]) => c === 'Not sorted yet'), 'the unsorted shelf comes last');
});

test('a site is sorted by the job it does first, then by its title', () => {
  const none = () => null;
  assert.deepEqual(categoryOf({ title: 'Anything', site: 'a.example' }, () => ({ topic: 'weather' })), { c: 'Weather', from: 'job' });
  assert.deepEqual(categoryOf({ title: 'Some Site', site: 'a.example', kind: 'web portal' }, none), { c: 'Web portal', from: 'wikidata' });
  assert.deepEqual(categoryOf({ title: '', site: 'a.example', machine: 'plain text' }, none), { c: 'Machine endpoints', from: 'fetch' });
  assert.deepEqual(categoryOf({ title: 'Remote Jobs', site: 'a.example' }, none), { c: shelfOf('Remote Jobs', 'a.example'), from: 'title' });
  assert.ok(shelfOf('Remote Jobs', 'a.example'));
  assert.deepEqual(categoryOf({ title: 'Qwzx', site: 'a.example' }, none), { c: 'Not sorted yet', from: '' });
});

test('a bare name answers only for a documented site that is not an everyday word', () => {
  const names = namesOf(LORE);
  assert.ok(names.includes('4chan'));
  for (const w of AMBIGUOUS) assert.ok(!names.includes(w), w);
  assert.ok(names.every((n) => !n.includes('.')));
});

test('an ask finds its row by slug, host, host without its ending, or name; nothing else', () => {
  for (const q of ['4chan', '4chan.org', 'https://www.4chan.org/']) assert.equal((rowOf(LORE.sites, q) || {}).s, '4chan', q);
  assert.equal((rowOf(LORE.sites, 'Hugging Face') || {}).s, 'hugging-face');
  assert.equal(rowOf(LORE.sites, 'rome'), null); assert.equal(rowOf(LORE.sites, ''), null);
  assert.equal(slugOf('WWW.Example.COM'), 'example.com');
});

test('a record keeps only facts with an https source, counts the rest, and the text and page show each source', () => {
  const row = { s: 'x.example', n: 'X', u: 'https://x.example/', c: 'Tools', cf: 'title', st: 'in the queue' };
  const h = { doc: 'docs/HISTORY/x.example.md', events: [{ k: 'Founded', y: 2001, t: 'Started in 2001.', s: 'https://www.wikidata.org/wiki/Q1' }, { k: 'Owner', t: 'Bad', s: 'javascript:alert(1)' }, { k: 'Founders', t: 'unknown', u: 1 }], snaps: [[2005, 'https://web.archive.org/web/2005/x.example']] };
  const r = recordOf(row, h);
  assert.equal(r.facts.length, 1); assert.equal(r.unknown, 1); assert.equal(r.archived.length, 1); assert.equal(r.record, 'https://a-to-mind.com/lore/x.example');
  assert.match(textOf(r), /Founded: Started in 2001\. <https:\/\/www\.wikidata\.org\/wiki\/Q1>/);
  const html = page(r); assert.match(html, /href="https:\/\/www\.wikidata\.org\/wiki\/Q1"/); assert.doesNotMatch(html, /javascript:/); assert.doesNotMatch(html, /<script/);
  assert.match(html, /href="\/conquered\/"/); assert.match(html, /href="\/lab\/"/); assert.match(html, /href="\/treasury\/"/); assert.match(html, /href="\/"/);
  assert.match(page(recordOf({ ...row, n: '<b>x</b>' }, null)), /&lt;b&gt;x&lt;\/b&gt;/, 'names are escaped');
});

test('the stage takes "history of <site>" asks and leaves other history and what-is questions alone', () => {
  for (const [ask, q] of [['history of 4chan', '4chan'], ['History of 4chan?', '4chan'], ['4chan history', '4chan'], ['what is the history of reddit', 'reddit'],
    ['history of icanhazip.com', 'icanhazip.com'], ['tell me about theguardian.com', 'theguardian.com'], ['who runs wizchan.org', 'wizchan.org'], ['reddit website history', 'reddit']]) assert.deepEqual(loreAsk(ask), { q }, ask);
  assert.deepEqual(loreAsk('web lore'), { list: true }); assert.deepEqual(loreAsk('open web lore'), { list: true });
  for (const ask of ['history of rome', 'history of the internet', 'what is love', 'history of amazon', 'what is reddit', 'tell me about yourself', 'what is 5.5', 'history of 1.5', 'what is in github.com/atomeam/void-loop', 'what is github.com/atomeam/void-loop']) assert.equal(loreAsk(ask), null, ask);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
});

test('the history under an op on the tower ends with a link to its Web Lore record', () => {
  const mk = (tag) => ({ tag, children: [], dataset: {}, style: {}, textContent: '', href: '', appendChild(c) { this.children.push(c); return c; } });
  const doc = { createElement: mk, createTextNode: (t) => ({ tag: '#text', textContent: t }) };
  const box = mk('div'); box.dataset.slug = '4chan';
  histRender({ events: [{ k: 'Founded', t: 'In 2003.', s: 'https://www.wikidata.org/wiki/Q1' }] }, box, doc);
  const links = []; const walk = (n) => { if (n.tag === 'a') links.push(n); (n.children || []).forEach(walk); }; walk(box);
  assert.ok(links.some((a) => a.href === '/lore/4chan' && /Web Lore/.test(a.textContent)));
});

test('the page, its route and its links are in place, and the homepage is untouched', () => {
  const routes = JSON.parse(readFileSync(new URL('../void-live-deploy/_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/lore') && routes.include.includes('/lore/*'));
  const html = readFileSync(new URL('../void-live-deploy/lore/index.html', import.meta.url), 'utf8');
  for (const href of ['/conquered/', '/lab/', '/treasury/', '/ip', '/']) assert.match(html, new RegExp('href="' + href.replace(/\//g, '\\/') + '"'), href);
  assert.doesNotMatch(html, /innerHTML/, 'the list is built with text, never parsed HTML');
  for (const p of ['lab/index.html', 'treasury/index.html']) assert.match(readFileSync(new URL('../void-live-deploy/' + p, import.meta.url), 'utf8'), /href="\/lore\/"/, p);
  assert.doesNotMatch(readFileSync(new URL('../void-live-deploy/index.html', import.meta.url), 'utf8'), /\/lore\//, 'nothing is added to the homepage');
});
