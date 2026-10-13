// node --test tools/route-bench.test.mjs: frontier #9, first piece. Clef-flash (lib/clef.js) beside the embedding router
// (lib/router.js) on the bench's own asks: the question Clef is asked, how its answer is read, the owner-only { route } mode of
// /api/bench, and the scoring and verdict in tools/route-bench.mjs. Nothing switches the live router yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skillQuestion, clefPick, clefRoute, CLEF_MODEL, NONE } from '../void-live-deploy/lib/clef.js';
import { SKILLS, resetRouter } from '../void-live-deploy/lib/router.js';
import { onRequestPost as bench, ROUTE_CHUNK } from '../void-live-deploy/functions/api/bench.js';
import { benchSet, sample, score, verdict, table, runSite, noneSet, CONFIDENT } from './route-bench.mjs';

const KEY = 'k'.repeat(40);
const answer = (choice, probabilities) => ({ model: 'clef-flash', answers: { skill: { choice, probabilities, confidence: probabilities[choice] } } });

test('the question: one choice over every router skill plus none, in the System One shape', () => {
  const q = skillQuestion();
  assert.equal(q.skill.type, 'choice');
  assert.deepEqual(Object.keys(q.skill.criteria).sort(), [...Object.keys(SKILLS), NONE].sort());
  assert.match(q.skill.criteria.timer, /timer/);
  assert.ok(Object.values(q.skill.criteria).every((t) => typeof t === 'string' && t.length > 10));
});

test('Clef\'s answer: the choice and its probability; a missing or unknown answer is a fallback, never a throw', async () => {
  assert.deepEqual(clefPick(answer('timer', { timer: 0.91, clock: 0.05, none: 0.04 })), { skill: 'timer', p: 0.91, confidence: 0.91 });
  assert.equal(clefPick({ answers: { skill: { probabilities: { none: 0.6, calc: 0.4 } } } }).skill, 'none', 'no choice field: the most probable option');
  assert.equal(clefPick({}), null); assert.equal(clefPick(null), null);
  const calls = [];
  const env = (reply) => ({ AI: { run: async (model, input) => { calls.push({ model, input }); if (reply instanceof Error) throw reply; return reply; } } });
  const r = await clefRoute(env(answer('weather', { weather: 0.8, none: 0.2 })), 'will it rain in Oslo');
  assert.deepEqual([r.kind, r.skill, r.p], ['skill', 'weather', 0.8]);
  assert.equal(calls[0].model, CLEF_MODEL); assert.equal(calls[0].input.model, 'clef-flash'); assert.equal(calls[0].input.state, 'will it rain in Oslo');
  assert.ok(calls[0].input.questions.skill.criteria.weather);
  assert.equal((await clefRoute(env(answer('none', { none: 0.9 })), 'why is the sky blue')).kind, NONE);
  assert.equal((await clefRoute(env(answer('teleport', { teleport: 1 })), 'x')).kind, 'fallback', 'an option it was not offered');
  assert.equal((await clefRoute(env(new Error('5007')), 'x')).why, 'model error');
  assert.equal((await clefRoute({}, 'x')).why, 'no model');
});

test('/api/bench { route }: owner only, at most ROUTE_CHUNK short asks, both routers\' picks per ask', async () => {
  resetRouter();
  const calls = [];
  const AI = { run: async (model, input) => {
    calls.push(model);
    if (model === CLEF_MODEL) return /timer/.test(input.state) ? answer('timer', { timer: 0.95, none: 0.05 }) : answer('none', { none: 0.55, timer: 0.45 });
    return { data: input.text.map((t, i) => Array.from({ length: 8 }, (_, d) => ((t.length + i + d) % 7) / 7 + 0.01)) }; // any vectors: only the shape matters here
  } };
  const post = (body, key = KEY) => bench({ request: new Request('https://a-to-mind.com/api/bench', { method: 'POST', headers: key ? { authorization: 'Bearer ' + key } : {}, body: JSON.stringify(body) }), env: { READ_TOKEN: KEY, AI } });
  assert.equal((await post({ route: true, asks: ['set a timer'] }, null)).status, 401);
  for (const asks of [[], Array(ROUTE_CHUNK + 1).fill('a'), ['x'.repeat(301)], [''], [3]]) assert.equal((await post({ route: true, asks })).status, 400, JSON.stringify(asks).slice(0, 40));
  assert.equal(calls.length, 0, 'nothing ran for a refused call');
  const j = await (await post({ route: true, asks: ['set a timer for 5 minutes', 'why is the sky blue'] })).json();
  assert.equal(j.route, true);
  assert.deepEqual(j.results.map((r) => r.i), [0, 1]);
  assert.deepEqual(j.results.map((r) => r.clef.skill), ['timer', null]);
  assert.equal(j.results[0].clef.p, 0.95);
  assert.ok(j.results.every((r) => 'embed' in r && (r.embed.error || 'skill' in r.embed)));
});

test('the bench set: the router\'s skills and "answer" (= none) from tools/bench.json; asks with setup or other skills left out', () => {
  const rows = benchSet([
    { ask: 'weather in paris', want: 'skill:weather' }, { ask: 'set a 5 min timer', want: 'timer' }, { ask: '15% of 80', want: 'calc|answer' },
    { ask: 'who wrote hamlet', want: 'answer' }, { ask: 'play chess', want: 'skill:chess' }, { ask: 'undo that', want: 'undo', before: ['make a clock'] },
    { ask: 'Weather in Paris', want: 'skill:weather' },
  ]);
  assert.deepEqual(rows, [{ ask: 'weather in paris', want: ['weather'] }, { ask: 'set a 5 min timer', want: ['timer'] }, { ask: '15% of 80', want: ['calc', NONE] }, { ask: 'who wrote hamlet', want: [NONE] }]);
  const real = benchSet(JSON.parse(fs.readFileSync(new URL('./bench.json', import.meta.url), 'utf8')));
  assert.ok(real.length > 400, 'the real bench gives hundreds of scorable asks: ' + real.length);
  assert.deepEqual(sample(real, 50), sample(real, 50), 'the same spread every run');
  assert.equal(sample(real, 50).length, 50);
  const spread = sample(real, 60), kinds = new Set(spread.map((r) => r.want[0]));
  assert.ok(kinds.has('timer') && kinds.has('weather') && kinds.has('translate'), 'every skill is in the sample, not only calc');
  assert.ok(spread.filter((r) => r.want[0] === 'calc').length < 20);
});

test('the score and the verdict: Clef takes a skill only where it wins by WIN or more', () => {
  const rows = [...Array(4)].map((_, i) => ({ ask: 't' + i, want: ['timer'] })).concat([{ ask: 'w', want: ['weather'] }, { ask: 'q', want: [NONE] }]);
  const res = [
    { embed: { skill: null, ms: 40 }, clef: { skill: 'timer', p: 0.9, ms: 50 } }, { embed: { skill: null }, clef: { skill: 'timer', p: 0.92 } },
    { embed: { skill: 'timer' }, clef: { skill: 'timer', p: 0.8 } }, { embed: { error: 'timeout' }, clef: { skill: 'clock', p: 0.4 } },
    { embed: { skill: 'weather' }, clef: { skill: null, p: 0.5 } }, { embed: { skill: null }, clef: { error: 'model error' } },
  ];
  const s = score(rows, res);
  assert.deepEqual([s.embed.right, s.clef.right, s.embed.errors, s.clef.errors, s.agree], [3, 3, 1, 1, 1]);
  assert.deepEqual(s.skills.timer, { n: 4, embed: 1, clef: 3 });
  assert.deepEqual([s.sure.n, s.sure.right, s.unsure.n, s.unsure.right], [3, 3, 2, 0]);
  const v = verdict(s);
  assert.deepEqual(v.switchTo, ['timer']); assert.deepEqual(v.keep, ['none', 'weather']);
  const md = table(s, v);
  assert.match(md, /\| Clef-flash \| 3\/6/); assert.match(md, /Verdict:.*Clef wins on timer/); assert.match(md, new RegExp('confidence ' + CONFIDENT));
});

test('the tool asks the site in chunks with the key, and says plainly when it cannot', async () => {
  const seen = [];
  const get = async (url, o) => { const b = JSON.parse(o.body); seen.push({ url, auth: o.headers.authorization, n: b.asks.length }); return new Response(JSON.stringify({ route: true, results: b.asks.map((a, i) => ({ i, embed: { skill: null }, clef: { skill: null, p: 0.9 } })) })); };
  const rows = [...Array(20)].map((_, i) => ({ ask: 'q' + i, want: [NONE] }));
  const res = await runSite('https://a-to-mind.com/', 'key', rows, { get });
  assert.equal(res.length, 20); assert.deepEqual(seen.map((x) => x.n), [16, 4]);
  assert.ok(seen.every((x) => x.url === 'https://a-to-mind.com/api/bench' && x.auth === 'Bearer key'));
  await assert.rejects(runSite('https://x', '', rows, { get }), /READ_TOKEN is empty/);
  await assert.rejects(runSite('https://x', 'k', rows, { get: async () => new Response('{}', { status: 401 }) }), /rejected/);
  await assert.rejects(runSite('https://x', 'k', rows, { get: async () => new Response('{"model":"x"}', { status: 400 }) }), /does not route yet/);
});

test('a full route chunk fits the guard\'s body limit for /api/bench (HTTP 413 on the first run)', async () => {
  const { LIMITS } = await import('../void-live-deploy/lib/guard.js');
  const body = JSON.stringify({ route: true, asks: Array(ROUTE_CHUNK).fill('é'.repeat(300)) });
  assert.ok(new TextEncoder().encode(body).length <= LIMITS.bench.body, 'sixteen 300-character asks of two-byte characters fit');
});

test('every run adds the router\'s own answer-in-words asks as "none": near-misses, simple and hard questions', () => {
  const rows = noneSet();
  assert.ok(rows.length >= 60, 'near-misses + simple + hard: ' + rows.length);
  assert.ok(rows.every((r) => r.want.length === 1 && r.want[0] === NONE && r.examples));
  assert.ok(rows.some((r) => r.ask === 'who invented the clock') && rows.some((r) => r.ask === 'who wrote hamlet'));
  assert.equal(new Set(rows.map((r) => r.ask)).size, rows.length, 'no ask twice');
  const s = score([{ ask: 'who invented the clock', want: [NONE] }, { ask: 'why is the sky blue', want: [NONE] }], [{ embed: { skill: null }, clef: { skill: 'clock', p: 0.6 } }, { embed: { skill: null }, clef: { skill: null, p: 0.9 } }]);
  assert.match(table(s, verdict(s)), /Clef sent 1 of them to a skill/);
});

