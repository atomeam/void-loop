// The blind pairwise judge (tools/answer-judge.mjs). Run: node --test tools/answer-judge.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgePrompt, readJudge, judge, compare } from './answer-judge.mjs';

const marks = (a, b) => JSON.stringify({ A: { right: a, useful: a, clear: a }, B: { right: b, useful: b, clear: b } });
test('the prompt shows the question and both answers as A and B, never saying which is which', () => {
  const p = judgePrompt('Why is the sky blue?', 'ANSWER-TEXT', 'REFERENCE-TEXT');
  assert.match(p, /Question: Why is the sky blue\?/); assert.match(p, /Answer A:\nANSWER-TEXT/); assert.match(p, /Answer B:\nREFERENCE-TEXT/);
  assert.ok(!/verse|reference|ours|candidate/i.test(p.replace(/REFERENCE-TEXT/g, '')));
});
test('a reply is read when it is the JSON asked for (even with words around it) and refused when it is not', () => {
  assert.deepEqual(readJudge('Here: ' + marks(90, 70)).A, { right: 90, useful: 90, clear: 90 });
  for (const bad of ['', 'no json', '{"A":{"right":90}}', '{"A":{"right":900,"useful":1,"clear":1},"B":{"right":1,"useful":1,"clear":1}}', '{"A":1,"B":2}']) assert.equal(readJudge(bad), null, bad);
});
test('the order is shuffled and the marks go back to the right side either way', async () => {
  const seen = [];
  const fetchFn = async (url, o) => { const t = JSON.parse(o.body).contents[0].parts[0].text; seen.push(t.indexOf('MINE') < t.indexOf('REF') ? 'answer first' : 'reference first'); const first = t.indexOf('MINE') < t.indexOf('REF'); return { json: async () => ({ candidates: [{ content: { parts: [{ text: first ? marks(95, 60) : marks(60, 95) }] } }] }) }; };
  for (const r of [0.1, 0.9]) { const j = await judge('q?', 'MINE', 'REF', { GEMINI_API_KEY: 'x' }, fetchFn, () => r); assert.equal(j.answer.right, 95); assert.equal(j.reference.right, 60); assert.equal(j.by, 'gemini'); }
  assert.deepEqual(seen.sort(), ['answer first', 'reference first']);
});
test('Gemini first, then Workers AI; no key, a failed call or an unreadable reply is unjudged and never a pass', async () => {
  assert.equal(await judge('q', 'a', 'b', {}, async () => { throw new Error('no network'); }), null);
  const bad = async () => ({ json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }) });
  assert.equal(await judge('q', 'a', 'b', { GEMINI_API_KEY: 'x' }, bad), null);
  const calls = [];
  const both = async (url) => { calls.push(String(url).includes('generativelanguage') ? 'gemini' : 'cf'); return String(url).includes('generativelanguage') ? bad() : { json: async () => ({ result: { response: marks(80, 70) } }) }; };
  const j = await judge('q', 'a', 'b', { GEMINI_API_KEY: 'x', CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'acct' }, both, () => 0.9);
  assert.deepEqual(calls, ['gemini', 'cf']); assert.equal(j.by, 'workers-ai'); assert.equal(j.answer.right, 80);
});
test('Verse beats the reference when its judged overall is at least equal and no mark is more than 5 behind', () => {
  const j = (a, b) => ({ answer: { right: a, useful: a, clear: a }, reference: { right: b, useful: b, clear: b }, by: 'gemini' });
  assert.equal(compare([j(90, 85), j(88, 88), null]).beats, true);
  assert.equal(compare([j(80, 90), j(85, 90)]).beats, false);
  assert.equal(compare([null, null]), null);
  const lop = compare([{ answer: { right: 100, useful: 100, clear: 70 }, reference: { right: 90, useful: 90, clear: 90 }, by: 'gemini' }]);
  assert.equal(lop.answer.overall >= lop.reference.overall, true); assert.equal(lop.beats, false, 'one mark far behind is not a win');
  assert.equal(compare([j(90, 85)]).judged, 1);
});
import { judgeWhy, whyLine } from './answer-judge.mjs';
test('when no judge answers, the reason for each (a status, no key, unreadable) is kept for the log line and never holds a key', async () => {
  for (const k of Object.keys(judgeWhy)) delete judgeWhy[k];
  const res = (ok, status, body) => async () => ({ ok, status, json: async () => body });
  await judge('q', 'a', 'b', { GEMINI_API_KEY: 'SECRET-KEY', CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'acct' }, async (url) => (String(url).includes('generativelanguage') ? res(false, 429, {})() : res(false, 403, {})()), () => 0.9);
  assert.equal(whyLine(), 'gemini HTTP 429, workers-ai HTTP 403'); assert.ok(!whyLine().includes('SECRET'));
  await judge('q', 'a', 'b', {}, async () => { throw new Error('x'); }); assert.equal(whyLine(), 'gemini no key, workers-ai no key');
  await judge('q', 'a', 'b', { GEMINI_API_KEY: 'k' }, async () => { throw new Error('boom'); }); assert.match(whyLine(), /gemini Error/);
  await judge('q', 'a', 'b', { GEMINI_API_KEY: 'k' }, res(true, 200, { candidates: [{ content: { parts: [{ text: marks(80, 70) }] } }] }), () => 0.9); assert.ok(!/gemini (HTTP|Error|answer)/.test(whyLine()), 'a success clears the reason');
});
