// The in-site rehearsal seed (functions/api/rehearsal.js): owner-gated, one clearly marked handoff row with its
// record; the seeded reply reads back through /api/handoff and drafts through lib/job-draft.js; cleanup removes
// every rehearsal- row and nothing else. The deploy token never needs D1 scope.
// Run: node --test tools/rehearsal-route.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as rehearsal, REHEARSAL_BODY } from '../void-live-deploy/functions/api/rehearsal.js';
import { onRequest as handoff } from '../void-live-deploy/functions/api/handoff.js';
import { draftOnClaim, handoffIdIn } from '../void-live-deploy/lib/job-draft.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const env = (DB) => ({ READ_TOKEN: TOKEN, DB, HANDOFF_TOKEN: 'h' });
const call = (DB, method, tok = TOKEN) => rehearsal({ env: env(DB), request: new Request('https://a-to-mind.com/api/rehearsal', { method, headers: { authorization: 'Bearer ' + tok } }) });
const recs = (DB, kind) => { try { return DB.raw.prepare('SELECT * FROM void_actions WHERE kind = ? ORDER BY started').all(kind); } catch (_) { return []; } };

test('no token, no seed: an unauthenticated or wrong-token call is 401 and writes nothing', async () => {
  const DB = d1();
  for (const tok of ['wrong', '']) {
    const r = await call(DB, 'POST', tok);
    assert.equal(r.status, 401);
  }
  assert.throws(() => DB.raw.prepare('SELECT * FROM handoff').all()); // the table was never even made
});

test('the owner seeds one marked reply: rehearsal- id, redacted fixed body, its record; it reads back and drafts', async () => {
  const DB = d1();
  const r = await (await call(DB, 'POST')).json();
  assert.match(r.id, /^rehearsal-[a-f0-9]{22}$/);
  assert.match(r.url, /\/api\/handoff\?id=rehearsal-[a-f0-9]{22}&raw=1$/);
  const row = DB.raw.prepare('SELECT * FROM handoff').get();
  assert.equal(row.id, r.id); assert.equal(row.author, 'rehearsal.example'); assert.equal(row.body, REHEARSAL_BODY);
  const seeds = recs(DB, 'rehearsal.seed');
  assert.equal(seeds.length, 1); assert.equal(seeds[0].state, 'done'); assert.equal(seeds[0].ref, r.id);
  // the seeded reply is a real handoff: public GET by its id, and the claim drafts from it
  const g = await handoff({ env: env(DB), request: new Request(r.url) });
  assert.equal(g.status, 200);
  assert.match(await g.text(), /test bakery/);
  DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('j1', 'serve One-Time Fix for rehearsal.example: wait for their reply to the receipt · reply received: ' + r.url, 'sale:rehearsal-run', 'queued', '', '2026-10-10T00:00:01Z', '2026-10-10T00:00:01Z');
  assert.equal(handoffIdIn('reply received: ' + r.url), r.id);
  const line = await draftOnClaim(env(DB), DB.raw.prepare("SELECT * FROM void_queue WHERE id = 'j1'").get());
  assert.match(line, /^draft proposal on job j1 for rehearsal\.example/);
  assert.ok(DB.raw.prepare("SELECT draft FROM void_queue WHERE id = 'j1'").get().draft.includes('To: rehearsal.example'));
});

test('cleanup removes every rehearsal- row and only those, with one record', async () => {
  const DB = d1();
  await call(DB, 'POST'); await call(DB, 'POST');
  DB.raw.prepare('INSERT INTO handoff (id, name, author, body, created, job) VALUES (?, ?, ?, ?, ?, ?)')
    .run('a'.repeat(32), 'real reply', 'acme.com', 'a real buyer wrote this', Math.floor(Date.now() / 1000), 'sale:s-1');
  const r = await (await call(DB, 'DELETE')).json();
  assert.match(r.note, /^removed 2 rehearsal rows$/);
  const left = DB.raw.prepare('SELECT id FROM handoff').all();
  assert.deepEqual(left.map((x) => x.id), ['a'.repeat(32)], 'the real handoff is untouched');
  assert.equal(recs(DB, 'rehearsal.clean').length, 1);
  assert.equal((await call(DB, 'DELETE', 'wrong')).status, 401);
});
