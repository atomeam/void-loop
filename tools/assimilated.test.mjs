import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historyOf, fileOf, firstSeen, hostOf, build } from './assimilated.mjs';

test('one row per site, at its furthest outcome, with the ease it was picked by and where it is recorded', () => {
  const rows = historyOf({
    sitePages: [{ path: '/pdf/', lane: 'pdf' }, { path: '/pdf/merge/', lane: 'pdf: codeshack.io', tools: ['merge'] }],
    selfSites: [{ url: 'https://convertlive.com/', page: '/convert/unit-converter/', family: 'unit converter', added: '2026-10-26T07:26:14Z' }],
    state: { sites: { 'convertlive.com': { at: '2026-10-26T07:26:26Z', outcome: 'surpassed', page: '/convert/unit-converter/' }, 'vcalc.com': { at: '2026-10-26T07:10:49Z', outcome: 'gone', why: 'answered 403' },
      'easy.example': { at: '2026-11-03T10:00:00Z', outcome: 'no-family', ease: { score: 42, place: 1, why: '12 controls, 80 KB' } } } },
    floors: [{ site: 'pw.example', url: 'https://www.pw.example/', page: '/password/strength/', beaten: true, n: 15, m: 15, learned: 'nothing leaves the device', at: '2026-10-30T05:29:02Z' }, { site: 'no.example', beaten: false }],
    backfill: { hosts: { 'codeshack.io': { at: '2026-10-26T03:18:08Z', sha: 'faa6aacdd', file: 'void-live-deploy/lib/tower.js' } } },
  });
  assert.deepEqual(rows.map((r) => r.site), ['easy.example', 'pw.example', 'convertlive.com', 'vcalc.com', 'codeshack.io'], 'newest first; the lane leader "pdf" and an unbeaten floor are not sites');
  const by = Object.fromEntries(rows.map((r) => [r.site, r]));
  assert.equal(by['convertlive.com'].status, 'surpassed', 'built and then surpassed reads surpassed');
  assert.deepEqual(by['convertlive.com'].sources, ['void-live-deploy/lib/self-sites.js', 'domains/tower-self.json']);
  assert.equal(by['codeshack.io'].status, 'assimilated'); assert.equal(by['codeshack.io'].took, 'merge'); assert.equal(by['codeshack.io'].at, '2026-10-26T03:18:08Z', 'dated by its first commit');
  assert.equal(by['vcalc.com'].why, 'answered 403');
  assert.deepEqual(by['easy.example'].ease, { score: 42, place: 1, why: '12 controls, 80 KB' });
  assert.equal(by['pw.example'].learned, 'nothing leaves the device');
  const f = fileOf(rows);
  assert.deepEqual(f.counts, { sites: 5, surpassed: 2, passed: 0, assimilated: 1, current: 0, parked: 0, tried: 2 });
  assert.equal(f.target, null);
});

test('the first commit that named each host, from git log text', () => {
  const log = ['@@COMMIT aaa1111 2026-10-26T03:18:08+00:00', '+++ b/void-live-deploy/lib/tower.js', '+ { site: "a.example" },', '-b.example', '@@COMMIT bbb2222 2026-10-27T10:00:00-04:00', '+++ b/domains/tower-self.json', '+"b.example": {}', '+"a.example": {}'].join('\n');
  assert.deepEqual(firstSeen(log, ['a.example', 'b.example', 'c.example']), { 'a.example': { at: '2026-10-26T03:18:08Z', sha: 'aaa1111', file: 'void-live-deploy/lib/tower.js' }, 'b.example': { at: '2026-10-27T14:00:00Z', sha: 'bbb2222', file: 'domains/tower-self.json' } });
  assert.equal(hostOf('https://www.Example.com/x'), 'example.com'); assert.equal(hostOf('tools.pdf24.org'), 'tools.pdf24.org');
});

test('the real list: every site Versus by itself read and every lane page is in it, each with real evidence', async () => {
  const j = await build(), sites = new Set(j.sites.map((r) => r.site));
  const state = JSON.parse(readFileSync(new URL('../domains/tower-self.json', import.meta.url), 'utf8'));
  for (const h of Object.keys(state.sites)) assert.ok(sites.has(hostOf(h)), h);
  for (const r of j.sites) { assert.ok(r.sources.length, r.site + ' names where it is recorded'); assert.match(r.at, /^20\d\d-\d\d-\d\dT/, r.site + ' has a date'); }
  assert.ok(j.counts.surpassed >= 2 && j.counts.assimilated >= 1);
  const page = readFileSync(new URL('../void-live-deploy/assimilated/index.html', import.meta.url), 'utf8');
  assert.match(page, /fetch\('\/assimilated\.json'/); assert.match(readFileSync(new URL('../void-live-deploy/conquered/index.html', import.meta.url), 'utf8'), /href="\/assimilated\/"/, 'Versus links to it');
});

test('the card\'s target is the history\'s target, with its page by topic and its score; a site covered by an existing page counts as assimilated', () => {
  const rows = historyOf({ floors: [{ state: 'current', site: 'ndscalc.ru', url: 'https://ndscalc.ru/', page: '/calculator/?mode=vat', topic: 'vat', n: 3, m: 12 }],
    state: { sites: { 'calc.example': { at: '2026-11-03T20:00:00Z', outcome: 'covered', page: '/calculator/', topic: 'calculator' } } } });
  const f = fileOf(rows), by = Object.fromEntries(rows.map((r) => [r.site, r]));
  assert.deepEqual(f.target, { site: 'ndscalc.ru', page: '/calculator/?mode=vat', score: { n: 3, m: 12 } });
  assert.equal(by['ndscalc.ru'].status, 'now assimilating'); assert.equal(by['calc.example'].status, 'assimilated into an existing page');
  assert.equal(f.counts.current, 1); assert.equal(f.counts.assimilated, 1);
});

test('every page /assimilated/ links to is there: a removed page links to the page that does its job now, or to none (Verse status crawl, 2026-11-03)', async () => {
  const { pageExists } = await import('./assimilated.mjs');
  const file = JSON.parse((await import('node:fs')).readFileSync(new URL('../void-live-deploy/assimilated.json', import.meta.url), 'utf8')), there = pageExists();
  for (const r of file.sites) if (r.page) assert.ok(there(r.page), r.site + ' links to ' + r.page + ', which is not a page');
  const rows = historyOf({ selfSites: [{ url: 'https://notepad-plus-plus.org/', page: '/text-editor/notepad-plus-plus/', title: 'Notepad++' }, { url: 'https://ndscalc.ru/', page: '/gone-vat/', family: 'vat calculator' }], exists: there });
  const by = Object.fromEntries(rows.map((r) => [r.site, r]));
  assert.equal(by['notepad-plus-plus.org'].page, ''); assert.equal(by['notepad-plus-plus.org'].pageWas, '/text-editor/notepad-plus-plus/');
  assert.equal(by['ndscalc.ru'].page, '/calculator/?mode=vat');
});
