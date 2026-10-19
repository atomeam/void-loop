// Churn caps for the build loop (lib/churn.js, tools/churn.mjs, and pickWant's `hot` list in lib/will-guard.js).
// Run: node --test tools/churn.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotFiles, namedHot, MAX_CHANGES } from '../void-live-deploy/lib/churn.js';
import { pickWant, skippedNote } from '../void-live-deploy/lib/will-guard.js';
import { commitsSince } from './churn.mjs';

const NOW = Date.parse('2026-10-18T12:00:00Z'), day = 864e5;
const commit = (ago, ...files) => ({ at: new Date(NOW - ago * day).toISOString(), files });

test('a file is hot only above the cap, inside the window; one commit counts once per file; most changed first', () => {
  const cs = [...Array.from({ length: MAX_CHANGES + 1 }, (_, i) => commit(i / 10, 'a.js', 'a.js', 'b.js')), commit(6.5, 'b.js'), commit(20, 'c.js'), commit(-1, 'c.js')];
  assert.deepEqual(hotFiles(cs, { now: NOW }), [{ file: 'a.js', changes: MAX_CHANGES + 1 }, { file: 'b.js', changes: MAX_CHANGES + 2 }].sort((x, y) => y.changes - x.changes));
  assert.deepEqual(hotFiles(cs.slice(0, MAX_CHANGES), { now: NOW }), [], 'exactly at the cap is not over it');
  assert.deepEqual(hotFiles(null, { now: NOW }), []);
  const ledger = Array.from({ length: 30 }, () => commit(0.1, 'void-live-deploy/void.growth.json', 'docs/MAP.md', 'tools/real.mjs'));
  assert.deepEqual(hotFiles(ledger, { now: NOW }).map((h) => h.file), ['tools/real.mjs'], 'the ledger, the map and the logs change every ship by design');
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
  assert.equal(pickWant(wants, [], 2, hot.concat([{ file: 'x/notebook.js' }])).want, null, 'every want waits');
});

test('commitsSince reads this repo\'s git without throwing', () => {
  const cs = commitsSince(2);
  assert.ok(Array.isArray(cs) && cs.every((c) => Number.isFinite(Date.parse(c.at)) && Array.isArray(c.files)));
});
