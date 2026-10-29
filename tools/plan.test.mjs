// node tools/plan.test.mjs: frontier #10's next step. An explicit plan ask of a kind intent.js has no steps for ("plan my
// garden", "make a plan to learn Spanish") goes to the answer engine (/api/answer mode 'plan'); the model only fills in the
// steps, and the only ask that ever runs is the checklist ("make a list with …"), so nothing else can be called from a reply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parsePlan, parseTimer, parseNote, keepTimer, PRACTICE_ASK, LEARN_ASK, LEARN_STEP, withLearnStep, NOTE_MAX, cleanGoal, planPrompt, PLAN_SYSTEM, PLAN_MIN, PLAN_MAX, STEP_MAX } from '../void-live-deploy/lib/plan.js';
import skill, { openPlanOf, planOf, withSteps } from '../void-live-deploy/skills/intent.js';
import * as answerApi from '../void-live-deploy/functions/api/answer.js';
import { clefYesNo, yesNoQuestion, CLEF_MODEL } from '../void-live-deploy/lib/clef.js';

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
    assert.match(said[0], / · say undo to take it all back$/, 'a plan of several things says one undo takes it all back');
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: null, note: 'no model' }));
    asked.length = 0; said.length = 0;
    assert.equal(await skill.run('plan my garden', { stage, say: (s) => said.push(s) }), 'intent');
    assert.equal(asked.length, 1, 'no steps from the engine: the starter plan is put up as one checklist');
    assert.match(asked[0], /^make a list with Write what done looks like for my garden/);
    assert.match(said[0], /a starter plan for "my garden": the answer engine had nothing just now/);
    assert.match(said[1], /planned "my garden"/, 'and it is a real plan, with its undo');
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
  const asked = calls.find((o) => o.messages), clef = calls.find((o) => o.state);
  assert.match(asked.messages[0].content, /JSON array/); assert.doesNotMatch(asked.messages[1].content, /sk-ant-api03-a{20}/, 'a key never reaches the model');
  assert.doesNotMatch(clef.state, /sk-ant-api03-a{20}/, 'nor Clef');
  assert.equal(on.DB.db.prepare('SELECT COUNT(*) n FROM void_kv').get().n, 0, 'nothing stored');
  const off = await (await post({ DB: kvDB(), AI: ai('x'), VOID_ANSWER_MODELS: 'off' }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(off.steps, null); assert.match(off.note, /no model/);
  const busy = await (await post({ DB: kvDB(), AI: ai(new Error('model busy')) }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(busy.steps, null); assert.match(busy.note, /model busy/);
  const empty = await (await post({ DB: kvDB(), AI: ai('no plan here') }, { mode: 'plan', goal: 'plan my garden' })).json();
  assert.equal(empty.steps, null);
  assert.equal((await post(on, { mode: 'plan', goal: 'x' })).status, 400);
});

// the next piece: a dated plan of a kind with no steps of its own ("make a plan to learn Spanish by Friday") got the generic
// "work out the steps, do the main part, check it"; now the engine's steps take their place, dated back from the day
const NOW = new Date(2026, 9, 13, 12); // Tue Oct 13
test('a dated plan marks when its steps are only the generic ones; withSteps puts the engine\'s steps in, dated back from the day', () => {
  const p = planOf('make a plan to learn spanish by friday', NOW);
  assert.equal(p.generic, true); assert.equal(planOf('I need to ship the product page by Friday', NOW).generic, false);
  const q = withSteps(p, ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], NOW);
  assert.deepEqual(q.steps.map((s) => s.text), ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor', 'learn spanish']);
  assert.equal(q.asks.find((a) => a.piece === 'checklist').ask, 'make a list with Learn 20 words a day (tue 13), Do one lesson a day (wed 14), Talk with a tutor (thu 15), learn spanish (fri 16)');
  assert.deepEqual(q.asks.filter((a) => a.piece !== 'checklist'), p.asks.filter((a) => a.piece !== 'checklist'), 'countdown and calendar unchanged');
  assert.equal(q.engine, true); assert.equal(q.generic, false);
});

test('the dated run asks the engine only for a generic plan (not a templated kind, not health or money), and keeps the generic steps when it has none', async () => {
  const runIt = async (text, reply) => {
    const asked = [], said = [], sent = [], things = {};
    const stage = { ask: async (a) => { asked.push(a); things['t' + asked.length] = {}; }, things: () => things, render() {}, save() {} };
    const was = globalThis.fetch;
    globalThis.fetch = async (url, o) => { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify(reply)); };
    try { await skill.run(text, { stage, say: (s) => said.push(s) }); } finally { globalThis.fetch = was; }
    return { asked, said, sent };
  };
  const a = await runIt('make a plan to learn spanish by friday', { steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'] });
  assert.deepEqual(a.sent, [{ mode: 'plan', goal: 'learn spanish' }]);
  assert.match(a.asked.find((x) => x.startsWith('make a list with')), /^make a list with Learn 20 words a day \(\w{3} \d+\), Do one lesson a day/);
  assert.match(a.said[0], /steps from the answer engine/);
  const b = await runIt('make a plan to learn spanish by friday', { steps: null, note: 'no model' });
  assert.match(b.asked.find((x) => x.startsWith('make a list with')), /^make a list with work out the steps/, 'no engine: the generic steps, as before');
  assert.doesNotMatch(b.said[0], /answer engine/);
  assert.equal((await runIt('I need to ship the product page by Friday', { steps: ['x', 'y', 'z'] })).sent.length, 0, 'a templated kind never asks');
  assert.equal((await runIt('I need to lose weight by friday', { steps: ['x', 'y', 'z'] })).sent.length, 0, 'health stays off the engine');
});

// frontier #10's next shape: besides the steps the engine may suggest one practice timer ({"steps": [...], "timer": 20});
// it is a fixed shape, a whole number of minutes from 5 to 60, and the page turns it into its own ask ("set a timer for 20 minutes")
test('the reply may carry one practice timer: whole minutes 5 to 60, else none; steps read the same from either shape', () => {
  const obj = '{"steps": ["Learn 20 words a day", "Do one lesson a day", "Talk with a tutor"], "timer": 20}';
  assert.deepEqual(parsePlan(obj), ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor']);
  assert.equal(parseTimer(obj), 20);
  assert.equal(parseTimer('["a step", "b step", "c step"]'), null, 'no timer in an array');
  for (const bad of [3, 0, 61, 200, -5, '"twenty"', 'null', 12.5]) assert.equal(parseTimer('{"steps": ["a b", "c d", "e f"], "timer": ' + bad + '}'), null, String(bad));
  assert.equal(parseTimer('{"steps": ["a b", "c d", "e f"], "timer": "15"}'), 15);
  assert.equal(parseTimer('not json at all'), null);
  assert.match(PLAN_SYSTEM, /"timer"/);
});

test('/api/answer passes the timer on; the skill adds only the fixed timer ask for it', async () => {
  const ai = { run: async () => ({ response: '{"steps": ["Learn 20 words a day", "Do one lesson a day", "Talk with a tutor"], "timer": 20}' }) };
  const r = await (await post({ DB: kvDB(), AI: ai }, { mode: 'plan', goal: 'learn spanish' })).json();
  assert.equal(r.timer, 20); assert.equal(r.steps.length, 3);
  const asked = [], said = [], things = {};
  const stage = { ask: async (a) => { asked.push(a); things['t' + asked.length] = {}; }, things: () => things, render() {}, save() {} };
  const was = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], timer: 20 }));
  try {
    await skill.run('make a plan to learn spanish', { stage, say: (s) => said.push(s) });
    assert.deepEqual(asked, ['make a list with Learn 20 words a day, Do one lesson a day, Talk with a tutor', 'set a timer for 20 minutes']);
    assert.match(said[0], /checklist, a 20 minute practice timer/);
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], timer: 20, practice: true }));
    said.length = 0;
    await skill.run('make a plan to learn spanish', { stage, say: (s) => said.push(s) });
    assert.match(said[0], /checklist, a daily practice, so a 20 minute timer/, 'the card says the call Clef made');
    assert.doesNotMatch(said[0], /skill to learn/);
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Find a teacher or a course', 'Learn 20 words a day', 'Talk with a friend'], learn: true }));
    for (const ask of ['make a plan to learn spanish', 'make a plan to learn spanish by friday']) {
      said.length = 0;
      await skill.run(ask, { stage, say: (s) => said.push(s) });
      assert.match(said[0], /a skill to learn, so it starts with finding a teacher or a course/, ask);
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], timer: 20 }));
    asked.length = 0; said.length = 0;
    await skill.run('make a plan to learn spanish by friday', { stage, say: (s) => said.push(s) });
    assert.ok(asked.includes('set a timer for 20 minutes'), 'a dated plan takes it too: ' + asked.join(' | '));
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], timer: 999 }));
    asked.length = 0;
    await skill.run('make a plan to learn spanish', { stage, say: () => {} });
    assert.ok(!asked.some((a) => /timer/.test(a)), 'an out-of-range timer never runs');
  } finally { globalThis.fetch = was; }
});

// frontier #10's next step: Clef makes the yes/no call (is this goal a daily practice?) beside the plan, never waited on
// longer than the plan itself; a timer the engine offers is kept unless Clef says no, so a one-off goal never gets one
const clefSays = (choice, p) => ({ answers: { skill: { choice, probabilities: { yes: choice === 'yes' ? p : 1 - p, no: choice === 'no' ? p : 1 - p } } } });
test('a yes/no call through Clef: one choice between yes and no; a failure is no answer, never a guess', async () => {
  const q = yesNoQuestion(PRACTICE_ASK);
  assert.deepEqual(Object.keys(q.skill.criteria), ['yes', 'no']);
  assert.equal(q.skill.type, 'choice'); assert.match(q.skill.instructions, /practi/);
  const calls = [];
  const env = (reply) => ({ AI: { run: async (model, input) => { calls.push({ model, input }); if (reply instanceof Error) throw reply; return reply; } } });
  assert.deepEqual(await clefYesNo(env(clefSays('yes', 0.9)), 'learn spanish', PRACTICE_ASK).then((r) => [r.yes, r.p]), [true, 0.9]);
  assert.equal(calls[0].model, CLEF_MODEL); assert.equal(calls[0].input.state, 'learn spanish');
  assert.deepEqual(await clefYesNo(env(clefSays('no', 0.8)), 'plan my garden', PRACTICE_ASK).then((r) => [r.yes, r.p]), [false, 0.8]);
  for (const bad of [new Error('boom'), { response: 'yes' }, { answers: { skill: { choice: 'maybe' } } }]) assert.equal((await clefYesNo(env(bad), 'x y z', PRACTICE_ASK)).yes, null);
  assert.equal((await clefYesNo({}, 'x y z', PRACTICE_ASK)).yes, null, 'no model');
  assert.equal(keepTimer(20, { yes: false, p: 0.8 }), null);
  for (const v of [{ yes: true, p: 0.9 }, { yes: null }, null, undefined]) assert.equal(keepTimer(20, v), 20, JSON.stringify(v));
  assert.equal(keepTimer(null, { yes: true, p: 0.9 }), null);
});

test('/api/answer drops the timer when Clef says the goal is not a daily practice, keeps it when Clef says yes, fails or is off', async () => {
  const plan = { response: '{"steps": ["Pick a sunny spot", "Choose plants", "Water every morning"], "timer": 20}' };
  const run = (clef, seen = []) => ({ run: async (model, input) => { seen.push(model); if (model === CLEF_MODEL) { if (clef instanceof Error) throw clef; return clef; } return plan; } });
  const timerOf = async (env) => (await (await post({ DB: kvDB(), ...env }, { mode: 'plan', goal: 'plan my garden' })).json()).timer;
  const seen = [];
  assert.equal(await timerOf({ AI: run(clefSays('no', 0.85), seen) }), null, 'a one-off goal gets no timer');
  assert.ok(seen.includes(CLEF_MODEL), 'Clef was asked');
  assert.equal(await timerOf({ AI: run(clefSays('yes', 0.9)) }), 20);
  const said = async (env) => (await (await post({ DB: kvDB(), ...env }, { mode: 'plan', goal: 'learn spanish' })).json()).practice;
  assert.equal(await said({ AI: run(clefSays('yes', 0.9)) }), true, 'the call Clef made goes back with the timer');
  for (const env of [{ AI: run(clefSays('no', 0.9)) }, { AI: run(new Error('down')) }, { AI: run(clefSays('yes', 0.9)), VOID_CLEF: 'off' }]) assert.equal(await said(env), undefined, 'no call made, none said');
  assert.equal(await timerOf({ AI: run(new Error('down')) }), 20, 'Clef down: the engine\'s timer stands');
  const off = [];
  assert.equal(await timerOf({ AI: run(clefSays('no', 0.9), off), VOID_CLEF: 'off' }), 20);
  assert.ok(!off.includes(CLEF_MODEL), 'VOID_CLEF=off never asks Clef');
});

// the second yes/no call: a skill to learn (rather than a project) opens its checklist with finding a teacher or a course,
// unless a step already does; a full plan keeps its own steps; Clef saying no, failing or off changes nothing
test('a skill to learn opens with finding a teacher or a course, once, and only when Clef says yes', async () => {
  const steps = ['Learn 20 words a day', 'Do one lesson a day', 'Watch a show in Spanish'];
  assert.match(LEARN_ASK, /learn/); assert.ok(LEARN_STEP.length <= STEP_MAX);
  assert.deepEqual(withLearnStep(['Practise chords daily', 'Learn one song', 'Play for a friend'], { yes: true, p: 0.9 }), [LEARN_STEP, 'Practise chords daily', 'Learn one song', 'Play for a friend']);
  assert.deepEqual(withLearnStep(steps, { yes: true, p: 0.9 }), steps, 'a lesson step already covers it');
  assert.deepEqual(withLearnStep(['Find a tutor online', 'b step', 'c step'], { yes: true }), ['Find a tutor online', 'b step', 'c step']);
  const full = Array.from({ length: PLAN_MAX }, (_, i) => 'Step number ' + (i + 1));
  assert.deepEqual(withLearnStep(full, { yes: true }), full, 'a full plan stays as it is');
  for (const v of [{ yes: false, p: 0.9 }, { yes: null }, null]) assert.deepEqual(withLearnStep(['a b', 'c d', 'e f'], v), ['a b', 'c d', 'e f']);
  const garden = { response: '["Pick a sunny spot", "Choose plants", "Water every morning"]' };
  const run = (learn) => ({ run: async (model, input) => {
    if (model !== CLEF_MODEL) return garden;
    if (learn instanceof Error) throw learn;
    return /practi[sc]es a little each day/.test(input.questions.skill.instructions) ? clefSays('no', 0.9) : learn;
  } });
  const got = async (env) => (await (await post({ DB: kvDB(), ...env }, { mode: 'plan', goal: 'learn the guitar' })).json());
  const yes = await got({ AI: run(clefSays('yes', 0.9)) });
  assert.deepEqual(yes.steps, [LEARN_STEP, 'Pick a sunny spot', 'Choose plants', 'Water every morning']); assert.equal(yes.learn, true);
  for (const env of [{ AI: run(clefSays('no', 0.9)) }, { AI: run(new Error('down')) }, { AI: run(clefSays('yes', 0.9)), VOID_CLEF: 'off' }]) {
    const r = await got(env); assert.equal(r.steps.length, 3); assert.equal(r.learn, undefined);
  }
});

// Verse's ask (2026-10-13, twice): stickies a plan puts up say what they are, so a note is never taken for an order; the
// note to self and the unsent draft carry a role, and the page shows it as a tab on the paper
test('a plan marks the stickies it puts up: its note to self as a note, a message to someone as an unsent draft', async () => {
  const asked = [], things = {};
  const stage = { ask: async (a) => { asked.push(a); things['t' + asked.length] = { kind: /^add a sticky/.test(a) ? 'sticky' : /^make a list/.test(a) ? 'list' : 'timer' }; }, things: () => things, render() {}, save() {} };
  const was = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], note: 'Little and often beats one long session.' }));
  try {
    await skill.run('give me a plan to learn spanish and tell Sam', { stage, say: () => {} });
    const roles = Object.values(things).map((t) => t.kind + ':' + (t.role || ''));
    assert.deepEqual(roles, ['list:', 'sticky:draft', 'sticky:note'], asked.join(' | '));
  } finally { globalThis.fetch = was; }
});

// the second fixed shape: a short note to self ({"steps": [...], "note": "..."}), one plain line, put up as a sticky
test('the reply may carry one note to self: one clean line of words, cut at a word under NOTE_MAX, else none', () => {
  const r = (note) => '{"steps": ["a b", "c d", "e f"], "note": ' + JSON.stringify(note) + '}';
  assert.equal(parseNote(r('Little and often beats one long session.')), 'Little and often beats one long session.');
  assert.equal(parseNote(r('  two\nlines\u0007 here  ')), 'two lines here');
  const long = parseNote(r('word '.repeat(60)));
  assert.ok(long.length <= NOTE_MAX && !/\s$/.test(long) && /^word( word)*$/.test(long), long);
  for (const bad of [r(''), r('  '), '{"steps": ["a b", "c d", "e f"], "note": 7}', '["a b", "c d", "e f"]', 'no json']) assert.equal(parseNote(bad), null, bad);
  assert.equal(parseNote(r('<b>hi</b> there')), 'hi there', 'no markup');
});

test('/api/answer passes the note on; the skill adds only the sticky ask for it', async () => {
  const ai = { run: async () => ({ response: '{"steps": ["Learn 20 words a day", "Do one lesson a day", "Talk with a tutor"], "note": "Little and often beats one long session."}' }) };
  const r = await (await post({ DB: kvDB(), AI: ai }, { mode: 'plan', goal: 'learn spanish' })).json();
  assert.equal(r.note, 'Little and often beats one long session.');
  const asked = [], said = [], things = {};
  const stage = { ask: async (a) => { asked.push(a); things['t' + asked.length] = {}; }, things: () => things, render() {}, save() {} };
  const was = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], note: 'Little and often beats one long session.' }));
  try {
    await skill.run('make a plan to learn spanish', { stage, say: (s) => said.push(s) });
    assert.deepEqual(asked, ['make a list with Learn 20 words a day, Do one lesson a day, Talk with a tutor', 'add a sticky that says Little and often beats one long session.']);
    assert.match(said[0], /checklist, a note to self/);
    globalThis.fetch = async () => new Response(JSON.stringify({ steps: ['Learn 20 words a day', 'Do one lesson a day', 'Talk with a tutor'], note: 'x'.repeat(500) }));
    asked.length = 0;
    await skill.run('make a plan to learn spanish', { stage, say: () => {} });
    assert.ok(asked.every((a) => a.length < 200), 'a long note is cut, never passed whole');
  } finally { globalThis.fetch = was; }
});

test('the starter plan: general steps for a "learn X" goal and for any other goal, each short enough for a list ask', async () => {
  const { fallbackSteps } = await import('../void-live-deploy/skills/intent.js');
  const a = fallbackSteps('learn guitar'), b = fallbackSteps('my garden');
  assert.equal(a.learn, true); assert.equal(b.learn, false);
  assert.ok(a.steps.length >= 4 && a.steps.every((x) => x.length <= 60 && !/[,;]/.test(x)));
  assert.ok(a.steps[0].includes('guitar') && b.steps[0].includes('my garden'));
  assert.ok(fallbackSteps('').steps.length >= 3, 'an empty goal still gives steps');
});
