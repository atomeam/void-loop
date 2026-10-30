// Verse's own asks of 2026-10-15 (Suggested-by: Verse): the store-preview carousel, store-publish into its growth inbox, the
// auto-clip loop for new forge models, the decay timer for stale experiments, and the tester-log card.
import { test } from 'node:test';
import fs from 'node:fs';
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

test('store-publish tells Verse what it packaged and suggests the next product', () => {
  const cat = { products: [{ id: 'x', pack: 'print-set', status: 'live' }, { id: 'y', pack: 'clips', status: 'live' }] };
  assert.match(suggestNext(cat), /minis-stl/);
  const row = inboxRow({ name: 'Verse | Pack', pack: 'print-set', cents: 0 }, 3, cat, '2026-10-15');
  assert.equal(row.split('|').length, 6, 'a pipe in a name never breaks the table');
  assert.match(row, /^\| shipped \(packaged\) \| 2026-10-15 \| Verse \/ Pack \| store-publish: print-set, 3 files, free; next: a minis-stl pack/);
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

import { failuresByFamily, spurt, stability, ownerHtml } from '../void-live-deploy/skills/growth.js';
test('owner view on the growth card: failures by family, stability, the last spurt', () => {
  const fam = { families: [{ name: 'Words', skills: [{ name: 'define', tier: 'proven', failing: ['a', 'b'] }, { name: 'book', tier: 'tested' }] }, { name: 'Sky', skills: [{ name: 'weather', tier: 'proven' }, { name: 'uv', tier: 'tested', failing: ['c'] }] }] };
  assert.deepEqual(failuresByFamily(fam), [{ family: 'Words', skills: 1, asks: 2 }, { family: 'Sky', skills: 1, asks: 1 }]);
  const L = [{ at: '2026-10-15T06:00:00Z', kind: 'grow', what: 'store preview: x' }, { at: '2026-10-15T01:00:00Z', kind: 'fix', what: 'digest (y)' }, { at: '2026-10-13T00:00:00Z', kind: 'grow', what: 'old' }];
  assert.deepEqual(spurt(L), { added: ['store preview'], changed: ['digest'] });
  assert.equal(stability(fam, { 'skill:weather': '2026-10-15T06:00:00Z' }).filter((x) => x.passed).length, 1);
  const h = ownerHtml((x) => String(x), fam, L, { 'skill:weather': 'x' });
  assert.match(h, /Failures by family: <b[^>]*>Words<\/b> 1 skill \(2 asks\), <b[^>]*>Sky<\/b> 1 skill \(1 ask\)\. Stability: 1 of 4 skills proven with nothing failing; the site tester has passed 1 of them live\. Last spurt: 1 new \(store preview\), 1 changed\./);
  assert.match(ownerHtml(String, { families: [] }, [], {}), /Failures by family: none on the bench/);
});

import rack, { parodyOf } from '../void-live-deploy/skills/rack.js';
import { source, DOC, OUT } from './parody.mjs';
test('parody games in the rack: the 30-game matrix, searchable, with Verse\'s own version', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), source(fs.readFileSync(DOC, 'utf8')), 'run: node tools/parody.mjs');
  assert.equal(parodyOf('parody of monopoly').row.parody, 'Hollow Holdings');
  assert.equal(parodyOf("what's your version of clue?").row.parody, 'Who Deleted Verse?');
  assert.equal(parodyOf('is reversi in the public domain').row.parody, 'Flipside');
  assert.equal(parodyOf('make a v01d version of risk').row.parody, 'R1SK.EXE');
  assert.equal(parodyOf('parody forge stratego').row.parody, 'Fog of Verse');
  assert.ok(parodyOf('parody games').all && parodyOf('parody-forge').all);
  assert.equal(parodyOf('parody of the zorkball board game').unknown, 'zorkball');
  for (const a of ['is water wet', 'play chess', 'what is a parody', 'parody of a song by weird al', 'is the moon public domain']) assert.equal(parodyOf(a), null, a);
  assert.ok(rack.match('', 'parody games'), 'the parody list is the rack\'s');
  assert.ok(!rack.match('', 'games'), 'a bare "games" is the Game Box\'s (skills/gamebox.js), whose own examples list it; the rack stays out of it');
});

import films, { wantsNewFilms, newSince } from '../void-live-deploy/skills/films.js';
test('films: the feed monitor shows what is new since this browser last looked', () => {
  for (const a of ['new films', 'any new films?', 'latest videos from v01d', "what's new on v01d tube", 'any new videos today']) assert.ok(wantsNewFilms(a), a);
  for (const a of ['new films about space', 'best new films of 2025', 'films', 'film a timer']) assert.ok(!wantsNewFilms(a), a);
  const F = [{ id: 'c' }, { id: 'b' }, { id: 'a' }, { id: 'z' }];
  assert.deepEqual(newSince(F, 'a').map((f) => f.id), ['c', 'b']);
  assert.deepEqual(newSince(F, 'c'), []);
  assert.deepEqual(newSince(F, null).map((f) => f.id), ['c', 'b', 'a']);
  assert.deepEqual(newSince(F, 'gone').map((f) => f.id), ['c', 'b', 'a']);
  assert.ok(films.match('new films') && films.match('films') && !films.match('best films of 2025'));
});

import { pulse } from '../void-live-deploy/skills/growth.js';
test('growth tree: a pulse once the target is ready, marked on the node', () => {
  const calls = []; const n = { dataset: {}, animate: (k, o) => calls.push(o.duration) };
  assert.equal(pulse(n), true); assert.equal(n.dataset.pulsed, '1'); assert.deepEqual(calls, [700]);
  assert.equal(pulse(null), false); assert.equal(pulse({ dataset: {} }), false);
});
