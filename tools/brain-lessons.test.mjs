// Lessons from results (lib/brain-lessons.js; hooked in lib/team-crew-run.js, read by lib/self-context.js and functions/api/propose-fix.js).
// Run: node --test tools/brain-lessons.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonOf, mergeLessons, lessonLines, keepLessons, KEEP } from '../void-live-deploy/lib/brain-lessons.js';
import { recall } from '../void-live-deploy/lib/brain-recall.js';
import { selfFacts } from '../void-live-deploy/lib/self-context.js';
const want = { key: 'exam-sports', title: 'Raise the sports exam score from 90', label: 'sports exam score', baseline: 90, latest: 92.6 };
test('a met, reopened or set-aside want becomes one plain lesson; a private one shows no numbers', () => {
  const m = lessonOf({ kind: 'met', want, job: 'j1', at: '2026-11-20T00:00:00Z' });
  assert.match(m.text, /worked: sports exam score moved from 90 to 92.6/); assert.equal(m.id, 'result:j1:met'); assert.equal(m.from, 'result');
  assert.match(lessonOf({ kind: 'reopened', want: { ...want, latest: 90 }, job: 'j1' }).text, /did not move sports exam score \(still 90\)/);
  assert.match(lessonOf({ kind: 'set aside', want, job: 'j1', why: 'reopened 2 times' }).text, /Gave up on .*reopened 2 times/);
  assert.doesNotMatch(lessonOf({ kind: 'met', want: { ...want, title: 'Make a first sale', label: 'verified sales', private: 1 }, job: 'j2' }).text, /\d/);
  assert.equal(lessonOf({ kind: 'nope', want, job: 'x' }), null);
});
test('lessons merge by id, newest first, capped; a repeat counts as seen', () => {
  const a = lessonOf({ kind: 'met', want, job: 'j1' }), b = lessonOf({ kind: 'reopened', want, job: 'j2' });
  const kept = mergeLessons(mergeLessons([], [a]), [b, a]);
  assert.deepEqual(kept.map((l) => l.id), [b.id, a.id]); assert.equal(kept[1].seen, 2);
  assert.equal(mergeLessons([], Array.from({ length: KEEP + 5 }, (_, i) => ({ id: 'x' + i }))).length, KEEP);
  assert.equal(lessonLines([a])[0].startsWith('- Doing'), true);
});
test('keepLessons writes once, and the lessons reach recall and the self facts', async () => {
  let wrote = null;
  const env = { DB: { prepare: (q) => ({ bind: (...v) => ({ first: async () => null, run: async () => { wrote = v; } }) }) } };
  assert.equal(await keepLessons(env, [lessonOf({ kind: 'met', want, job: 'j1' })]), 1);
  assert.equal(wrote[0], 'lessons'); assert.match(wrote[1], /sports exam score/);
  const l = lessonOf({ kind: 'met', want, job: 'j1' });
  assert.ok(recall('raise the sports exam score', [l]).length >= 1, 'the fix proposer recalls it');
  assert.match(selfFacts({ lessons: [l] }), /What my results taught me lately[\s\S]*sports exam score moved from 90 to 92.6/);
});
test('the crew run keeps a lesson for every settled want, and the fix proposer reads D1 lessons', () => {
  const run = readFileSync(new URL('../void-live-deploy/lib/team-crew-run.js', import.meta.url), 'utf8');
  assert.match(run, /lessons\.push\(lessonOf\(\{ kind: 'met'/); assert.match(run, /await keepLessons\(env, lessons\)/);
  assert.match(readFileSync(new URL('../void-live-deploy/functions/api/propose-fix.js', import.meta.url), 'utf8'), /bind\(LESSONS_KEY\)/);
});
