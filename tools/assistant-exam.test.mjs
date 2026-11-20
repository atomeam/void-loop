import test from 'node:test';
import assert from 'node:assert/strict';
import { load, problemsOf, scoreOne, correctness, usefulness, clarity, formOk, summarize, gapsOf, jobsOf, marksOf, TARGET } from './assistant-exam.mjs';
import { readChecks, beaten, protectedNames, kindOf } from '../void-live-deploy/lib/universe.js';
import { SEEDS } from '../void-live-deploy/lib/universe-seeds.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';

const file = load(), by = (id) => file.set.find((q) => q.id === id);

test('the set is 20 questions and every reference answer scores 100', () => { assert.deepEqual(problemsOf(file), []); });
test('a dodge scores 0 on correctness and low on usefulness', () => {
  const q = by('binary-search'), t = 'I am a note-search bot. Please provide a note and the word you wish to find.';
  assert.equal(correctness(q, t).score, 0);
  assert.ok(usefulness(q, t).score < 60);
  assert.equal(correctness(q, '').score, 0);
});
test('a right but rambling answer keeps correctness and loses clarity', () => {
  const q = by('percent-chain'), t = '15% of 240 is 36 and 36 + 12 = 48. ' + 'More words that say nothing new. '.repeat(30);
  assert.equal(correctness(q, t).score, 100);
  assert.ok(clarity(q, t).score < 70);
});
test('a task that did not finish is not useful', () => assert.ok(usefulness(by('percent-chain'), '36 then 48', 'needs_yes').score <= 60));
test('clarity: raw JSON, filler and a cut-off ending each cost points', () => {
  const q = by('sky-blue');
  assert.ok(clarity(q, '{"answer": "Air scatters blue light more than red light because blue has a shorter wavelength"}').score <= 60);
  assert.ok(clarity(q, 'Sure! Air molecules scatter the short blue wavelengths of sunlight far more than red ones.').score <= 90);
  assert.ok(clarity(q, 'Air molecules scatter the short blue wavelengths of sunlight far more than the red ones so the').score <= 85);
});
test('form: steps, list, code and number', () => {
  assert.ok(formOk('steps', '1. a\n2. b\n3. c')); assert.ok(!formOk('steps', 'Just cook it.'));
  assert.ok(formOk('list', '- a\n- b\n- c')); assert.ok(formOk('code', 'def f(x):\n    return x')); assert.ok(formOk('number', 'about 22.2'));
});
test('summary and gaps: the means, the worst gap first, one job per question with a gap and no name in it', () => {
  const rows = [scoreOne(by('percent-chain'), '15% of 240 is 36, and 36 plus 12 is 48.'), scoreOne(by('binary-search'), 'I am a note-search bot.')];
  const sum = summarize(rows);
  assert.equal(sum.questions, 2); assert.ok(sum.right > 0 && sum.right < 100);
  const gaps = gapsOf(rows); assert.equal(gaps[0].id, 'binary-search');
  const jobs = jobsOf(file.set, rows, '2026-11-20');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].id, TARGET); assert.equal(jobs[0].aspect, 'q:binary-search'); assert.match(jobs[0].job, /^build: make Verse answer "What is the time complexity/);
  assert.deepEqual(Object.keys(marksOf(sum)), ['right', 'useful', 'clear']);
});
test('the target is on the Tower as an answers target, beaten only when every check beats the bar (the three answer marks plus graphics and 60 fps, like every kind), and its names stay owner-only', () => {
  const seed = SEEDS.find((s) => s.id === TARGET); assert.ok(seed); assert.equal(seed.kind, 'answers'); assert.equal(seed.bar, 94);
  assert.deepEqual(readChecks(seed).map((c) => c.id), ['graphics', 'right', 'useful', 'clear', 'performance']);
  assert.ok(!beaten(seed));
  assert.ok(beaten({ ...seed, marks: { graphics: { verse: 95 }, performance: { verse: 95 }, right: { verse: 95 }, useful: { verse: 95 }, clear: { verse: 95 } } }));
  assert.ok(!beaten({ ...seed, marks: { graphics: { verse: 95 }, performance: { verse: 95 }, right: { verse: 95 }, useful: { verse: 95 }, clear: { verse: 94 } } }));
  assert.equal(kindOf('answers').label, 'Assistant answers');
  assert.ok(protectedNames(SEEDS).includes("Atom's assistant"));
  assert.ok(ownerOnlyPath('/tower.assistant.json'), 'the questions and the answer key are served to the owner only');
});

import { assistantHtml } from '../void-live-deploy/versus/universe.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
test('the owner card box says the score, the bar and the weakest questions, and is empty before a first run', () => {
  assert.equal(assistantHtml({ set: file.set, last: null }, esc), '');
  const rows = [scoreOne(by('binary-search'), 'I am a note-search bot.'), scoreOne(by('percent-chain'), '15% of 240 is 36, and 36 plus 12 is 48.')];
  const html = assistantHtml({ set: file.set, last: { at: '2026-11-20T10:00:00Z', ...summarize(rows), rows } }, esc);
  assert.match(html, /A top AI assistant/); assert.match(html, /more than 94 on each/); assert.match(html, /time complexity of binary search/);
  assert.ok(!/percent/i.test(html), 'a question with no gap is not listed');
});

import { serialize } from './assistant-exam.mjs';
test('the file is written one line per question and per row, and reads back the same', () => {
  const d = { ...file, last: { at: 'x', overall: 1, rows: [{ id: 'a' }, { id: 'b' }] }, runs: [{ at: 'x' }] };
  const s = serialize(d);
  assert.deepEqual(JSON.parse(s), d);
  assert.ok(s.split('\n').length < 80, 'a diff stays small');
});
