// node --test tools/studio-make.test.mjs: the studio writes from the source only, fails closed, and keeps the judge's bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { llm, jsonOf, writerPrompt, draftIssues, judge, AVOID, VOICES } from './studio-make.mjs';
import { JOURNAL, OLD34, PAGE } from './show-judge.mjs';
const res = (status, body, headers = {}) => ({ ok: status < 400, status, headers: { get: (k) => headers[k] }, json: async () => body });
test('the writer reads only the source, asks for real numbers and a call-back, and never a visitor', () => {
  const [sys, user] = writerPrompt('short', { title: 'Old well', text: 'The well is 3,000 years old and 40 m deep.' });
  assert.match(sys.content, /Every fact, name, date and number must come from the SOURCE/);
  assert.match(user.content, /3,000 years old/); assert.match(user.content, /at most 8 words that uses the word "you"/); assert.match(user.content, /"scene"/);
  assert.match(writerPrompt('episode', { title: 'x', text: 'y' }, 'length').at(-1).content, /failed these checks, fix them: length/);
});
test('JSON is read out of a reply with words around it', () => {
  assert.deepEqual(jsonOf('Here: {"a":1} done'), { a: 1 }); assert.equal(jsonOf('no json'), null);
});
test('a short needs a plain you-question hook, a scene per line and the a-to-mind.com close', () => {
  const issues = draftIssues({ lines: [{ who: 'Verse', text: 'Verse explains a long thing here today.' }, { who: 'Critic', text: 'Fine.' }] }, 'short');
  assert.ok(issues.some((i) => /line 1 must be a question/.test(i))); assert.ok(issues.includes('every line needs a scene')); assert.ok(issues.some((i) => /a-to-mind\.com/.test(i)));
});
test('Groq first; a busy minute waits and asks again; no key at all fails closed instead of using a weak model', async () => {
  let calls = 0;
  const f = async (url) => { if (/models$/.test(url)) return res(200, { data: [{ id: 'openai/gpt-oss-120b' }] }); calls++; return calls === 1 ? res(429, {}, { 'retry-after': '0' }) : res(200, { choices: [{ message: { content: 'hi' } }] }); };
  const got = await llm([{ role: 'user', content: 'x' }], { env: { GROQ_API_KEY: 'k' }, fetchImpl: f, prefer: ['openai/gpt-oss-120b'] });
  assert.equal(got.text, 'hi'); assert.equal(got.via, 'Groq openai/gpt-oss-120b'); assert.equal(calls, 2);
  await assert.rejects(llm([{ role: 'user', content: 'x' }], { env: {}, fetchImpl: f }), /no strong model answered/);
});
const groqSaying = (say) => async (url, opt) => url.endsWith('/models') ? res(200, { data: [{ id: 'openai/gpt-oss-120b' }] }) : res(200, { choices: [{ message: { content: say(JSON.parse(opt.body).messages[0].content) } }] });
const show = { lines: [{ who: 'Critic', text: 'Would you drink from a well?' }, { who: 'Verse', text: 'Yes.' }] };
test('the judge fails closed when it cannot tell the bad fixtures from the good one', async () => {
  const v = await judge(show, 'short', { env: { GROQ_API_KEY: 'k' }, fetchImpl: groqSaying(() => 'Score 7'), gap: 0 });
  assert.equal(v.separated, false); assert.equal(v.pass, false); assert.equal(v.blind, undefined);
});
test('a judge that separates still holds the show to 6+ on every blind question, the listener and the hard checks', async () => {
  const bad = [JOURNAL, OLD34, PAGE].map((t) => t.slice(0, 60));
  const v = await judge(show, 'short', { env: { GROQ_API_KEY: 'k' }, fetchImpl: groqSaying((p) => (bad.some((b) => p.includes(b)) ? 'Score 2' : /Human/.test(p) ? 'Human: 8' : 'Score 8')), gap: 0 });
  assert.equal(v.separated, true); assert.equal(v.blind.min, 8); assert.equal(v.human, 8);
  assert.equal(v.pass, false, 'a two-line show fails the hard checks'); assert.ok(v.issues.includes('length'));
});
test('no sad or political story, two clear voices, and the old stub is gone from the Shorts step', () => {
  assert.ok(AVOID.test('the battle of the river') && AVOID.test('he died in 1820') && !AVOID.test('the first public library opened'));
  assert.notEqual(VOICES.Verse.id, VOICES.Critic.id);
  const pipe = readFileSync(new URL('./show-pipe.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(pipe, /console\.log\('The judged Shorts stay/); assert.match(pipe, /tools\/studio-make\.mjs'\), 'short'/);
});
