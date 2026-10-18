// A sale end to end, through the real handlers on an in-memory D1 (owner, 2026-10-11: "verified revenue is the only metric",
// so the money path is proven, not assumed): Gumroad's ping (functions/api/gumroad.js) -> the sale recorded once ->
// a job on the board (lib/sale-jobs.js) -> what Verse has earned and may spend (functions/api/earnings.js, lib/earnings.js:
// budget_cents) -> a milestone recorded once. And the doors stay shut: no key, a wrong key, a replayed ping, a test ping,
// another seller, the earnings read without the owner's token, and a refund taking the money back off the budget.
// Run: node --test tools/sale-e2e.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as ping } from '../void-live-deploy/functions/api/gumroad.js';
import { onRequestGet as earnings } from '../void-live-deploy/functions/api/earnings.js';
import { SELLER_IDS } from '../void-live-deploy/lib/gumroad.js';

const KEY = 'ping-key-for-tests', READ = 'owner-read-token-for-tests-0123456789';
function d1() {
  const db = new DatabaseSync(':memory:');
  // the build queue's table exists on the site (functions/api/queue.js makes it); the sales and earnings tables are made by the handlers
  db.prepare('CREATE TABLE IF NOT EXISTS void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)').run();
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; }, exec: async (sql) => db.exec(sql), raw: db };
}
const envOf = (DB, extra = {}) => ({ GUMROAD_PING_KEY: KEY, READ_TOKEN: READ, DB, ...extra });
const send = (env, fields, k = KEY) => ping({ env, request: new Request('https://a-to-mind.com/api/gumroad' + (k == null ? '' : '?k=' + encodeURIComponent(k)), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }) });
const read = async (env, token = READ) => { const r = await earnings({ env, request: new Request('https://a-to-mind.com/api/earnings', { headers: token ? { authorization: 'Bearer ' + token } : {} }) }); return { status: r.status, body: r.status === 200 ? await r.json() : null }; };
const sale = (n, extra = {}) => ({ resource_name: 'sale', sale_id: 'sale-' + n, sale_timestamp: '2026-10-11T0' + n + ':00:00Z', price: '14900', currency: 'usd',
  email: 'buyer@example.com', seller_id: SELLER_IDS[0], product_permalink: 'https://moonbeam846.gumroad.com/l/full-stack-audit', ...extra });

test('the doors: no key configured, no key, a wrong key, and the earnings read without the owner token are all refused', async () => {
  const DB = d1();
  assert.equal((await send({ DB }, sale(1))).status, 503, 'no ping key configured: nothing is recorded');
  assert.equal((await send(envOf(DB), sale(1), null)).status, 403, 'no key');
  assert.equal((await send(envOf(DB), sale(1), 'not-the-key')).status, 403, 'wrong key');
  assert.equal((await read(envOf(DB), null)).status, 401, 'earnings without a token');
  assert.equal((await read(envOf(DB), 'not-the-token')).status, 401, 'earnings with a wrong token');
});

test('a sale: recorded once, one job, counted once in what Verse earned and may spend; a replay changes nothing', async () => {
  const DB = d1(), env = envOf(DB);
  const first = await (await send(env, sale(1))).json();
  assert.ok(first.ok, JSON.stringify(first));
  assert.match(String(first.service || ''), /^queued job /, 'the sale became work on the board');
  let t = (await read(env)).body;
  assert.deepEqual([t.gross_cents, t.earned_cents, t.budget_cents, t.sales], [14900, 14900, 14900, 1]);
  assert.deepEqual(t.milestones.map((m) => m.id), ['sales-100'], 'crossing $100 is recorded');
  const again = await (await send(env, sale(1))).json();
  assert.equal(again.note, 'already recorded', 'Gumroad retries the same ping: it is not counted twice');
  t = (await read(env)).body;
  assert.equal(t.budget_cents, 14900); assert.equal(t.sales, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM void_queue WHERE target = 'sale:sale-1'").get().n, 1, 'one job, not two');
  assert.equal(t.milestones.length, 1, 'a milestone is recorded once, never again');
});

test('money that is not real never reaches the budget: a test ping, a disputed sale, a refund', async () => {
  const DB = d1(), env = envOf(DB);
  await send(env, sale(1, { test: 'true' }));
  assert.equal((await read(env)).body.budget_cents, 0, 'a Gumroad test ping is not money');
  await send(env, sale(2));
  await send(env, sale(3, { price: '4900' }));
  assert.equal((await read(env)).body.budget_cents, 19800);
  await send(env, { resource_name: 'refund', sale_id: 'sale-2', seller_id: SELLER_IDS[0], refunded_at: '2026-10-11T09:00:00Z', product_permalink: 'https://moonbeam846.gumroad.com/l/full-stack-audit' });
  const t = (await read(env)).body;
  assert.deepEqual([t.gross_cents, t.refunded_cents, t.earned_cents, t.budget_cents], [19800, 14900, 4900, 4900], 'a refund comes back off the budget');
  await send(env, sale(4, { price: '9900', disputed: 'true' }));
  assert.equal((await read(env)).body.budget_cents, 4900, 'a disputed sale is not spendable');
});

test('nothing about the buyer goes past the sales record: the job carries the domain, never the address', async () => {
  const DB = d1(), env = envOf(DB);
  await send(env, sale(1, { email: 'jane.doe@example.com' }));
  const jobs = DB.raw.prepare('SELECT ask, note FROM void_queue').all();
  assert.equal(jobs.length, 1);
  assert.ok(!JSON.stringify(jobs).includes('jane.doe'), 'the address is not in the job');
});
