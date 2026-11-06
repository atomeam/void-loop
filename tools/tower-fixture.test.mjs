// The browser suite's Versus fixture (tools/tower-fixture.mjs). Run: node --test tools/tower-fixture.test.mjs
// Each test builds the card the way skills/tower.js load() does (towerArgs over the served files), with the fixture in place of the served
// tower.target.json and tower.features.json, so the three "tower:" browser checks are reproduced here without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS, passingRows, tower, towerArgs } from '../void-live-deploy/lib/tower.js';
import { towerHtml, changes } from '../void-live-deploy/skills/tower.js';
import { seasonTarget, featuresWithout, towerFixture, conquerable } from './tower-fixture.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const served = (f) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch (_) { return null; } };
const files = () => ({ fr: served('tower.frontier.json'), rk: served('tower.rank.json'), sz: served('tower.size.json'), gn: served('tower.gone.json'), tg: served('tower.target.json'), ft: served('tower.features.json') });
const card = (ev, fx) => { const s = files(); return tower(...towerArgs([], { ...s, ev: { floors: ev }, tg: fx ? fx.target : s.tg, ft: fx ? fx.features : s.ft })); };
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');
const rows = (f, n = 99) => Object.fromEntries(Object.entries(passingRows(f, { evidence: 'stub' })).slice(0, n));

test('seasonTarget keeps the served target and season, names exactly the given sites as passed, and leaves the served object alone', () => {
  const s = { id: 'photos: squoosh.app', since: '2026-11-06', season: { start: '2026-11-06' }, passed: [{ id: 'my ip', at: '2026-11-06' }] };
  const t = seasonTarget(s, [{ id: 'travel' }, { id: 'is it' }]);
  assert.equal(t.id, 'photos: squoosh.app'); assert.deepEqual(t.season, { start: '2026-11-06' });
  assert.deepEqual(t.passed.map((r) => r.id), ['travel', 'is it']);
  assert.deepEqual(s.passed.map((r) => r.id), ['my ip'], 'the served object is not changed');
  assert.deepEqual(seasonTarget({ id: 'x', since: '2026-11-01' }, []).season, { start: '2026-11-01' }, 'no season served: the target\'s own day starts one');
});

test('featuresWithout drops the crawl rows of the conquered sites only', () => {
  const ft = { sites: { 'www.calculator.net': { missing: ['a'] }, 'example.com': { missing: ['b'] } } };
  const out = featuresWithout(ft, [{ id: 'calculator', url: 'https://www.calculator.net/' }]);
  assert.deepEqual(Object.keys(out.sites), ['example.com']); assert.equal(Object.keys(ft.sites).length, 2);
  assert.equal(featuresWithout(null, []), null);
});

test('conquerable skips the target and a held floor', () => {
  const fl = [{ id: 'a' }, { id: 't' }, { id: 'b', held: 'waiting' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(conquerable(fl, { target: 't', n: 3 }).map((f) => f.id), ['a', 'c', 'd']);
});

test('root cause: in the season, fully won evidence alone conquers nothing; the served passed[] decides (main red, 2026-11-06)', () => {
  const s = files(), won3 = conquerable(FLOORS, { target: s.tg.id, n: 3 }), ev = Object.fromEntries(won3.map((f) => [f.id, rows(f)]));
  const bare = { target: { id: s.tg.id, season: { start: '2026-11-06' }, passed: [] }, features: s.ft };
  const t = card(ev, bare);
  assert.equal(t.beaten, 0, 'none of the stubbed sites counts while tower.target.json does not name it');
  assert.equal(t.floors.find((f) => f.state === 'current').id, s.tg.id);
});

test('check "the target on top": three conquered under it, struck, and the score "3 surpassed · now taking on: <target>" whatever the served passed[] holds', () => {
  const s = files(), TARGET = s.tg.id, tgt = tower([], {}, s.fr, null, null, null, TARGET).floors.find((f) => f.id === TARGET);
  const won3 = conquerable(FLOORS, { target: TARGET, n: 3 });
  const ev = { ...Object.fromEntries(won3.map((f) => [f.id, rows(f)])), [tgt.id]: rows(tgt, 4) };
  const t = card(ev, towerFixture({ target: s.tg, features: s.ft }, won3));
  assert.equal(t.beaten, 3); assert.equal(t.passed, 0);
  const html = towerHtml(t, esc, { enter: false });
  assert.deepEqual([...html.matchAll(/class="tower-floor"[^>]*data-state="(\w+)"/g)].map((m) => m[1]), ['current', 'beaten', 'beaten', 'beaten']);
  const score = text((html.match(/<div class="tw-score tower-line">([\s\S]*?)<\/div>/) || [])[1] || '');
  assert.equal(score, '3 surpassed · ' + (tgt.pinned ? 'now taking on: ' : 'easiest site left: ') + tgt.site);
  const cur = t.floors.find((f) => f.state === 'current'); assert.equal(cur.site, tgt.site); assert.equal(cur.n, 4);
});

test('check "Google Flights names /flights/": travel is conquered, its row is followed by its links, and every link row names a page', () => {
  const s = files(), travel = FLOORS.find((f) => f.id === 'travel');
  const t = card({ travel: rows(travel), [FLOORS[0].id]: rows(FLOORS[0]) }, towerFixture({ target: s.tg, features: s.ft }, [travel, FLOORS[0]]));
  assert.equal(t.floors.find((f) => f.id === 'travel').state, 'beaten');
  const html = towerHtml(t, esc, { enter: false });
  const after = html.split('<div class="tower-floor" role="button" tabindex="0" data-id="travel"')[1] || '', ln = (after.match(/<\/div>(<div class="tw-links"[\s\S]*?<\/div>)/) || [])[1] || '';
  assert.match(text(ln), /Google Flights ↗/); assert.match(text(ln), /Verse's page \/flights\//); assert.match(text(ln), /side by side/);
  assert.match(ln, /<a class="tw-page" href="\/flights\/"/);
  const links = [...html.matchAll(/<div class="tw-links"[\s\S]*?<\/div>/g)].map((m) => m[0]);
  assert.ok(links.length >= 2 && links.every((l) => /class="tw-page"/.test(l)), 'every entry names its page');
});

test('check "the open card picked up a conquered site": calculator.net goes from passed to conquered and the card says "calculator.net is surpassed"', () => {
  const s = files(), calc = FLOORS.find((f) => f.id === 'calculator'), fx = towerFixture({ target: s.tg, features: s.ft }, [calc]);
  const before = card({}, fx), after = card({ calculator: rows(calc) }, fx);
  assert.equal(before.floors.find((f) => f.id === 'calculator').state, 'passed');
  const won = after.floors.find((f) => f.id === 'calculator'); assert.equal(won.state, 'beaten'); assert.equal(won.floor, 1);
  assert.ok(changes(before, after).includes('calculator.net is surpassed.'));
  assert.match(text(towerHtml(after, esc, { enter: false })), /calculator\.net\s*surpassed/);
});
