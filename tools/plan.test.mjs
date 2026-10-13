// node tools/plan.test.mjs: frontier #10's next step. An explicit plan ask of a kind intent.js has no steps for ("plan my
// garden", "make a plan to learn Spanish") goes to the answer engine (/api/answer mode 'plan'); the model only fills in the
// steps, and the only ask that ever runs is the checklist ("make a list with …"), so nothing else can be called from a reply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parsePlan, cleanGoal, planPrompt, PLAN_SYSTEM, PLAN_MIN, PLAN_MAX, STEP_MAX } from '../void-live-deploy/lib/plan.js';
import skill, { openPlanOf, planOf } from '../void-live-deploy/skills/intent.js';
import * as answerApi from '../void-live-deploy/functions/api/answer.js';

test('the reply becomes 3 to 7 short steps that the list ask keeps whole (no commas, no "and"); anything else is no plan', () => {
  assert.deepEqual(parsePlan('["Pick a sunny spot", "Test the soil, then add compost", "Choose plants and seeds", "Water every morning"]'),
    ['Pick a sunny spot', 'Test the soil then add compost', 'Choose plants + seeds', 'Water every morning']);
  assert.deepEqual(parsePlan('Here you go:\n1. Learn 20 words a day\n2. Do one lesson a day\n- Talk with a tutor weekly\n* Watch a show in Spanish'),
    ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor weekly', 'Watch a show in Spanish']);
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => 'Step number ' + (i + 1)));
  assert.equal(parsePlan(many).length, PLAN_MAX);
  assert.ok(parsePlan(JSON.stringify(['x'.repeat(200), 'b two', 'c three'])).every((s) => s.length <= STEP_MAX));
  assert.equal(parsePlan('["only one", "two"]'), null, 'fewer than ' + PLAN_MIN + ' is no plan');
  assert.equal(parsePlan('I cannot help with that.'), null);
  assert.deepEqual(parsePlan('["Same", "same", "Other", "Third"]'), ['Same', 'Other', 'Third'], 'repeats once');
});

test('the goal is one clean line, and the prompt carries it under the fixed rules', () => {
  assert.equal(cleanGoal('  plan\nmy\u0007 garden  '), 'plan my garden');
  assert.equal(cleanGoal('x'.repeat(300)).length, 80);
  assert.match(PLAN_SYSTEM, /JSON array/); assert.match(PLAN_SYSTEM, /medical, legal or financial/);
  assert.match(planPrompt('learn spanish'), /learn spanish/);
});

test('only an explicit plan ask of a kind with no steps of its own is open; templated kinds, days, health and money stay where they were', () => {
  assert.deepEqual(openPlanOf('plan my garden'), { goal: 'my garden', who: null });
  assert.deepEqual(openPlanOf('make a plan to learn Spanish'), { goal: 'learn spanish', who: null });
  assert.deepEqual(openPlanOf('give me a plan to learn guitar and tell Sam'), { goal: 'learn guitar', who: 'sam' });
  for (const t of ['plan my move', 'make a plan to ship the product page', 'I need to ship the product page by Friday']) assert.equal(openPlanOf(t), null, t + ' has its own steps');
  for (const t of ['plan my day', 'plan my week', 'make a plan to lose weight', 'make a plan to pay off my debt', 'plan my diet', 'meal plan for the week',
    'I need to finish my essay', 'what is a plan', 'make a plan to learn spanish by friday']) assert.equal(openPlanOf(t), null, t);
  assert.equal(skill.match('plan my garden', 'plan my garden'), true);
  assert.equal(skill.match('plan my day', 'plan my day'), false);
  assert.ok(planOf('plan my move'), 'the templated plan is unchanged');
});

test('the skill asks the engine, then runs only the checklist ask with its steps (plus the unsent draft when someone is named)', async () => {
  const asked = [], said = [], sent = [];
  const things = {};
  const stage = { ask: async (a) => { asked.push(a); things['t' + asked.length] = {}; }, things: () => things, render() {}, save() {} };
  const was = globalThis.fetch;
  globalThis.fetch = async (url, o) => { sent.push([url, JSON.parse(o.body)]); return new Response(JSON.stringify({ steps: ['Pick a sunny spot', 'Choose plants + seeds', 'Water every morning'], model: 'gemma' })); };
  try {
    assert.equal(await skill.run('give me a plan to learn guitar and tell Sam', { stage, say: (s) => said.push(s) }), 'intent');
    assert.deepEqual(sent[0], ['/api/answer', { mode: 'plan', goal: 'learn guitar' }]);
    assert.deepEqual(asked, ['make a list with Pick a sunny spot, Choose plants + seeds, Water every morning', 'add a sticky that says draft to Sam (not sent): heads up, I\'m working on: learn guitar']);
    assert.match(said[0], /planned "learn guitar" · checklist, a draft to Sam · one group · nothing sent/);
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: null, note: 'no model' }));
    asked.length = 0; said.length = 0;
    assert.equal(await skill.run('plan my garden', { stage, say: (s) => said.push(s) }), 'intent');
    assert.equal(asked.length, 0, 'no steps: nothing summoned');
    assert.match(said[0], /could not plan "my garden" right now/);
  } finally { globalThis.fetch = was; }
});

const kvDB = () => { const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)'); db.exec('CREATE TABLE void_shortfalls (day TEXT NOT NULL, place TEXT NOT NULL, reason TEXT NOT NULL, n INTEGER NOT NULL, last TEXT NOT NULL, PRIMARY KEY (day, place, reason))');
  const st = (sql, a = []) => ({ bind: (...b) => st(sql, b), first: async (c) => { const r = db.prepare(sql).get(...a) ?? null; return c ? (r ? r[c] : null) : r; }, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a) });
  return { db, prepare: (sql) => st(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) }; };
const post = (env, body) => answerApi.onRequestPost({ env, request: new Request('https://x/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), waitUntil() {} });

test('/api/answer mode plan: the model\'s steps when it answers; none (and why) when models are off or busy; nothing stored', async () => {
  const calls = [];
  const ai = (reply) => ({ run: async (m, o) => { calls.push(o); if (reply instanceof Error) throw reply; return { response: reply }; } });
  const on = { DB: kvDB(), AI: ai('["Pick a sunny spot", "Choose plants and seeds", "Water every morning"]') };
  const r1 = await (await post(on, { mode: 'plan', goal: 'plan my garden with key sk-ant-api03-' + 'a'.repeat(40) })).json();
  assert.equal(r1.model, 'gemma'); assert.deepEqual(r1.steps, ['Pick a sunny spot', 'Choose plants + seeds', 'Water every morning']);
  assert.match(calls[0].messages[0].content, /JSON array/); assert.doesNotMatch(calls[0].messages[1].content, /sk-ant-api03-a{20}/, 'a key never reaches the model');
  assert.equal(on.DB.db.prepare('SELECT COUNT(*) n FROM void_kv').get().n, 0, 'nothing stored');
  const off = await (await post({ DB: kvDB(), AI: ai('x'), VOID_ANSWER_MODELS: 'off' }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(off.steps, null); assert.match(off.note, /no model/);
  const busy = await (await post({ DB: kvDB(), AI: ai(new Error('model busy')) }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(busy.steps, null); assert.match(busy.note, /model busy/);
  const empty = await (await post({ DB: kvDB(), AI: ai('no plan here') }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(empty.steps, null);
  assert.equal((await post(on, { mode: 'plan', goal: 'x' })).status, 400);
});
