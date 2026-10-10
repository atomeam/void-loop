// The execution record (void-live-deploy/lib/actions.js, frontier build order step 2): every action Void takes, or
// stubs, has one record with its owner, state, and result or error; nothing is done without its record.
// Run: node --test tools/actions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as R from '../void-live-deploy/lib/actions.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import * as api from '../void-live-deploy/functions/api/actions.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1({ failInsert = false } = {}) {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { if (failInsert && /^INSERT INTO void_actions/.test(sql)) throw new Error('D1 is down'); const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const rows = (env) => env.DB.raw.prepare('SELECT * FROM void_actions ORDER BY started').all();

test('a record begins running and ends once, in one of three end states, each saying what happened', () => {
  const r = R.begin({ owner: 'owner', kind: 'automation.note', ref: 'rule-1 manual' });
  assert.equal(r.state, 'running'); assert.deepEqual(R.problems(r), []);
  const done = R.settle(r, 'done', 'wrote a note');
  assert.deepEqual(R.problems(done), []); assert.equal(done.result, 'wrote a note'); assert.ok(done.finished);
  const failed = R.settle(r, 'failed', 'GitHub said 403');
  assert.deepEqual(R.problems(failed), []); assert.equal(failed.error, 'GitHub said 403'); assert.equal(failed.result, null);
  const stubbed = R.settle(r, 'stubbed', 'would have sent the proposal to the customer');
  assert.deepEqual(R.problems(stubbed), []);
  assert.throws(() => R.settle(done, 'failed', 'again'), /already ended/);
  assert.throws(() => R.settle(r, 'running', 'x'), /not an end state/);
  assert.ok(R.problems({ ...r, owner: '' }).some((p) => /owner/.test(p)));
  assert.ok(R.problems({ ...done, result: null }).some((p) => /says what it did/.test(p)));
  assert.ok(R.problems({ ...failed, error: '' }).some((p) => /says why/.test(p)));
  assert.ok(R.problems({ ...r, finished: 'x' }).some((p) => /running record/.test(p)));
});

test('track: the record is written before the action, then settled done with its result', async () => {
  const env = { DB: d1() };
  let sawRunning = null;
  const out = await R.track(env, { owner: 'owner', kind: 'test.thing', ref: 'r1' }, async () => { sawRunning = rows(env).map((x) => x.state); return 'did the thing'; });
  assert.deepEqual(sawRunning, ['running'], 'the running record exists while the action runs');
  const [r] = rows(env);
  assert.equal(r.state, 'done'); assert.equal(r.result, 'did the thing'); assert.equal(r.owner, 'owner'); assert.ok(r.finished);
  assert.equal(out.value, 'did the thing');
  assert.deepEqual(R.problems(r), []);
});

test('track: a failing action is recorded failed with its error, and the error still reaches the caller', async () => {
  const env = { DB: d1() };
  await assert.rejects(R.track(env, { owner: 'owner', kind: 'test.thing' }, async () => { throw new Error('the host answered 500'); }), /500/);
  const [r] = rows(env);
  assert.equal(r.state, 'failed'); assert.equal(r.error, 'the host answered 500'); assert.equal(r.result, null);
});

test('track: no record, no action', async () => {
  const env = { DB: d1({ failInsert: true }) };
  let ran = false;
  await assert.rejects(R.track(env, { owner: 'owner', kind: 'test.thing' }, async () => { ran = true; return 'x'; }), /D1 is down/);
  assert.equal(ran, false, 'the action never started without its record');
});

test('track: a stubbed action is not taken and its record says what would have happened', async () => {
  const env = { DB: d1() };
  let ran = false;
  const out = await R.track(env, { owner: 'owner', kind: 'proposal.send', ref: 'proposal-7' }, async () => { ran = true; }, { stub: 'would have emailed the proposal to the customer (send is stubbed behind the confirm line)' });
  assert.equal(ran, false);
  assert.equal(out.record.state, 'stubbed');
  const [r] = rows(env);
  assert.equal(r.state, 'stubbed'); assert.match(r.result, /would have emailed/);
});

test('an automation run writes one record per step it took, with the step that failed recorded failed', async () => {
  const env = { DB: d1() };
  await A.ensure(env);
  const saved = await A.save(env, { name: 'notes', when: { on: 'manual' }, do: [{ action: 'note', text: 'first' }, { action: 'http.post', url: 'https://example.com/hook', body: 'hi' }, { action: 'note', text: 'never reached' }] });
  assert.ok(saved.ok, JSON.stringify(saved));
  const got = await A.get(env, saved.rule.id);
  const out = await A.run(env, got.rule, {}, 'manual', { fetcher: async () => new Response('', { status: 500 }) });
  assert.equal(out.ok, false);
  const rs = rows(env);
  assert.deepEqual(rs.map((r) => [r.kind, r.state]), [['automation.note', 'done'], ['automation.http.post', 'failed']], 'the third step never ran, so it has no record');
  assert.match(rs[1].error, /answered 500/);
  assert.ok(rs.every((r) => r.owner === 'owner' && r.ref.startsWith(got.rule.id) && R.problems(r).length === 0));
});

test('/api/actions: owner only, newest first, filter by owner', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  await R.track(env, { owner: 'owner', kind: 'a' }, async () => 'one');
  await new Promise((r) => setTimeout(r, 5));
  await R.track(env, { owner: 'visitor:abc', kind: 'b' }, async () => 'two');
  const call = (url, auth = true) => api.onRequestGet({ env, request: new Request(url, { headers: auth ? { authorization: 'Bearer ' + TOKEN } : {} }) });
  assert.equal((await call('https://x/api/actions', false)).status, 401);
  const all = (await (await call('https://x/api/actions')).json()).actions;
  assert.deepEqual(all.map((r) => r.kind), ['b', 'a']);
  const mine = (await (await call('https://x/api/actions?owner=owner')).json()).actions;
  assert.deepEqual(mine.map((r) => r.kind), ['a']);
  // paging: limit and offset walk the record newest first; a bad offset is 0
  assert.deepEqual((await (await call('https://x/api/actions?limit=1')).json()).actions.map((r) => r.kind), ['b']);
  assert.deepEqual((await (await call('https://x/api/actions?limit=1&offset=1')).json()).actions.map((r) => r.kind), ['a']);
  assert.deepEqual((await (await call('https://x/api/actions?limit=5&offset=2')).json()).actions, []);
  assert.deepEqual((await (await call('https://x/api/actions?offset=nope')).json()).actions.map((r) => r.kind), ['b', 'a']);
  assert.equal((await api.onRequestGet({ env: { READ_TOKEN: TOKEN }, request: new Request('https://x/api/actions', { headers: { authorization: 'Bearer ' + TOKEN } }) })).status, 503);
});

// ---- the other action-takers run through track() (build order step 2, third piece): each writes its record ----
import * as learn from '../void-live-deploy/lib/learn.js';
import * as queueApi from '../void-live-deploy/functions/api/queue.js';
import * as willApi from '../void-live-deploy/functions/api/will.js';
import * as approvalApi from '../void-live-deploy/functions/api/approval.js';
import { fingerprint } from '../void-live-deploy/lib/approval-core.js';

const QUEUE = 'CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)';
const KV = 'CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)';
function d1full(opts) { const env = { DB: d1(opts) }; env.DB.raw.exec(QUEUE); env.DB.raw.exec(KV); env.DB.batch = async (list) => Promise.all(list.map((s) => s.run())); return env; }
const acts = (env) => env.DB.raw.prepare('SELECT owner, kind, ref, state, result, error FROM void_actions ORDER BY started').all();
const auth = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' };

test('a miss-board job (lib/learn.js) is queued inside its record: owner void, kind queue.add, ref the target; no record, no job', async () => {
  const env = d1full();
  const c = { ask: 'tides in lisbon', count: 3, variants: ['lisbon tides'], last: '2026-10-10T00:00:00Z', target: 'miss:tides-in-lisbon' };
  const id = await learn.queueMiss(env, c);
  assert.ok(id);
  assert.deepEqual(acts(env).map((a) => [a.owner, a.kind, a.ref, a.state]), [['void', 'queue.add', 'miss:tides-in-lisbon', 'done']]);
  assert.match(acts(env)[0].result, /^queued \w+: learn to handle "tides in lisbon"/);
  const down = d1full({ failInsert: true });
  await assert.rejects(learn.queueMiss(down, { ...c, target: 'miss:other' }), /D1 is down/);
  assert.equal(down.DB.raw.prepare('SELECT COUNT(*) n FROM void_queue').get().n, 0, 'no record, no job');
});

test('/api/queue POST queues the owner\'s job inside its record, and the builder wake has its own record, failed when the builder says no', async () => {
  const env = d1full(); env.READ_TOKEN = TOKEN; env.BUILDER_WEBHOOK_URL = 'https://builder.test/hook';
  const waits = []; const ctx = { env, request: new Request('https://x/api/queue', { method: 'POST', headers: auth, body: JSON.stringify({ ask: 'learn backgammon', target: 'next' }) }), waitUntil: (p) => waits.push(p) };
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('', { status: 500 });
  try { const r = await queueApi.onRequestPost(ctx); assert.equal(r.status, 200); await Promise.all(waits); } finally { globalThis.fetch = realFetch; }
  const a = acts(env);
  assert.deepEqual(a.map((x) => [x.owner, x.kind, x.ref, x.state]), [['owner', 'queue.add', 'next', 'done'], ['owner', 'builder.wake', a[1].ref, 'failed']]);
  assert.match(a[0].result, /^queued \w+: learn backgammon$/);
  assert.match(a[1].error, /the builder answered 500/);
  assert.equal(env.DB.raw.prepare('SELECT note FROM void_queue').get().note, 'builder wake failed 500');
});

test('/api/will queues Void\'s top want inside its record (owner void, ref will:<slug>)', async () => {
  const env = d1full(); env.READ_TOKEN = TOKEN; env.AI = { run: async () => { throw new Error('model busy'); } };
  const r = await willApi.onRequestPost({ env, request: new Request('https://x/api/will', { method: 'POST', headers: auth, body: JSON.stringify({ candidates: [{ kind: 'people asked', title: 'Learn tides', why: 'asked 9 times', weight: 9 }, { kind: 'idea', title: 'Backgammon', why: 'a game', weight: 2 }] }) }) });
  assert.equal(r.status, 200);
  const j = await r.json(); assert.ok(j.queued, JSON.stringify(j));
  assert.deepEqual(acts(env).map((a) => [a.owner, a.kind, a.ref, a.state]), [['void', 'queue.add', 'will:learn-tides', 'done']]);
  assert.match(acts(env)[0].result, /^queued \w+: Learn tides$/);
});

test('the confirm line: an approved action runs inside its record (done); a yes for a tool with no executor is recorded stubbed, nothing sent', async () => {
  const env = d1full(); env.READ_TOKEN = TOKEN;
  const post = (body) => approvalApi.onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: auth, body: JSON.stringify(body) }) });
  const sent = [];
  approvalApi.executors['message.send'] = async (args) => { sent.push(args); return { id: 'msg-1' }; };
  try {
    for (const [tool, args] of [['message.send', { to: 'jane', text: 'hi' }], ['email.send', { to: 'jane@x.com', subject: 'hi' }]]) {
      const req = await (await post({ type: 'a2m.approval.requested', toolName: tool, args })).json();
      const d = await (await post({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: await fingerprint(tool, args) })).json();
      assert.equal(d.ran, tool === 'message.send', JSON.stringify(d));
    }
  } finally { delete approvalApi.executors['message.send']; }
  assert.equal(sent.length, 1);
  const a = acts(env);
  assert.deepEqual(a.map((x) => [x.owner, x.kind, x.state]), [['owner', 'confirm.message.send', 'done'], ['owner', 'confirm.email.send', 'stubbed']]);
  assert.match(a[0].result, /msg-1/); assert.match(a[1].result, /email\.send is not connected yet: nothing was sent/);
  assert.ok(a.every((x) => /^[0-9a-f-]{36}$/.test(x.ref)), 'ref is the approval id');
});

test('every /api route has its explicit limit (the fast twin of the browser suite\'s defences check, which caught /api/actions only after merge)', async () => {
  const { LIMITS } = await import('../void-live-deploy/lib/guard.js');
  const { readdirSync } = await import('node:fs');
  const routes = readdirSync(new URL('../void-live-deploy/functions/api/', import.meta.url)).filter((f) => /^[a-z]+\.js$/.test(f)).map((f) => f.replace(/\.js$/, ''));
  assert.ok(routes.includes('actions'));
  assert.deepEqual(routes.filter((r) => !LIMITS[r]), [], 'routes with no limit in lib/guard.js LIMITS');
});
