import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tierFor, needsYes, pickBot, brief, inboxOf, decisionOf } from '../void-live-deploy/lib/agent-core.js';
test('tier is free until a realized month is in the pot', () => { assert.equal(tierFor(0).name, 'free'); assert.equal(tierFor(499).name, 'free'); assert.equal(tierFor(500).name, 'strong'); });
test('sends, pays and deletes wait for a yes', () => { assert.ok(needsYes('send an email to Bob')); assert.ok(needsYes('pay the bill')); assert.ok(!needsYes('plan a trip to Savannah')); });
// the verb as an order waits for a yes; the same word as a noun, a how-to question or a draft does not (2026-11-04: "encode the text hello
// world in base64" sat on needs_yes because "text" was in it)
test('an order to send, pay, book or delete waits; the same word as a noun does not', () => {
  for (const a of ['Text my mom that I am late', 'Book a table for two at 7', 'Can you email Sarah the notes?', 'Please post this on X', 'Order a large pizza',
    'delete my account', 'Cancel my Netflix subscription', 'I need to send a message to my landlord', 'email bob@example.com the plan', 'Buy 3 shares of Apple',
    'Transfer $50 to Jim', 'Sign me up for the newsletter', 'Reply to her email', 'dm @alex about tomorrow', 'Remove all the photos from my Google Drive']) assert.ok(needsYes(a), a);
  for (const a of ['Encode the text hello world in base64', 'Book recommendations for summer', 'Sort these numbers in ascending order', 'What is the order of operations?',
    'Remove duplicates from this list', 'How do I send a fax?', 'Write an email to my boss asking for Friday off', 'Summarize this text', 'Text message ideas for a birthday',
    'Sign language basics', 'best way to book a cheap flight', 'Remove the spaces from this text', 'Email etiquette tips']) assert.ok(!needsYes(a), a);
});
test('picks the matching bot', () => { assert.equal(pickBot('convert 5 miles to km', [{ name: 'calculate', description: 'unit conversion', examples: ['5 miles in km'] }, { name: 'page', description: 'topics' }]).name, 'calculate'); assert.equal(pickBot('zzz', []).name, 'verse'); });
test('one coincidental word is not a match: Verse answers itself', () => {
  const reg = [{ id: 'keyword-finder', cat: 'writing', job: 'Top three key words in a text', status: 'live' }, { id: 'word-counter', cat: 'writing', job: 'Counts words', status: 'live' }];
  assert.equal(pickBot('List three free things to do in Savannah, Georgia.', reg).name, 'verse');
  assert.equal(pickBot('plan a weekend trip to Savannah with a museum', reg).name, 'verse');
  assert.equal(pickBot('find the key words in this text', reg).name, 'keyword-finder');
  assert.equal(pickBot('count the words', reg).name, 'word-counter');
});
test('brief counts the last day', () => { const now = 1e12; const b = brief([{ status: 'done', created: now - 1 }, { status: 'needs_yes', created: now - 1 }, { status: 'done', created: now - 9e7 }], now); assert.equal(b.made, 1); assert.equal(b.waiting, 1); });
test('the inbox is what finished or waits until the member has seen it', () => {
  const tasks = [
    { id: 'a', status: 'done', ask: 'base64 verse inbox', seen: 0, done: 3 },
    { id: 'b', status: 'needs_yes', ask: 'email Bob the plan', seen: 0, created: 2 },
    { id: 'c', status: 'done', ask: 'already read', seen: 1, done: 4 },
    { id: 'd', status: 'declined', ask: 'stopped', seen: 0, done: 5 },
    { id: 'e', status: 'running', ask: 'still going', seen: 0, created: 6 },
  ];
  const inbox = inboxOf(tasks);
  assert.deepEqual(inbox.map((i) => i.id), ['a', 'b']);
  assert.equal(inbox[0].title, 'Verse finished a task');
  assert.match(inbox[1].body, /email Bob the plan/);
  assert.equal(inbox[1].title, 'Verse needs your yes');
});
test('a yes resumes onto the shelf and a no stops, and neither sends', () => {
  const waiting = { status: 'needs_yes', result: 'Mom, dinner is at 6.' };
  const yes = decisionOf('yes', waiting);
  assert.equal(yes.ok, true); assert.equal(yes.status, 'done'); assert.equal(yes.seen, 0);
  assert.match(yes.line, /Resumed/); assert.match(yes.line, /nothing was sent/i);
  const no = decisionOf('no', waiting);
  assert.equal(no.status, 'declined'); assert.equal(no.seen, 1); assert.match(no.line, /Stopped/);
  assert.equal(decisionOf('yes', { status: 'done' }).ok, false);
  assert.equal(decisionOf('later', waiting).say, 'yes or no');
  assert.ok(needsYes('Send an email to my mom saying dinner is at 6.'));
});
test('reads the bot factory registry', () => { assert.equal(pickBot('count the words in this', [{ id: 'word-counter', cat: 'writing', job: 'Counts words', status: 'live' }, { id: 'x', job: 'words words', status: 'failed' }]).name, 'word-counter'); });

// functions/api/agent.js run(): thinking is off, an empty first reply goes to the second free model, and a dead pair fails with its reason
import { run as runAgent, textOf, onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/agent.js';
function fakeEnv(replies) {
  const rows = new Map(), calls = [], short = [];
  const DB = { prepare: (sql) => ({ bind: (...v) => ({
    first: async () => (/^SELECT steps/.test(sql) ? rows.get(v[0]) || { steps: '[]' } : null),
    run: async () => {
      if (/^UPDATE void_agent_tasks/.test(sql)) { const id = v[v.length - 1], cols = sql.slice(28, sql.indexOf(' WHERE')).split(', ').map((c) => c.split(' = ')[0]); const r = { ...(rows.get(id) || {}) }; cols.forEach((c, i) => { r[c] = v[i]; }); rows.set(id, r); }
      if (/shortfall/i.test(sql)) short.push(v);
      return {};
    } }), run: async () => ({}) }) };
  const AI = { run: async (model, o) => { calls.push({ model, o }); const r = replies.shift(); if (r instanceof Error) throw r; return r; } };
  return { env: { DB, AI }, rows, calls };
}
test('the agent answers with thinking off, and an empty reply asks the second free model', async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { env, rows, calls } = fakeEnv([{ choices: [{ message: { content: null, reasoning_content: 'hmm' } }] }, { response: 'Forsyth Park, the riverfront walk and Bonaventure Cemetery are all free to visit.' }]);
    env.ASSETS = { fetch: async () => new Response(JSON.stringify({ bots: [{ name: 'trip-planner', description: 'plans trips' }] })) };
    await runAgent(env, 'https://example.test', 't1', 'List three free things to do in Savannah, Georgia.');
    assert.equal(calls.length, 2);
    for (const c of calls) assert.deepEqual(c.o.chat_template_kwargs, { enable_thinking: false });
    assert.notEqual(calls[0].model, calls[1].model);
    assert.equal(rows.get('t1').status, 'done');
    assert.match(rows.get('t1').result, /Forsyth Park/);
    const { env: env2, rows: rows2 } = fakeEnv([new Error('3040: capacity'), new Error('3040: capacity')]);
    env2.ASSETS = env.ASSETS;
    await runAgent(env2, 'https://example.test', 't2', 'List three free things to do in Savannah, Georgia.');
    assert.equal(rows2.get('t2').status, 'failed');
    assert.ok(JSON.parse(rows2.get('t2').steps).some((s) => /did not answer \(busy\)/.test(s.line)), 'the step says why the first model failed');
  } finally { globalThis.fetch = realFetch; }
});
test('an exact bot ask is answered without the model and lands unseen, so a closed tab can hear it', async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { env, rows, calls } = fakeEnv([]);
    env.ASSETS = { fetch: async () => new Response('{}') };
    await runAgent(env, 'https://example.test', 't3', 'base64 verse inbox');
    assert.equal(calls.length, 0);
    assert.equal(rows.get('t3').status, 'done');
    assert.equal(rows.get('t3').seen, 0);
    assert.match(rows.get('t3').result, /dmVyc2UgaW5ib3g=/);
    assert.match(rows.get('t3').steps, /answer pipeline/);
  } finally { globalThis.fetch = realFetch; }
});
test('textOf reads both reply shapes and drops a thinking block', () => {
  assert.equal(textOf({ response: ' hi ' }), 'hi');
  assert.equal(textOf({ choices: [{ message: { content: '<think>x</think>ok' } }] }), 'ok');
  assert.equal(textOf(null), '');
});

// the route: approve resumes, decline stops, the inbox survives a second read, and one task reopens with its steps
function routeDb(seed) {
  const rows = new Map(seed.map((r) => [r.id, { ...r }]));
  const prepare = (sql) => {
    const api = (v) => ({
      run: async () => {
        if (/^CREATE |^ALTER /.test(sql)) return {};
        if (/^UPDATE void_agent_tasks SET seen = 1 WHERE thread = \? AND id IN \(/.test(sql)) {
          for (const id of v.slice(1)) { const r = rows.get(id); if (r && r.thread === v[0]) r.seen = 1; }
          return {};
        }
        if (/^UPDATE void_agent_tasks SET /.test(sql)) {
          const id = v[v.length - 1], r = { ...(rows.get(id) || { id }) };
          sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE')).split(', ').map((c) => c.split(' = ')[0]).forEach((c, i) => { r[c] = v[i]; });
          rows.set(id, r);
          return {};
        }
        return {};
      },
      first: async () => {
        if (/^SELECT steps FROM/.test(sql)) { const r = rows.get(v[0]); return r ? { steps: r.steps } : { steps: '[]' }; }
        if (/^SELECT status, result FROM/.test(sql)) { const r = rows.get(v[0]); return r && r.thread === v[1] ? r : null; }
        return null;
      },
      all: async () => (/SELECT id, ask, status/.test(sql) ? { results: [...rows.values()].filter((r) => r.thread === v[0]) } : { results: [] }),
    });
    return { ...api([]), bind: (...v) => api(v) };
  };
  return { prepare, rows };
}
const req = (method, url, body) => new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
test('approve resumes onto the shelf, decline stops, the inbox stays until seen, and a task reopens', async () => {
  const thread = 'probeaaaaaaaaaaaa';
  const yesId = 'abc123abc123abc123ab', noId = 'def456def456def456de';
  const draft = 'Mom, dinner is at 6.';
  const row = (id, ask) => ({ id, thread, ask, status: 'needs_yes', bot: 'verse', tier: 'free', steps: JSON.stringify([{ at: 1, line: 'This one sends, pays or deletes something, so it waits for your yes.' }]), result: draft, created: 10, done: null, seen: 0 });
  const env = { DB: routeDb([row(yesId, 'Send an email to my mom saying dinner is at 6.'), row(noId, 'Pay the electric bill')]), AI: {} };
  const read = async (q) => await (await onRequestGet({ request: req('GET', 'https://x/api/agent?thread=' + thread + (q || '')), env })).json();
  let j = await read();
  assert.equal(j.ok, true);
  assert.deepEqual(j.inbox.map((i) => i.id).sort(), [noId, yesId].sort());
  const yes = await (await onRequestPost({ request: req('POST', 'https://x/api/agent', { thread, id: yesId, decision: 'yes' }), env, waitUntil() {} })).json();
  assert.equal(yes.ok, true); assert.equal(yes.status, 'done');
  j = await read();
  const resumed = j.tasks.find((t) => t.id === yesId);
  assert.equal(resumed.status, 'done');
  assert.equal(resumed.result, draft);
  assert.match(resumed.steps.map((s) => s.line).join('\n'), /Resumed/);
  assert.match(resumed.steps.map((s) => s.line).join('\n'), /nothing was sent/i);
  assert.equal(j.made.length, 1);
  assert.ok(j.inbox.some((i) => i.id === yesId && i.status === 'done'));
  const opened = await read('&task=' + yesId);
  assert.equal(opened.task.id, yesId);
  assert.ok(opened.task.steps.some((s) => /Made shelf/.test(s.line)));
  const no = await (await onRequestPost({ request: req('POST', 'https://x/api/agent', { thread, id: noId, decision: 'no' }), env, waitUntil() {} })).json();
  assert.equal(no.status, 'declined');
  j = await read();
  assert.equal(j.tasks.find((t) => t.id === noId).status, 'declined');
  assert.ok(!j.inbox.some((i) => i.id === noId));
  const seen = await (await onRequestPost({ request: req('POST', 'https://x/api/agent', { thread, seen: [yesId] }), env, waitUntil() {} })).json();
  assert.equal(seen.ok, true);
  j = await read();
  assert.ok(!j.inbox.some((i) => i.id === yesId));
  const again = await read();
  assert.ok(!again.inbox.some((i) => i.id === yesId), 'a second read, as a reopened tab, stays clear once it was seen');
});
