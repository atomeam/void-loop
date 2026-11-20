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
  for (const f of ['tower.assistant.json', 'tower.universe.json', 'tower.heldout.json']) fs.copyFileSync(new URL('../void-live-deploy/' + f, import.meta.url), path.join(root, 'void-live-deploy', f));
  const hf = path.join(root, 'void-live-deploy/tower.heldout.json'); fs.writeFileSync(hf, JSON.stringify({ ...JSON.parse(fs.readFileSync(hf, 'utf8')), seen: {}, runs: [], last: null, streak: 0 })); // the lane keeps the real file's streak and counts moving; a test starts from nothing
  const af = path.join(root, 'void-live-deploy/tower.assistant.json'); fs.writeFileSync(af, JSON.stringify({ ...JSON.parse(fs.readFileSync(af, 'utf8')), last: null, runs: [] })); return root; };
const ctxOf = (root, saved, jobs) => ({ root, site: 'https://x.test', now: Date.UTC(2026, 10, 21, 13, 13), save: (f, t) => { saved[path.basename(f)] = t; }, queueJob: async (a, t) => { jobs.push({ a, t }); return { queued: true }; } });
// an answer per question: the reference for the ones in `good`, a refusal for the rest
const asker = (good) => async (base, askText) => { const q = file.set.find((x) => x.ask === askText); return good.includes(q.id) ? { text: q.reference, status: 'done', tier: 'free', bot: 'verse' } : { text: 'I am a note-search bot. Please provide a note and the word you wish to find.', status: 'done', tier: 'free', bot: 'note-search' }; };

test('the exam is a guard on the 09:00, 13:00 and 19:00 lanes (the fixed twenty only at 13:00)', () => {
  const g = GUARDS.find((x) => x.id === 'assistant'); assert.deepEqual(g.hours, [9, 13, 19]);
  assert.ok(guardsFor(13).some((x) => x.id === 'assistant') && !guardsFor(15).some((x) => x.id === 'assistant'));
});
test('a run with some weak answers logs the score, saves both files, queues the gaps and hands the coder the weakest', async () => {
  const root = mkRoot(), saved = {}, jobs = [], good = file.set.slice(0, 14).map((q) => q.id);
  const r = await run(ctxOf(root, saved, jobs), { heldout: false, ask: asker(good) });
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
  await run(ctxOf(root, saved, jobs), { heldout: false, ask: asker(file.set.slice(0, 10).map((q) => q.id)) });
  fs.writeFileSync(path.join(root, 'void-live-deploy/tower.assistant.json'), saved['tower.assistant.json']); fs.writeFileSync(path.join(root, 'void-live-deploy/tower.universe.json'), saved['tower.universe.json']);
  saved = {}; await run(ctxOf(root, saved, jobs), { heldout: false, ask: asker(file.set.slice(0, 16).map((q) => q.id)) });
  const a = JSON.parse(saved['tower.assistant.json']), u = JSON.parse(saved['tower.universe.json']);
  assert.equal(a.runs.length, 2);
  assert.equal(u.background.filter((b) => b.id === 'top-assistant' && /^q:/.test(b.aspect)).length, 4);
});
test('all twenty right: the line says above the bar and the coder is not asked for anything', async () => {
  const root = mkRoot(), saved = {}, jobs = [];
  const r = await run(ctxOf(root, saved, jobs), { heldout: false, ask: asker(file.set.map((q) => q.id)) });
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
  const load2 = async () => ({ run: (ctx) => run({ ...ctx, root }, { heldout: false, ask: asker(file.set.map((q) => q.id)) }) });
  const out = await runGuards(['assistant'], { dry: true, load: load2, log: (l) => lines.push(l), now: Date.UTC(2026, 10, 21, 13) });
  assert.match(lines.join('\n'), /Assistant exam: Ran\. Scored 100 of 100/); assert.ok(!fs.existsSync(path.join(root, 'void-live-deploy/progress/loops/assistant.json')), 'a dry run writes no log file'); assert.equal(out.length, 1);
});
test('lineOf and askOf say the score and the weakest questions in plain words, never a rival', () => {
  const rows = [scoreOne(file.set[4], 'I am a bot.'), scoreOne(file.set[0], file.set[0].reference)];
  const sum = { overall: 50, right: 50, useful: 50, clear: 50, questions: 2 };
  assert.match(lineOf(sum, 5, 1), /1 question with a gap are on the build list \(5 gaps\)/);
  const a = askOf(file.set, rows, sum); assert.match(a, /^The assistant exam scored 50/); assert.match(a, /virus and a bacterium/); assert.ok(!/Atom/.test(a)); assert.equal(BAR, 94);
});

// ---- the held-out sample and the three-in-a-row bar ----
import { load as loadHeld, STREAK } from './heldout-exam.mjs';
import { heldLineOf } from './guards/assistant.mjs';
const pool = loadHeld();
const heldAsker = (good) => async (base, askText) => { const q = pool.set.find((x) => x.ask === askText); return good(q) ? { text: q.reference, status: 'done', tier: 'free', bot: 'verse' } : { text: 'I am a note-search bot. Please provide a note.', status: 'done', tier: 'free', bot: 'notes' }; };
const judgeWith = (v, r) => async () => ({ answer: { right: v, useful: v, clear: v }, reference: { right: r, useful: r, clear: r }, by: 'gemini' });
const at19 = (root, saved, jobs) => ({ ...ctxOf(root, saved, jobs), now: Date.UTC(2026, 10, 21, 19, 43), env: {} });
const feed = (root, saved) => { for (const f of ['tower.heldout.json', 'tower.universe.json']) if (saved[f]) fs.writeFileSync(path.join(root, 'void-live-deploy', f), saved[f]); };

test('at 19:00 only the held-out sample runs; three winning runs in a row reach the bar and the Tower mark follows', async () => {
  const root = mkRoot(), jobs = []; let last;
  for (let k = 1; k <= STREAK; k++) {
    const saved = {}; last = await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: judgeWith(95, 90) });
    assert.match(last.last, /^Held-out sample of 20 unseen questions: right 100, useful 100, clear 100\. Judge \(gemini, 20 judged blind\): Verse 95 against the reference 90\. Beat the reference\. In a row: \d of 3\.$/); assert.match(last.last, new RegExp('In a row: ' + k + ' of 3'));
    assert.ok(!/Scored/.test(last.last), 'the fixed twenty do not run at 19:00');
    const h = JSON.parse(saved['tower.heldout.json']), u = JSON.parse(saved['tower.universe.json']); assert.equal(h.streak, k);
    assert.equal(u.targets.find((x) => x.id === 'top-assistant').marks.heldout.verse, k >= STREAK ? 100 : 93); feed(root, saved);
  }
  assert.equal(jobs.length, 0, 'a winning run asks the coder for nothing');
});
test('a run that does not beat the reference resets the streak and queues the weak areas, not the questions', async () => {
  const root = mkRoot(), jobs = []; let saved = {};
  await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: judgeWith(95, 90) }); feed(root, saved);
  saved = {}; const r = await run(at19(root, saved, jobs), { ask: heldAsker((q) => q.area !== 'health'), judgeFn: judgeWith(60, 90) });
  assert.match(r.last, /Did not beat the reference\. In a row: 0 of 3\./); assert.match(r.last, /Heal job for the coder \(queued\)/);
  assert.equal(JSON.parse(saved['tower.heldout.json']).streak, 0);
  const u = JSON.parse(saved['tower.universe.json']); assert.ok(u.background.some((b) => b.aspect === 'heldout:health'));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].t, 'heal:heldout-exam'); assert.match(jobs[0].a, /never tuned on/);
  const asked = pool.set.map((q) => q.ask.slice(0, 40)); assert.ok(!asked.some((a) => jobs[0].a.includes(a)) && !JSON.stringify(u.background).includes(pool.set[0].ask.slice(0, 40)), 'no question text goes to the coder');
});
test('when no judge answers the run is not counted: the streak stays and the line says so', async () => {
  const root = mkRoot(), jobs = []; let saved = {};
  await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: judgeWith(95, 90) }); feed(root, saved);
  saved = {}; const r = await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: async () => null });
  assert.match(r.last, /No judge answered[^.]*, so this run is not counted\. In a row: 1 of 3\./); assert.equal(JSON.parse(saved['tower.heldout.json']).streak, 1);
});
test('the questions change run to run, and a run where the agent would not answer writes nothing', async () => {
  const root = mkRoot(), jobs = []; let saved = {};
  await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: judgeWith(95, 90) }); const first = JSON.parse(saved['tower.heldout.json']).last.rows.map((r) => r.id); feed(root, saved);
  saved = {}; await run(at19(root, saved, jobs), { ask: heldAsker(() => true), judgeFn: judgeWith(95, 90) });
  const second = JSON.parse(saved['tower.heldout.json']).last.rows.map((r) => r.id); assert.equal(second.filter((id) => first.includes(id)).length, 0, 'fresh questions first');
  saved = {}; const r = await run(at19(root, saved, jobs), { ask: async () => ({ text: '', status: 'refused: {}', tier: '' }) });
  assert.equal(r.ok, false); assert.deepEqual(saved, {}); assert.match(r.last, /no score/);
});
test('at 13:00 both run, and the Tower file carries the fixed marks and the held-out mark together', async () => {
  const root = mkRoot(), saved = {}, jobs = [], both = async (b, t) => (file.set.find((x) => x.ask === t) ? asker(file.set.map((q) => q.id))(b, t) : heldAsker(() => true)(b, t));
  const r = await run(ctxOf(root, saved, jobs), { ask: both, judgeFn: judgeWith(95, 90) });
  assert.match(r.last, /^Scored 100 of 100 on 20 fixed questions[\s\S]*Held-out sample of 20 unseen questions/);
  const t = JSON.parse(saved['tower.universe.json']).targets.find((x) => x.id === 'top-assistant'); assert.ok(t.marks.right && t.marks.heldout);
});
test('heldLineOf says the streak in plain words', () => {
  const out = { sum: { questions: 20, right: 90, useful: 90, clear: 90 }, verdict: null, beat: null, streak: 2 };
  assert.match(heldLineOf(out), /No judge answered[^.]*, so this run is not counted\. In a row: 2 of 3\.$/);
});
test('the provider probe names who answered through the owner key, and says so plainly when one gives nothing', async () => {
  const { probeLine } = await import('./guards/assistant.mjs');
  const seen = [];
  const line = await probeLine({ site: 'https://a-to-mind.com' }, async (b, q, via) => { seen.push(via); return via === 'groq' ? { text: 'x', by: 'Answered by Groq (llama-3.3-70b-versatile): free, 0 cents.' } : { text: '', status: 'done' }; });
  assert.deepEqual(seen, ['groq', 'gemini']); assert.match(line, /groq answered \(Groq \(llama-3\.3-70b-versatile\)/); assert.match(line, /gemini gave no answer/);
  assert.equal(await probeLine({ site: 'x' }, null), '', 'no key, no probe');
});
