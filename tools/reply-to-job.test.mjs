// A buyer's reply reaches the job (functions/api/handoff.js `job` field, docs/intake.md): the handoff url is appended
// to the sale's job with one sale.reply record; a repeat with the same name+job doesn't double; a wrong token is 401;
// a job that doesn't exist is 404 and still stores the handoff; a plain handoff is unchanged.
// Run: node --test tools/reply-to-job.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../void-live-deploy/functions/api/handoff.js';

const TOKEN = 'handoff-token-for-tests';
function d1() {
  const db = new DatabaseSync(':memory:');
  db.prepare('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)').run();
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const env = (DB) => ({ HANDOFF_TOKEN: TOKEN, DB });
const post = (DB, body, token = TOKEN) => onRequest({ env: env(DB), request: new Request('https://a-to-mind.com/api/handoff', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
const seedJob = (DB, saleId) => DB.raw.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run('j1', 'serve Full Stack Audit for acme.com: wait for their reply to the receipt, then …', 'sale:' + saleId, 'queued', 'from a Gumroad sale', '2026-10-10T02:00:00Z', '2026-10-10T02:00:00Z');
const job = (DB) => DB.raw.prepare('SELECT * FROM void_queue').get();
const recs = (DB) => { try { return DB.raw.prepare('SELECT * FROM void_actions ORDER BY started').all(); } catch (_) { return []; } };
const handoffs = (DB) => DB.raw.prepare('SELECT * FROM handoff ORDER BY created').all();

test('a reply with a job target appends the url to the job and records once, redacted, domain only', async () => {
  const DB = d1(); seedJob(DB, 's-1');
  const r = await (await post(DB, { name: 'Re your Full Stack Audit [sale.s-1]', author: 'buyer@acme.com', body: 'here is our Zapier list, token github_pat_ABCDEFGHIJKLMNOPQRST12 attached', job: 'sale:s-1' })).json();
  assert.match(String(r.job || ''), /^reply received: https:\/\/a-to-mind\.com\/api\/handoff\?id=[a-f0-9]{32}&raw=1 appended to job j1$/, JSON.stringify(r));
  assert.match(job(DB).ask, / · reply received: https:\/\/a-to-mind\.com\/api\/handoff\?id=[a-f0-9]{32}&raw=1$/);
  const a = recs(DB); assert.equal(a.length, 1);
  assert.equal(a[0].kind, 'sale.reply'); assert.equal(a[0].ref, 'sale:s-1 from acme.com'); assert.equal(a[0].state, 'done');
  assert.ok(!JSON.stringify(a[0]).includes('buyer@'), 'the record carries the domain, never the address');
  const h = handoffs(DB)[0];
  assert.equal(h.author, 'acme.com', 'the stored author is the domain');
  assert.ok(h.body.includes('[redacted]') && !h.body.includes('github_pat_'), 'the stored body is redacted');
});

test('a repeat with the same name and job answers 200 and doubles nothing', async () => {
  const DB = d1(); seedJob(DB, 's-2');
  const first = await post(DB, { name: 'Re receipt [sale.s-2]', author: 'a@b.co', body: 'hello', job: 'sale:s-2' });
  assert.equal(first.status, 201);
  const again = await post(DB, { name: 'Re receipt [sale.s-2]', author: 'a@b.co', body: 'hello again', job: 'sale:s-2' });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).note, 'already received');
  assert.equal(handoffs(DB).length, 1);
  assert.equal(recs(DB).length, 1);
  assert.equal((job(DB).ask.match(/reply received:/g) || []).length, 1, 'one appended line');
});

test('a wrong token is 401 and stores nothing', async () => {
  const DB = d1(); seedJob(DB, 's-3');
  const r = await post(DB, { name: 'x', body: 'y', job: 'sale:s-3' }, 'wrong');
  assert.equal(r.status, 401);
  assert.equal(handoffs(DB).length, 0); assert.equal(recs(DB).length, 0);
});

test('a job that does not exist is 404 and the handoff is still stored; a malformed job is 400', async () => {
  const DB = d1();
  const r = await post(DB, { name: 'orphan reply', author: 'a@b.co', body: 'hi', job: 'sale:nope' });
  assert.equal(r.status, 404);
  const j = await r.json();
  assert.match(j.error, /job not found/); assert.match(j.url, /raw=1$/);
  assert.equal(handoffs(DB).length, 1);
  assert.equal(recs(DB).length, 0, 'no record without a job to land on');
  assert.equal((await post(DB, { name: 'bad', body: 'x', job: 'order:1' })).status, 400);
});

test('a plain handoff is unchanged: stored as sent, no redaction, no record, no job column value', async () => {
  const DB = d1();
  const r = await post(DB, { name: 'build log', author: 'ci', body: 'raw github_pat_ABCDEFGHIJKLMNOPQRST12 stays' });
  assert.equal(r.status, 201);
  const h = handoffs(DB)[0];
  assert.ok(h.body.includes('github_pat_'), 'an agent file comes back byte for byte');
  assert.equal(h.job, null);
  assert.equal(recs(DB).length, 0);
});
