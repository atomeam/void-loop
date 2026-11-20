// node --test tools/studio-make.test.mjs: the studio writes from the source only, fails closed, and keeps the judge's bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { llm, groqModels, judgeFeedback, baitIssues, CLICKBAIT, STUDIO_FIXTURES, GOOD_STORY, jsonOf, writerPrompt, draftIssues, judge, AVOID, VOICES } from './studio-make.mjs';
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
test('a retired model is skipped for one Groq still serves; thinking that eats the room gets more room, not a fail', async () => {
  assert.deepEqual(groqModels(['gone/model', 'openai/gpt-oss-120b'], new Set(['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-guard-4', 'whisper-large-v3'])), ['openai/gpt-oss-120b', 'qwen/qwen3-32b']);
  assert.deepEqual(groqModels(['a'], null), ['a']);
  const rooms = [];
  const f = async (url, opt) => { if (/models$/.test(url)) return res(200, { data: [{ id: 'openai/gpt-oss-120b' }] }); rooms.push(JSON.parse(opt.body).max_completion_tokens); return res(200, { choices: [{ message: { content: rooms.length === 1 ? '' : '3' }, finish_reason: rooms.length === 1 ? 'length' : 'stop' }] }); };
  const got = await llm([{ role: 'user', content: 'x' }], { max: 400, temperature: 0, env: { GROQ_API_KEY: 'k' }, fetchImpl: f, prefer: ['openai/gpt-oss-120b'] });
  assert.equal(got.text, '3'); assert.equal(rooms.length, 2); assert.ok(rooms[1] > rooms[0] && rooms[0] > 400);
});
const groqSaying = (say) => async (url, opt) => url.endsWith('/models') ? res(200, { data: [{ id: 'openai/gpt-oss-120b' }] }) : res(200, { choices: [{ message: { content: say(JSON.parse(opt.body).messages[0].content) } }] });
const show = { lines: [{ who: 'Critic', text: 'Would you drink from a well?' }, { who: 'Verse', text: 'Yes.' }] };
test('the judge fails closed when it cannot tell the bad fixtures from the good one', async () => {
  const v = await judge(show, 'short', { env: { GROQ_API_KEY: 'k' }, fetchImpl: groqSaying(() => 'Score 7'), gap: 0 });
  assert.equal(v.separated, false); assert.equal(v.pass, false); assert.equal(v.blind, undefined);
});
test('the studio ruler keeps the same three bad shows and swaps only the good one for a true-story show', async () => {
  assert.deepEqual(STUDIO_FIXTURES.filter((f) => f.kind === 'bad').map((f) => f.text), [JOURNAL, OLD34, PAGE, CLICKBAIT]);
  assert.deepEqual(STUDIO_FIXTURES.filter((f) => f.kind === 'good').map((f) => f.text), [GOOD_STORY]);
  const seen = [];
  await judge(show, 'short', { env: { GROQ_API_KEY: 'k' }, fetchImpl: groqSaying((p) => { seen.push(p); return 'Score 2'; }), gap: 0 });
  assert.ok(seen.some((p) => p.includes('72 seconds')), 'the good ruler is the true story');
});
test('the judge asks the thinking model to think hard', async () => {
  const efforts = [];
  const f = async (url, opt) => { if (/models$/.test(url)) return res(200, { data: [{ id: 'openai/gpt-oss-120b' }] }); efforts.push(JSON.parse(opt.body).reasoning_effort); return res(200, { choices: [{ message: { content: 'Score 2' } }] }); };
  await judge(show, 'short', { env: { GROQ_API_KEY: 'k' }, fetchImpl: f, gap: 0 });
  assert.ok(efforts.length >= 12 && efforts.every((e) => e === 'high'));
});
test('the judge refuses the breaking-news template and a show that ends on an encyclopedia line', () => {
  const lines = CLICKBAIT.split(/ (?=(?:Critic|Verse): )/).map((x) => ({ who: x.split(':')[0], text: x.slice(x.indexOf(':') + 2) }));
  assert.equal(lines.length, 6);
  assert.ok(baitIssues({ lines }).some((i) => /clickbait/.test(i)));
  const fact = [{ who: 'Critic', text: 'So what happened next?' }, { who: 'Verse', text: 'Scene is a 2026 Indian Tamil-language action thriller film.' }];
  assert.deepEqual(baitIssues({ lines: fact }), ['ends on an encyclopedia line, not a payoff']);
  const good = [{ who: 'Critic', text: 'So the aliens hung up on us?' }, { who: 'Verse', text: 'And he wrote Wow in the margin.' }];
  assert.deepEqual(baitIssues({ lines: good }), []);
  assert.ok(STUDIO_FIXTURES.some((f) => f.id === 'clickbait' && f.kind === 'bad'));
});
test('the judge\'s notes become the next draft\'s brief, lowest score first; the bar is the same', () => {
  const f = judgeFeedback({ blind: { scores: [5, 3, 10], notes: ['ok', 'no joke', 'good'] }, human: 7, issues: [] });
  assert.match(f, /a joke with a setup and a payoff 3\/10/); assert.match(f, /fixing "a joke with a setup and a payoff" first/); assert.match(f, /6 or more needed/);
});
test('a judge that separates still holds the show to 6+ on every blind question, the listener and the hard checks', async () => {
  const bad = [JOURNAL, OLD34, PAGE, CLICKBAIT].map((t) => t.slice(0, 60));
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
