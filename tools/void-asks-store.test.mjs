// V01D's own asks of 2026-10-15 (Suggested-by: Void): the store-preview carousel, store-publish into its growth inbox, the
// auto-clip loop for new forge models, the decay timer for stale experiments, and the tester-log card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import preview, { previewAsk, slides } from '../void-live-deploy/skills/store.js';
import growth, { testerAsk, testerRows as rows } from '../void-live-deploy/skills/growth.js';
import { inboxRow, suggestNext, newForgeModels, readCatalog } from './store-publish.mjs';
import { storeMoments } from './clips.mjs';
import { carrySince, staleExperiments } from './families.mjs';
import { summarize } from './tester-log.mjs';
import { STORE_PRODUCTS } from '../void-live-deploy/lib/store.js';

test('store-preview: routed from store asks, newest first, buy links only for live Gumroad products', () => {
  for (const a of ["what's new in the store", 'whats new in the store?', 'store', 'store preview', 'new products', 'latest products in the store', "What’s new in your shop"]) assert.ok(previewAsk(a), a);
  for (const a of ['store this note', 'grocery store near me', "what's new", 'what can i buy', 'new york']) assert.ok(!previewAsk(a), a);
  const s = slides();
  assert.ok(s.length > 0 && s.length <= 8);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].published >= s[i].published, 'newest first');
  for (const x of s) { const p = STORE_PRODUCTS.find((q) => q.id === x.id); assert.ok(!p.soon); assert.equal(!!x.buy, !!p.gumroad); if (x.buy) assert.match(x.buy, /^https:\/\/moonbeam846\.gumroad\.com\/l\/.+utm_medium=store-preview/); }
  assert.deepEqual(slides([{ id: 'a', name: 'A', soon: true }, { id: 'b', name: 'B', status: 'unpublished' }]), []);
  assert.ok(preview.suite().ok && preview.match('', 'store preview') && preview.match('', 'what can i buy'));
});

test('store-publish tells V01D what it packaged and suggests the next product', () => {
  const cat = { products: [{ id: 'x', pack: 'print-set', status: 'live' }, { id: 'y', pack: 'clips', status: 'live' }] };
  assert.match(suggestNext(cat), /minis-stl/);
  const row = inboxRow({ name: 'V01D | Pack', pack: 'print-set', cents: 0 }, 3, cat, '2026-10-15');
  assert.equal(row.split('|').length, 6, 'a pipe in a name never breaks the table');
  assert.match(row, /^\| shipped \(packaged\) \| 2026-10-15 \| V01D \/ Pack \| store-publish: print-set, 3 files, free; next: a minis-stl pack/);
});

test('auto-clip loop: a forge model missing from the printables pack is new; its clip films it being forged', () => {
  const cat = { products: [{ id: 'v01d-forge-printables', contents: ['v01d-rocket.stl', 'v01d-bottle.stl', 'README.txt'] }] };
  assert.deepEqual(newForgeModels(cat, ['rocket', 'bottle', 'teapot']), ['teapot']);
  assert.deepEqual(newForgeModels({ products: [] }, ['rocket']), ['rocket']);
  const real = readCatalog(); assert.ok(Array.isArray(newForgeModels(real, ['rocket'])));
  const m = storeMoments('{"at":"2026-10-15T00:00:00Z","id":"v01d-forge-printables","hook":"h","caption":"c","ask":"make me a teapot"}\n{"at":"2026-10-15T00:00:00Z","id":"p","hook":"h","caption":"c"}');
  assert.equal(m[0].ask, 'make me a teapot'); assert.equal(m[0].url, undefined); assert.ok(m[0].tricks.includes('ken-burns'));
  assert.equal(m[1].ask, 'open the store'); assert.equal(m[1].url, '/store/#p');
});

test('decay timer: an experiment keeps the day it started; over 14 days it is flagged for review, never removed', () => {
  const fams = [{ name: 'F', skills: [{ name: 'a', tier: 'experiment' }, { name: 'b', tier: 'experiment' }, { name: 'c', tier: 'proven' }] }];
  carrySince(fams, { families: [{ skills: [{ name: 'a', since: '2026-09-01' }, { name: 'c', since: '2026-09-01' }] }] }, '2026-10-15');
  assert.equal(fams[0].skills[0].since, '2026-09-01'); assert.equal(fams[0].skills[1].since, '2026-10-15'); assert.equal(fams[0].skills[2].since, undefined);
  const st = staleExperiments({ families: fams }, '2026-10-15');
  assert.deepEqual(st.map((x) => x.name), ['a']); assert.equal(st[0].days, 44);
  assert.equal(fams[0].skills.length, 3, 'flag only');
});

test('tester-log: the public view of the site tester, newest first, and the card that shows it', () => {
  const s = summarize([{ at: '2026-10-15T06:04:21Z', passed: 10, of: 10, kind: 'grow', note: 'a' }, { at: '2026-10-15T06:20:22Z', passed: 10, of: 11, kind: 'file', note: 'b' }], { cases: [1, 2] });
  assert.equal(s.cases, 2); assert.equal(s.runsTotal, 2); assert.equal(s.runs[0].note, 'b'); assert.deepEqual(s.kinds, { grow: 1, file: 1 });
  const r = rows(s); assert.equal(r[0].ok, false); assert.equal(r[0].score, '10 of 11'); assert.equal(r[0].when, '2026-10-15 06:20 UTC');
  for (const a of ['tester log', 'site tester log', 'what is the site tester testing', 'site test results', 'what have you tested lately']) assert.ok(testerAsk(a), a);
  for (const a of ['test my site', 'blood test results', 'tester']) assert.ok(!testerAsk(a), a);
  assert.ok(growth.match('tester log', 'tester log') && growth.match('growth', 'growth'));
});
