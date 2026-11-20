// The held-out pool (tools/heldout-exam.mjs, void-live-deploy/tower.heldout.json). Run: node --test tools/heldout-exam.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, sample, problemsOf, jobsOf, applyRun, serialize, AREAS, SIZE, POOL_MIN } from './heldout-exam.mjs';
import { load as loadFixed, clarity } from './assistant-exam.mjs';

const file = load(), fixed = loadFixed().set;
test('the pool is big, spread over all seven areas, shares no ask with the fixed set, and every reference scores 100', () => {
  assert.deepEqual(problemsOf(file, fixed), []);
  assert.ok(file.set.length >= POOL_MIN);
  assert.deepEqual([...new Set(file.set.map((q) => q.area))].sort(), [...AREAS].sort());
});
test('a sample is 20 questions over every area, takes the least-asked first, and changes when the counts change', () => {
  let x = 7; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const a = sample(file.set, {}, SIZE, rnd);
  assert.equal(a.length, SIZE); assert.equal(new Set(a.map((q) => q.id)).size, SIZE);
  assert.equal(new Set(a.map((q) => q.area)).size, AREAS.length);
  const seen = Object.fromEntries(a.map((q) => [q.id, 1])), b = sample(file.set, seen, SIZE, rnd);
  assert.equal(b.filter((q) => seen[q.id]).length, 0, 'fresh questions come first while unseen ones remain');
  assert.equal(sample(file.set, seen, 500, rnd).length, file.set.length, 'asking for more than the pool returns the pool');
});
test('a gap goes on the build list by area and what was lacking, never by the question\'s words', () => {
  const set = [{ id: 'h01', area: 'health', ask: 'SECRETWORDS about a sore throat' }, { id: 'c01', area: 'coding', ask: 'OTHERWORDS' }];
  const rows = [{ id: 'h01', right: 100, useful: 60, clear: 100, gaps: { right: [], useful: ['says what helps or who to ask'], clear: [] } }, { id: 'c01', right: 100, useful: 100, clear: 100, gaps: { right: [], useful: [], clear: [] } }];
  const jobs = jobsOf(set, rows, '2026-11-20');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].aspect, 'heldout:health');
  assert.match(jobs[0].job, /"health"[\s\S]*says what helps or who to ask/); assert.ok(!/SECRETWORDS|sore throat/.test(JSON.stringify(jobs)));
});
test('a run counts what was asked, keeps the last rows and the history, and the file round-trips one line a question', () => {
  const picked = file.set.slice(0, 2), ok = picked.map((q) => ({ text: q.reference, status: 'done', bot: 'verse' }));
  const out = applyRun({ file, picked, answers: ok, base: 'https://x', at: '2026-11-20T10:00:00Z' });
  assert.equal(out.file.seen[picked[0].id], 1); assert.equal(out.sum.questions, 2); assert.equal(out.sum.right, 100);
  assert.equal(out.file.runs.length, (file.runs || []).length + 1);
  const text = serialize(out.file); assert.deepEqual(JSON.parse(text).set.length, file.set.length);
  assert.ok(text.split('\n').length < file.set.length + 60);
});
test('the words null and undefined inside an explanation are not a raw-data leak, a bare one is', () => {
  const q = { want: 'explain', maxWords: 100 };
  assert.equal(clarity(q, 'It means the variable is null, so nothing was assigned. Check where it is set before you use it.').score, 100);
  assert.ok(clarity(q, 'undefined').score < 100);
  assert.ok(clarity(q, 'The answer is: undefined, so try again with a longer question here.').score < 100);
});
