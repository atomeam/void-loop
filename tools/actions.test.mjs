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
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
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
  assert.equal((await api.onRequestGet({ env: { READ_TOKEN: TOKEN }, request: new Request('https://x/api/actions', { headers: { authorization: 'Bearer ' + TOKEN } }) })).status, 503);
});
