// The assistant exam as a house guard (tools/guards/assistant.mjs): a run logs the score, records the marks, queues the gaps, and hands the coder the weakest.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, lineOf, askOf, BAR } from './guards/assistant.mjs';
import { load, scoreOne } from './assistant-exam.mjs';
import { GUARDS, guardsFor } from '../void-live-deploy/lib/verse-guards.js';
import { runGuards } from './verse-guards.mjs';

const file = load();
const mkRoot = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-')); fs.mkdirSync(path.join(root, 'void-live-deploy'), { recursive: true });
  for (const f of ['tower.assistant.json', 'tower.universe.json']) fs.copyFileSync(new URL('../void-live-deploy/' + f, import.meta.url), path.join(root, 'void-live-deploy', f));
  const af = path.join(root, 'void-live-deploy/tower.assistant.json'); fs.writeFileSync(af, JSON.stringify({ ...JSON.parse(fs.readFileSync(af, 'utf8')), last: null, runs: [] })); return root; };
const ctxOf = (root, saved, jobs) => ({ root, site: 'https://x.test', now: Date.UTC(2026, 10, 21, 13, 13), save: (f, t) => { saved[path.basename(f)] = t; }, queueJob: async (a, t) => { jobs.push({ a, t }); return { queued: true }; } });
// an answer per question: the reference for the ones in `good`, a refusal for the rest
const asker = (good) => async (base, askText) => { const q = file.set.find((x) => x.ask === askText); return good.includes(q.id) ? { text: q.reference, status: 'done', tier: 'free', bot: 'verse' } : { text: 'I am a note-search bot. Please provide a note and the word you wish to find.', status: 'done', tier: 'free', bot: 'note-search' }; };

test('the exam is a guard on the 13:00 lane, once a day', () => {
  const g = GUARDS.find((x) => x.id === 'assistant'); assert.deepEqual(g.hours, [13]);
  assert.ok(guardsFor(13).some((x) => x.id === 'assistant') && !guardsFor(9).some((x) => x.id === 'assistant'));
});
test('a run with some weak answers logs the score, saves both files, queues the gaps and hands the coder the weakest', async () => {
  const root = mkRoot(), saved = {}, jobs = [], good = file.set.slice(0, 14).map((q) => q.id);
  const r = await run(ctxOf(root, saved, jobs), { ask: asker(good) });
  assert.equal(r.ok, true);
  assert.match(r.last, /^Scored \d+(\.\d)? of 100 on 20 fixed questions \(right /); assert.match(r.last, /6 questions with a gap are on the build list/); assert.match(r.last, /Heal job for the coder \(queued\)/);
  const a = JSON.parse(saved['tower.assistant.json']), u = JSON.parse(saved['tower.universe.json']);
  assert.equal(a.last.questions, 20); assert.equal(a.runs.length, 1); assert.ok(a.last.right > 60 && a.last.right < 80);
  const t = u.targets.find((x) => x.id === 'top-assistant'); assert.ok(t.marks.right.verse > 0 && t.marks.right.judge === 'assistant-exam');
  assert.equal(u.background.filter((b) => b.id === 'top-assistant' && /^q:/.test(b.aspect)).length, 6);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].t, 'heal:assistant-exam'); assert.match(jobs[0].a, /never for these words/);
});
test('a second run replaces the first run\'s queued questions instead of piling up, and keeps one row per run', async () => {
  const root = mkRoot(); let saved = {}; const jobs = [];
  await run(ctxOf(root, saved, jobs), { ask: asker(file.set.slice(0, 10).map((q) => q.id)) });
  fs.writeFileSync(path.join(root, 'void-live-deploy/tower.assistant.json'), saved['tower.assistant.json']); fs.writeFileSync(path.join(root, 'void-live-deploy/tower.universe.json'), saved['tower.universe.json']);
  saved = {}; await run(ctxOf(root, saved, jobs), { ask: asker(file.set.slice(0, 16).map((q) => q.id)) });
  const a = JSON.parse(saved['tower.assistant.json']), u = JSON.parse(saved['tower.universe.json']);
  assert.equal(a.runs.length, 2);
  assert.equal(u.background.filter((b) => b.id === 'top-assistant' && /^q:/.test(b.aspect)).length, 4);
});
test('all twenty right: the line says above the bar and the coder is not asked for anything', async () => {
  const root = mkRoot(), saved = {}, jobs = [];
  const r = await run(ctxOf(root, saved, jobs), { ask: asker(file.set.map((q) => q.id)) });
  assert.match(r.last, /Above 94 on all three\.$/); assert.equal(jobs.length, 0);
  assert.equal(JSON.parse(saved['tower.universe.json']).background.filter((b) => /^q:/.test(b.aspect)).length, 0);
});
test('a run where the agent would not answer (the daily cap, the agent off) writes nothing and is a failed run', async () => {
  const root = mkRoot(), saved = {}, jobs = [];
  const r = await run(ctxOf(root, saved, jobs), { ask: async () => ({ text: '', status: 'refused: {"ok":false}', tier: '' }) });
  assert.equal(r.ok, false); assert.deepEqual(saved, {}); assert.deepEqual(jobs, []); assert.match(r.last, /no score to log/);
});
test('through the guard runner a dry run writes no file and the record carries the line', async () => {
  const lines = [], root = mkRoot();
  const load2 = async () => ({ run: (ctx) => run({ ...ctx, root }, { ask: asker(file.set.map((q) => q.id)) }) });
  const out = await runGuards(['assistant'], { dry: true, load: load2, log: (l) => lines.push(l), now: Date.UTC(2026, 10, 21, 13) });
  assert.match(lines.join('\n'), /Assistant exam: Ran\. Scored 100 of 100/); assert.ok(!fs.existsSync(path.join(root, 'void-live-deploy/progress/loops/assistant.json')), 'a dry run writes no log file'); assert.equal(out.length, 1);
});
test('lineOf and askOf say the score and the weakest questions in plain words, never a rival', () => {
  const rows = [scoreOne(file.set[4], 'I am a bot.'), scoreOne(file.set[0], file.set[0].reference)];
  const sum = { overall: 50, right: 50, useful: 50, clear: 50, questions: 2 };
  assert.match(lineOf(sum, 5, 1), /1 question with a gap are on the build list \(5 gaps\)/);
  const a = askOf(file.set, rows, sum); assert.match(a, /^The assistant exam scored 50/); assert.match(a, /virus and a bacterium/); assert.ok(!/Atom/.test(a)); assert.equal(BAR, 94);
});
