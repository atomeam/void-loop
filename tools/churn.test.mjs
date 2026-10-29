// Churn caps for the build loop (lib/churn.js, tools/churn.mjs, and pickWant's `hot` list in lib/will-guard.js).
// Run: node --test tools/churn.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotFiles, namedHot, hotOf, MAX_CHANGES, SWEEP_FILES, WINDOW_DAYS } from '../void-live-deploy/lib/churn.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { pickWant, skippedNote } from '../void-live-deploy/lib/will-guard.js';
import { commitsSince, churnJson } from './churn.mjs';

const NOW = Date.parse('2026-10-18T12:00:00Z'), day = 864e5;
const commit = (ago, ...files) => ({ at: new Date(NOW - ago * day).toISOString(), files });

test('a file is hot only above the cap, inside the window; one commit counts once per file; most changed first', () => {
  const cs = [...Array.from({ length: MAX_CHANGES + 1 }, (_, i) => commit(i / 10, 'a.js', 'a.js', 'b.js')), commit(6.5, 'b.js'), commit(20, 'c.js'), commit(-1, 'c.js')];
  assert.deepEqual(hotFiles(cs, { now: NOW }), [{ file: 'a.js', changes: MAX_CHANGES + 1 }, { file: 'b.js', changes: MAX_CHANGES + 2 }].sort((x, y) => y.changes - x.changes));
  assert.deepEqual(hotFiles(cs.slice(0, MAX_CHANGES), { now: NOW }), [], 'exactly at the cap is not over it');
  assert.deepEqual(hotFiles(null, { now: NOW }), []);
  const ledger = Array.from({ length: 30 }, () => commit(0.1, 'void-live-deploy/void.growth.json', 'docs/MAP.md', 'tools/real.mjs'));
  assert.deepEqual(hotFiles(ledger, { now: NOW }).map((h) => h.file), ['tools/real.mjs'], 'the ledger, the map and the logs change every ship by design');
  const made = Array.from({ length: 30 }, () => commit(0.1, 'void-live-deploy/sitemap.xml', 'void-live-deploy/llms.txt', 'void-live-deploy/skills/what.json', 'void-live-deploy/tower.evidence.json', 'void-live-deploy/lib/tower.js'));
  assert.deepEqual(hotFiles(made, { now: NOW }).map((h) => h.file), ['void-live-deploy/lib/tower.js'], 'generated files and the tower gate\'s evidence change every ship by design; the tower code still counts');
});

test('a want names a hot file by path or by file name as a whole word, not by part of another name', () => {
  const hot = [{ file: 'void-live-deploy/lib/will-guard.js', changes: 20 }];
  assert.deepEqual(namedHot('tighten lib/will-guard.js', hot), ['void-live-deploy/lib/will-guard.js']);
  assert.equal(namedHot('fix will-guard.js again', hot).length, 1);
  assert.equal(namedHot('rename my-will-guard.js', hot).length, 0);
  assert.equal(namedHot('a notebook skill', hot).length, 0);
});

test('pickWant skips a want that names a hot file and takes the next; the note says which file', () => {
  const wants = [{ title: 'Rework will-guard.js', why: '' }, { title: 'A new card', why: 'uses lib/notebook.js' }];
  const hot = [{ file: 'void-live-deploy/lib/will-guard.js', changes: 20 }];
  const r = pickWant(wants, [], 2, hot);
  assert.equal(r.want.title, 'A new card');
  assert.deepEqual(r.skipped.map((s) => [s.title, s.churn]), [['Rework will-guard.js', ['void-live-deploy/lib/will-guard.js']]]);
  assert.match(skippedNote(r.skipped), /will-guard\.js, changed more than 12 times in 7 days/);
  assert.equal(pickWant(wants, [], 2).want.title, 'Rework will-guard.js', 'no hot list, no change');
  const all = pickWant(wants, [], 2, hot.concat([{ file: 'x/notebook.js' }]));
  assert.equal(all.want.title, 'Rework will-guard.js', 'every want names a hot file: the first goes ahead, so the loop never starves');
  assert.deepEqual(all.overCap, ['void-live-deploy/lib/will-guard.js']);
  assert.deepEqual(all.skipped.map((s) => s.title), ['A new card']);
  assert.match(skippedNote(all.skipped, all.overCap), /goes ahead anyway \(void-live-deploy\/lib\/will-guard\.js\)/);
  const tried = [{ target: 'will:rework-will-guard-js', state: 'failed' }, { target: 'will:rework-will-guard-js', state: 'set aside' }];
  assert.equal(pickWant(wants, tried, 2, hot.concat([{ file: 'x/notebook.js' }])).want.title, 'A new card', 'a want out of tries never goes ahead over the cap');
  assert.equal(pickWant([wants[0]], tried, 2, hot).want, null, 'tries used up still means it waits');
});

test('commitsSince reads this repo\'s git without throwing', () => {
  const cs = commitsSince(2);
  assert.ok(Array.isArray(cs) && cs.every((c) => Number.isFinite(Date.parse(c.at)) && Array.isArray(c.files)));
});

test('a sweep commit (more than SWEEP_FILES files) counts for none of its files', () => {
  const big = Array.from({ length: SWEEP_FILES + 1 }, (_, i) => 'archive/f' + i + '.md');
  const cs = Array.from({ length: MAX_CHANGES + 1 }, (_, i) => commit(i / 10, ...big, 'tools/real.mjs'));
  assert.deepEqual(hotFiles(cs, { now: NOW }), [], 'a 6000-file regeneration is not work on each file');
  const small = Array.from({ length: MAX_CHANGES + 1 }, (_, i) => commit(i / 10, ...big.slice(0, SWEEP_FILES - 1), 'tools/real.mjs'));
  assert.equal(hotFiles(small, { now: NOW }).length, SWEEP_FILES, 'at the cap it still counts');
});

test('hotOf reads churn.json and drops a list older than the window, so a missed deploy never holds a want back for ever', () => {
  const j = churnJson([{ file: 'lib/a.js', changes: 20 }, { nope: 1 }], new Date(NOW - day).toISOString());
  assert.deepEqual(hotOf(j, NOW), [{ file: 'lib/a.js', changes: 20 }]);
  assert.deepEqual(hotOf({ ...j, at: new Date(NOW - (WINDOW_DAYS + 1) * day).toISOString() }, NOW), []);
  assert.deepEqual(hotOf({ ...j, at: new Date(NOW + day).toISOString() }, NOW), [], 'a time in the future is not trusted');
  for (const bad of [null, {}, { at: 'x', hot: [] }, { at: j.at, hot: 'no' }]) assert.deepEqual(hotOf(bad, NOW), []);
});

test('the will reads /churn.json and passes its hot list to pickWant, with the want\'s full reason', () => {
  const src = readFileSync(new URL('../void-live-deploy/functions/api/will.js', import.meta.url), 'utf8');
  assert.match(src, /\/churn\.json/);
  assert.match(src, /pickWant\([^;]*hot\)/);
  assert.match(src, /catch \(_\) \{ hot = \[\]; \}/, 'an unreadable list means no cap, never no will');
});

test('generated cards and the tower gate\'s record are expected churn, never hot', () => {
  const gen = ['void-live-deploy/skills/what.json', 'void-live-deploy/sitemap.xml', 'void-live-deploy/parity.json', 'void-live-deploy/churn.json', 'void-live-deploy/tower.evidence.json'];
  const cs = Array.from({ length: MAX_CHANGES + 1 }, (_, i) => commit(i / 10, ...gen, 'void-live-deploy/lib/real.js'));
  assert.deepEqual(hotFiles(cs, { now: NOW }).map((h) => h.file), ['void-live-deploy/lib/real.js']);
});

test('the churn cap holds back only the will\'s own wants: only the will, its writer and its log name churn.json or import lib/churn.js', () => {
  const root = new URL('..', import.meta.url).pathname, hits = [];
  const walk = (d) => { for (const n of readdirSync(d)) { if (n === 'node_modules' || n === '.git' || n === 'archive') continue; const p = d + '/' + n, st = statSync(p);
    if (st.isDirectory()) walk(p); else if (/\.(?:m?js|ya?ml|py|sh)$/.test(n) && st.size < 2e6) { const t = readFileSync(p, 'utf8'); if (/churn\.json|from ['"][./]*(?:lib\/)?churn\.js['"]/.test(t)) hits.push(p.slice(root.length)); } } };
  walk(root + '.github'); walk(root + 'tools'); walk(root + 'void-live-deploy');
  assert.deepEqual(hits.sort(), ['tools/churn.mjs', 'tools/churn.test.mjs', 'tools/refresh.mjs', 'tools/will.py', 'void-live-deploy/functions/api/will.js', 'void-live-deploy/lib/churn.js', 'void-live-deploy/lib/will-guard.js'].sort(), 'a PR gate or another loop reading the churn list would block agents\' work');
});
