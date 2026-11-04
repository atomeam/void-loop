// /brain/'s Knows view (lib/brain-knows.js, brain/knows.js, tools/brain-knows.mjs): what Verse knows, searchable, and the simulation only on Watch.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { wantsOf, search, countsOf, hrefOf, termsOf, KINDS } from '../void-live-deploy/lib/brain-knows.js';
import { build, render } from './brain-knows.mjs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const items = [
  { k: 'skill', id: 'pdf-merge', t: 'PDF merge', d: 'join PDFs into one', ex: ['merge two pdfs'] },
  { k: 'page', id: '/pdf/', t: 'PDF tools', d: 'merge, split and sign PDFs', u: '/pdf/' },
  { k: 'site', id: 'ilovepdf.com', t: 'ilovepdf.com', st: 'surpassed', d: 'ahead on 9 of 9', u: '/pdf/', src: 'https://ilovepdf.com/' },
  { k: 'lesson', id: 'x', t: 'live check: baggage', d: '2026-11-03: did not work; 403' },
];

test('search: every term must be met, the title counts most, and a kind narrows it', () => {
  assert.deepEqual(termsOf('  PDF  merge pdf '), ['pdf', 'merge']);
  assert.deepEqual(search(items, 'pdf merge').map((x) => x.id), ['pdf-merge', '/pdf/']);
  assert.deepEqual(search(items, 'pdf', 'site').map((x) => x.id), ['ilovepdf.com']);
  assert.deepEqual(search(items, 'surpassed').map((x) => x.id), ['ilovepdf.com']);
  assert.equal(search(items, 'nothing-like-this').length, 0);
  assert.equal(search(items, '').length, items.length);
  assert.deepEqual(countsOf(items, 'pdf'), { all: 3, skill: 1, page: 1, site: 1 });
  assert.ok(KINDS.some(([k]) => k === 'want'));
});

test('links: an item goes to its page, else asks Verse', () => {
  assert.equal(hrefOf(items[1]), '/pdf/');
  assert.equal(hrefOf(items[0]), '/?q=merge%20two%20pdfs');
  assert.equal(hrefOf(items[3]), '/?q=live%20check%3A%20baggage');
});

test('wants: the will now first, then what it got', () => {
  const w = wantsOf({ at: '2026-11-03T00:00:00Z', wants: [{ i_want: 'I want A', because: 'b' }], got: [{ title: 'B', what: 'built B', builtAt: '2026-10-22' }] });
  assert.deepEqual(w.map((x) => [x.t, !!x.got]), [['I want A', false], ['B', true]]);
  assert.deepEqual(wantsOf(null), []);
  assert.equal(wantsOf({ wants: [{ i_want: 'I want C', because: 'same', evidence: 'same' }] })[0].d, 'same', 'a reason said twice is said once');
});

test('knows.json is current and every item has a kind, an id and a title', () => {
  const file = JSON.parse(read('void-live-deploy/brain/knows.json'));
  for (const it of file.items) { assert.ok(['skill', 'page', 'site', 'lesson', 'did'].includes(it.k), it.k); assert.ok(it.id && it.t, JSON.stringify(it)); }
  const counts = {}; for (const it of file.items) counts[it.k] = (counts[it.k] || 0) + 1;
  assert.deepEqual(file.counts, counts);
  assert.ok(counts.skill > 100 && counts.page > 20 && counts.site > 20, JSON.stringify(counts));
  const b = build({ guide: { pages: [{ kind: 'skill', name: 'flip', title: 'Coin flip', examples: ['flip a coin'] }] }, what: { flip: 'heads or tails' }, pageOf: { flip: ['/flip/', 'Flip'] }, pages: [], assimilated: { sites: [] }, knowledge: [], log: ['abc1234567\t2026-11-03T00:00:00Z\tFix the coin', 'def\t2026-11-03T00:00:00Z\tConductor: tick'] });
  assert.deepEqual(b.counts, { skill: 1, page: 0, site: 0, lesson: 0, did: 1 });
  assert.equal(b.items[0].u, '/flip/'); assert.equal(b.builtWith, 0); assert.match(render(b), /\n$/);
  const lined = build({ guide: { pages: [{ kind: 'skill', name: 'drive-share', title: 'Drive share', examples: ['split a drive'] }, { kind: 'skill', name: 'calc', title: 'Calc' }] }, what: { 'drive-share': 'split a drive' }, pageOf: {}, pages: [], assimilated: { sites: [] }, knowledge: [], log: [], lineage: { 'drive-share': ['calc', 'convert'] } });
  assert.equal(lined.builtWith, 1);
  assert.equal(lined.items.find((i) => i.id === 'drive-share').withLine, 'Built with the calculator and the unit converter.');
});

test('the page: Knows first, searchable, the simulation only on Watch, ?view=watch or ?t=', () => {
  const html = read('void-live-deploy/brain/index.html'), js = read('void-live-deploy/brain/knows.js');
  for (const id of ['knows', 'kFind', 'kChips', 'kList', 'kAsk', 'watchBtn']) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.doesNotMatch(html, /import '\/brain\/app\.js';/, 'the simulation is not a static import of the page');
  assert.match(js, /params\.get\('view'\) === 'watch' \|\| params\.has\('t'\)/);
  assert.match(js, /fetch\('\/brain\/knows\.json'/); assert.match(js, /fetch\('\/api\/will'\)/);
  assert.match(js, /withLine/); assert.match(js, /skills built with skills/);
  assert.match(html, /k-with/);
});
