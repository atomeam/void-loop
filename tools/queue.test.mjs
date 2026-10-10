// The builders' queue (void-live-deploy/functions/api/queue.js): a claim moves a job from 'queued' to 'building' in one
// statement, so of two builders claiming the same job exactly one gets it and the other learns who holds it. This is what
// `python tools/void_queue.py claim <target>` stands on (its own tests: tools/void_queue_test.py).
// Run: node --test tools/queue.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as Q from '../void-live-deploy/functions/api/queue.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function envOf() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { READ_TOKEN: TOKEN, DB: { prepare: (sql) => stmt(sql), raw: db } };
}
const job = (env, id, target, state = 'queued', note = '', at = '2026-10-10T00:00:0' + id.slice(-1) + 'Z') =>
  env.DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, 'build ' + target, target, state, note, at, at);
const patch = (env, b) => Q.onRequestPatch({ env, request: new Request('https://x/api/queue', { method: 'PATCH', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(b) }) });
const row = (env, id) => env.DB.raw.prepare('SELECT * FROM void_queue WHERE id = ?').get(id);

test('claim by target: the queued job becomes building, named for its claimer, keeping what its note said', async () => {
  const env = envOf(); job(env, 'j1', 'step:5', 'queued', 'asked 3×');
  const res = await patch(env, { target: 'step:5', state: 'building', from: 'queued', by: 'laptop-a' });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.claimed.id, 'j1'); assert.equal(j.claimed.state, 'building');
  assert.equal(row(env, 'j1').note, 'claimed by laptop-a · asked 3×');
  assert.ok(Array.isArray(j.items), 'the view comes back for the queue file');
});

test('a second claim on the same target is refused with who holds it (409); nothing changes', async () => {
  const env = envOf(); job(env, 'j1', 'step:5');
  await patch(env, { target: 'step:5', state: 'building', from: 'queued', by: 'laptop-a' });
  const before = row(env, 'j1');
  const res = await patch(env, { target: 'step:5', state: 'building', from: 'queued', by: 'laptop-b' });
  assert.equal(res.status, 409);
  const { held } = await res.json();
  assert.equal(held.state, 'building'); assert.equal(held.note, 'claimed by laptop-a');
  assert.deepEqual(row(env, 'j1'), before);
});

test('two builders claiming at once: exactly one gets the job', async () => {
  const env = envOf(); job(env, 'j1', 'step:5');
  const codes = (await Promise.all(['a', 'b', 'c'].map((w) => patch(env, { target: 'step:5', state: 'building', from: 'queued', by: w })))).map((r) => r.status).sort();
  assert.deepEqual(codes, [200, 409, 409]);
});

test('the oldest queued job for a target is the one claimed; no job for a target is a 404', async () => {
  const env = envOf(); job(env, 'j2', 'miss:tides', 'queued', '', '2026-10-10T00:00:02Z'); job(env, 'j1', 'miss:tides', 'queued', '', '2026-10-10T00:00:01Z');
  const j = await (await patch(env, { target: 'miss:tides', state: 'building', from: 'queued', by: 'x' })).json();
  assert.equal(j.claimed.id, 'j1'); assert.equal(row(env, 'j2').state, 'queued');
  assert.equal((await patch(env, { target: 'step:9', state: 'building', from: 'queued', by: 'x' })).status, 404);
});

test('claim by id only from the stated state; the old PATCH (no from) still sets state and note as before', async () => {
  const env = envOf(); job(env, 'j1', 'next', 'building', 'claimed by a');
  assert.equal((await patch(env, { id: 'j1', state: 'building', from: 'queued', by: 'b' })).status, 409);
  assert.equal((await patch(env, { id: 'nope', state: 'building', from: 'queued' })).status, 404);
  assert.equal((await patch(env, { id: 'j1', state: 'live', note: 'shipped' })).status, 200);
  assert.deepEqual([row(env, 'j1').state, row(env, 'j1').note], ['live', 'shipped']);
  assert.equal((await patch(env, { id: 'nope', state: 'live' })).status, 404);
});
