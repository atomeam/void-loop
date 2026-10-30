// node --test tools/route-bench.test.mjs: frontier #9, first piece. Clef-flash (lib/clef.js) beside the embedding router
// (lib/router.js) on the bench's own asks: the question Clef is asked, how its answer is read, the owner-only { route } mode of
// /api/bench, and the scoring and verdict in tools/route-bench.mjs. Nothing switches the live router yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skillQuestion, clefPick, clefRoute, mergeRoute, clefOn, CLEF_SKILLS, CLEF_MODEL, NONE } from '../void-live-deploy/lib/clef.js';
import { SKILLS, resetRouter } from '../void-live-deploy/lib/router.js';
import { onRequestPost as bench, ROUTE_CHUNK } from '../void-live-deploy/functions/api/bench.js';
import { benchSet, sample, score, verdict, table, runSite, noneSet, CONFIDENT, noneConfidence, noneTable, NEAR } from './route-bench.mjs';
import { decide, TUNING } from '../void-live-deploy/lib/router.js';

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

test('the switch: Clef decides only the skills it won, only when sure; the embedding guess stays for the rest and as the fallback', () => {
  const embed = { kind: 'simple', score: 0.1, scores: { skill: 0.6 }, ms: 40 };
  assert.deepEqual(CLEF_SKILLS, ['calc', 'place', 'timer', 'translate', 'weather', 'worldtime']);
  const r = mergeRoute(embed, { kind: 'skill', skill: 'timer', p: 0.93 });
  assert.deepEqual([r.kind, r.skill, r.by, r.score], ['skill', 'timer', 'clef', 0.93]);
  assert.equal(r.scores, embed.scores, 'the embedding scores stay in the log');
  assert.equal(mergeRoute(embed, { kind: 'skill', skill: 'clock', p: 0.99 }), embed, 'a skill Clef did not win: the embedding guess');
  const unsure = mergeRoute(embed, { kind: 'skill', skill: 'weather', p: 0.55 });
  assert.equal(unsure.kind, 'simple'); assert.equal(unsure.unsure, 'weather', 'below 0.7: not followed, kept for asking instead');
  const undo = mergeRoute({ kind: 'skill', skill: 'calc', score: 0.72 }, { kind: NONE, skill: null, p: 0.9 });
  assert.deepEqual([undo.kind, undo.by], ['simple', 'clef'], 'sure it is a question: the embedding\'s calc guess is dropped');
  assert.equal(mergeRoute({ kind: 'skill', skill: 'self' }, { kind: NONE, p: 0.95 }).kind, 'skill', 'self stays the embedding router\'s');
  assert.equal(mergeRoute(embed, { kind: 'fallback', why: 'timeout' }), embed);
  assert.equal(mergeRoute(embed, null), embed);
  assert.equal(clefOn({}), true); assert.equal(clefOn({ VOID_CLEF: 'off' }), false);
});

test('/api/answer: Clef never holds the answer; its pick reaches the route log after it', async () => {
  const { onRequestPost: answer } = await import('../void-live-deploy/functions/api/answer.js');
  resetRouter();
  const logged = [], pending = [];
  let releaseClef;
  const clefGate = new Promise((r) => { releaseClef = r; });
  const AI = { run: async (model, input) => {
    if (model === CLEF_MODEL) { await clefGate; return answer_('timer', { timer: 0.94, none: 0.06 }); }
    if (input && input.text) return { data: input.text.map(() => [1, 0, 0, 0]) };
    return { response: 'Five minutes is 300 seconds.' };
  } };
  function answer_(choice, probabilities) { return { answers: { skill: { choice, probabilities } } }; }
  const DB = { prepare: (sql) => ({ bind: (...a) => ({ run: async () => { if (/INSERT INTO void_routes/.test(sql)) logged.push(a); return {}; }, first: async () => null, all: async () => ({ results: [] }) }), run: async () => ({}), first: async () => null }), batch: async () => [] };
  const req = new Request('https://a-to-mind.com/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: 'count down five minutes for my eggs' }) });
  const origFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}', { status: 404 });
  try {
    const res = await answer({ request: req, env: { AI, DB }, waitUntil: (p) => pending.push(p) });
    const j = await res.json();
    assert.match(j.answer || '', /300 seconds/, 'answered while Clef was still out');
    assert.equal(logged.length, 0, 'nothing logged before Clef answered');
    releaseClef(); await Promise.allSettled(pending); await new Promise((r) => setTimeout(r, 20)); await Promise.allSettled(pending);
    const row = logged.at(-1);
    assert.ok(row, 'the route was logged');
    assert.equal(row[2], 'skill'); assert.equal(row[3], 'timer');
    assert.match(row[5], /skill missed: timer \(Clef\)/);
  } finally { globalThis.fetch = origFetch; }
});


test('Verse\'s ask: every none says which skill it came closest to, how close, and what held it back', async () => {
  // three examples on unit axes, so each dot product is the ask's coordinate on that axis
  const ex = [{ kind: 'skill', skill: 'timer' }, { kind: 'skill', skill: 'weather' }, { kind: 'simple' }, { kind: 'hard' }, { kind: 'near' }];
  const axis = (k) => Array.from({ length: 5 }, (_, d) => (d === k ? 1 : 0));
  const vecs = ex.map((_, i) => axis(i));
  const at = (t, w, simple, hard = 0, near = 0) => [t, w, simple, hard, near];
  assert.equal(decide(at(0.9, 0.1, 0.2), ex, vecs, 'set a timer').kind, 'skill', 'a skill pick is unchanged');
  assert.equal(decide(at(0.9, 0.1, 0.2), ex, vecs, 'set a timer').nearest, undefined, 'a skill pick needs no nearest');
  const below = decide(at(0.65, 0.3, 0.4), ex, vecs, 'timer-ish');
  assert.deepEqual([below.kind, below.nearest], ['simple', { skill: 'timer', score: 0.65, bar: TUNING.skillMin, held: 'below-bar' }]);
  assert.equal(decide(at(0.8, 0.1, 0.78), ex, vecs, 'a near question').nearest.held, 'too-close-to-non-skill');
  assert.equal(decide(at(0.9, 0.1, 0.2), ex, vecs, 'compare the timer and the clock and prove which is better step by step').nearest.held, 'hard-signs');
  assert.equal(decide(at(0.2, 0.25, 0.9), ex, vecs, 'who wrote hamlet').nearest.skill, 'weather', 'far from both: still names the nearer');

  // /api/bench { route } passes it on for a none, never for a skill pick
  resetRouter();
  const AI = { run: async (model, input) => model === CLEF_MODEL ? answer('none', { none: 0.9 }) : { data: input.text.map((t, i) => Array.from({ length: 8 }, (_, d) => ((t.length + i + d) % 7) / 7 + 0.01)) } };
  const r = await bench({ request: new Request('https://a-to-mind.com/api/bench', { method: 'POST', headers: { authorization: 'Bearer ' + KEY }, body: JSON.stringify({ route: true, asks: ['why is the sky so very blue today'] }) }), env: { READ_TOKEN: KEY, AI } });
  const e = (await r.json()).results[0].embed;
  if (e.skill) assert.equal(e.nearest, undefined); else assert.ok(e.nearest && typeof e.nearest.skill === 'string' && Number.isFinite(e.nearest.score) && e.nearest.held, JSON.stringify(e));

  // the bench: close or far, missed or right, closest misses first; skill picks and errors are not nones
  const rows = [{ ask: 'timer for pasta', want: ['timer'] }, { ask: 'rain later?', want: ['weather'] }, { ask: 'who wrote hamlet', want: [NONE] }, { ask: 'what time is it', want: [NONE] }, { ask: 'a', want: ['timer'] }, { ask: 'b', want: ['timer'] }, { ask: 'c', want: [NONE] }];
  const n = (skill, score, held = 'below-bar') => ({ embed: { skill: null, nearest: { skill, score, bar: 0.7, held } } });
  const res = [n('timer', 0.66), n('translate', 0.41), n('weather', 0.3), n('clock', 0.68), { embed: { skill: 'timer' } }, { embed: { error: 'timeout' } }, { embed: { skill: null } }];
  const c = noneConfidence(rows, res);
  assert.deepEqual([c.n, c.close, c.far, c.unknown], [5, 2, 2, 1]);
  assert.deepEqual(c.missed, { close: 1, far: 1 }); assert.deepEqual(c.right, { close: 1, far: 1 });
  assert.deepEqual(c.rows.map((x) => x.ask), ['what time is it', 'timer for pasta', 'rain later?', 'who wrote hamlet']);
  assert.equal(c.rows[1].gap, 0.04);
  assert.ok(0.7 - NEAR <= 0.66 && 0.7 - NEAR > 0.41, 'NEAR puts 0.66 close and 0.41 far');
  const md = noneTable(c);
  assert.match(md, /said none 5 times\. 2 came within 0\.1 of the bar to a skill \(close\), 2 were further off/);
  assert.match(md, /\| wrong: the bench wanted a skill \| 1 \(the wording or the bar\) \| 1 \(no example like it\) \|/);
  assert.match(md, /\| timer for pasta \| timer \| timer \| 0\.66 \| 0\.04 \| below-bar \|/);
  assert.ok(md.indexOf('timer for pasta') < md.indexOf('rain later?'), 'closest miss first');
  assert.equal(noneTable(noneConfidence([], [])), '', 'no nones: no section');
  assert.match(noneTable(noneConfidence([{ ask: 'x', want: [NONE] }], [{ embed: { skill: null } }])), /does not send the nearest skill yet/);
});

test('Verse\'s ask: the route log keeps the nearest skill, and readRoutes groups the close nones by the skill they nearly were', async () => {
  const { readRoutes, CLOSE } = await import('../void-live-deploy/lib/router.js');
  const ex = [{ kind: 'skill', skill: 'timer' }, { kind: 'skill', skill: 'weather' }, { kind: 'simple' }, { kind: 'hard' }, { kind: 'near' }];
  const vecs = ex.map((_, i) => Array.from({ length: 5 }, (_, d) => (d === i ? 1 : 0)));
  assert.equal(decide([0.2, 0.66, 0.4, 0, 0], ex, vecs, 'will it pour').scores.nearest, 'weather', 'the logged scores name the skill their `skill` score is for');
  const row = (ask, route, skill, nearest, count = 1) => ({ ask, route, skill: route === 'skill' ? nearest : null, scores: JSON.stringify({ skill, nearest }), count, last: '2026-10-13' });
  const rows = [row('will it pour saturday', 'simple', 0.66, 'weather', 3), row('who wrote hamlet', 'simple', 0.31, 'weather'), row('timer please', 'skill', 0.9, 'timer'),
    row('compare two timers', 'hard', 0.62, 'timer'), row('old row', 'simple', 0.69, null), { ask: 'no scores', route: 'simple', scores: null, count: 1 }];
  const DB = { prepare: (q) => ({ run: async () => ({}), bind: () => ({ all: async () => ({ results: /FROM void_routes/.test(q) ? rows : [] }) }) }), batch: async () => [] };
  const r = await readRoutes({ DB });
  assert.deepEqual(r.close, { weather: [{ ask: 'will it pour saturday', count: 3, score: 0.66 }], timer: [{ ask: 'compare two timers', count: 1, score: 0.62 }] });
  assert.ok(0.7 - CLOSE <= 0.62 && 0.7 - CLOSE > 0.31, 'CLOSE puts 0.62 in and 0.31 out');
});

test('the will proposes teaching the skill a close none nearly was, unless that skill already answers it', async () => {
  const { spawnSync } = await import('node:child_process'); const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const f = join(mkdtempSync(join(tmpdir(), 'routes-')), 'routes.json');
  writeFileSync(f, JSON.stringify({ total: 4, fallback: 0, skills: {}, close: { weather: [{ ask: 'is it going to pour on my picnic saturday', count: 3, score: 0.66 }], timer: [{ ask: 'set a timer for 5 minutes', count: 1, score: 0.65 }] } }));
  const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [new URL('./will.py', import.meta.url).pathname, '--candidates', '--all'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, VOID_ROUTES_FILE: f, VOID_MISSES_TOKEN: '', VOID_OWNER_TOKEN: '' } });
  const c = JSON.parse(py.stdout || '[]').filter((x) => x.source === 'router near miss');
  assert.deepEqual(c.map((x) => x.title), ['teach my weather skill "is it going to pour on my picnic saturday"'], 'the timer ask is one the timer skill already answers (tools/covered.mjs)');
  assert.match(c[0].why, /came within 0\.04 of my weather skill .* \(asked 3 times\)/);
});

// owner, 2026-10-30 ("What I want to become" card): the top want was "teach my self skill" for a note about Verse's own card, asked
// 4 times, which the question path answers on purpose as Verse (lib/self-context.js isOwnCardNote). These are the 4 asks as the
// router logged them (lower case, cut at 200): none may come back as a near-miss want. A real wording a skill missed still does.
const SELF_NOTE = 'this card is the first one that speaks as itself and refuses a false claim. some parts are still off, and i sent them to the ⏎ gemma answer';
test('a note about my own card is no near miss of the self skill (the 4 asks of 2026-10-30)', async () => {
  const { spawnSync } = await import('node:child_process'); const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const asks = [SELF_NOTE, 'that card is wrong. it cites a source that says nothing about my question and calls itself fetched, sourced and dated.',
    'closer, but it still says "the card" about its own card, and it gives no list of what is fixed and what is still open.',
    'your last answer card leaves out pr #1406 and dates the gemma switch oct 25'];
  const covered = JSON.parse(spawnSync('node', [new URL('./covered.mjs', import.meta.url).pathname], { input: JSON.stringify([...asks, 'what is artificial intelligence', 'my credit card was charged twice, is that wrong']), encoding: 'utf8', timeout: 60000 }).stdout);
  assert.deepEqual(covered, [true, true, true, true, false, false], 'card notes are handled; a plain question and a bank card are not');
  const f = join(mkdtempSync(join(tmpdir(), 'routes-')), 'routes.json');
  writeFileSync(f, JSON.stringify({ total: 8, fallback: 0, skills: {}, close: { self: asks.map((ask) => ({ ask, count: 4, score: 0.62 })), weather: [{ ask: 'is it going to pour on my picnic saturday', count: 3, score: 0.66 }] } }));
  const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [new URL('./will.py', import.meta.url).pathname, '--candidates', '--all'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, VOID_ROUTES_FILE: f, VOID_MISSES_TOKEN: '', VOID_OWNER_TOKEN: '' } });
  const c = JSON.parse(py.stdout || '[]').filter((x) => x.source === 'router near miss');
  assert.deepEqual(c.map((x) => x.title), ['teach my weather skill "is it going to pour on my picnic saturday"']);
});
