// A sale becomes work (void-live-deploy/lib/sale-jobs.js, wired into functions/api/gumroad.js): one execution record,
// one job on the build queue, idempotent on the sale id; a refund cancels the job with its own record; the buyer's
// address never enters a record or a job, only its domain.
// Run: node --test tools/sale-jobs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../void-live-deploy/functions/api/gumroad.js';
import { SELLER_IDS } from '../void-live-deploy/lib/gumroad.js';
import { domainOf, serviceFor, jobAsk } from '../void-live-deploy/lib/sale-jobs.js';
import { productById } from '../void-live-deploy/lib/products.js';

const KEY = 'ping-key-for-tests';
function d1() {
  const db = new DatabaseSync(':memory:');
  db.prepare('CREATE TABLE IF NOT EXISTS void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)').run();
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; }, raw: db };
}
const env = (DB) => ({ GUMROAD_PING_KEY: KEY, DB });
const ping = (DB, fields) => onRequestPost({ env: env(DB), request: new Request('https://a-to-mind.com/api/gumroad?k=' + KEY, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }) });
const sale = (slug, n, extra = {}) => ({ resource_name: 'sale', sale_id: 's-' + slug + '-' + n, sale_timestamp: '2026-10-10T0' + n + ':00:00Z', email: 'buyer@acme.com', seller_id: SELLER_IDS[0], product_permalink: 'https://moonbeam846.gumroad.com/l/' + slug, ...extra });
const jobs = (DB) => DB.raw.prepare('SELECT * FROM void_queue ORDER BY at').all();
const recs = (DB) => { try { return DB.raw.prepare('SELECT * FROM void_actions ORDER BY started').all(); } catch (_) { return []; } };

test('one ping per product: one record, one job with the send list, the domain and never the address', async () => {
  const DB = d1();
  const want = [['eozcma', 'one-time-fix'], ['keep-it-running-membership', 'keep-it-running'], ['full-stack-audit', 'full-stack-audit'], ['first-automation-setup', 'first-automation-setup']];
  for (const [slug, id] of want) {
    const r = await (await ping(DB, sale(slug, 1))).json();
    assert.ok(r.ok, slug); assert.match(String(r.service || ''), /^queued job /, slug + ' -> ' + JSON.stringify(r));
  }
  const q = jobs(DB), a = recs(DB).filter((x) => x.kind === 'sale.service');
  assert.equal(q.length, 4); assert.equal(a.length, 4);
  for (const [slug, id] of want) {
    const p = productById(id), j = q.find((x) => x.target === 'sale:s-' + slug + '-1');
    assert.ok(j, id);
    assert.equal(j.ask, jobAsk(p, 'acme.com'), id);
    assert.match(j.ask, /acme\.com/); assert.ok(!j.ask.includes('buyer@'), 'no address in the job');
    assert.match(j.ask, /wait for their reply to the receipt/);
    assert.equal(j.state, 'queued');
  }
  for (const r of a) { assert.match(r.ref, / for acme\.com$/); assert.ok(!JSON.stringify(r).includes('buyer@'), 'no address in the record'); assert.equal(r.state, 'done'); assert.equal(r.owner, 'gumroad'); }
});

test('idempotent on the sale: the same ping again adds nothing, a re-sent sale id queues no second job', async () => {
  const DB = d1();
  await ping(DB, sale('eozcma', 1));
  const again = await (await ping(DB, sale('eozcma', 1))).json();
  assert.equal(again.note, 'already recorded');
  const later = await (await ping(DB, sale('eozcma', 2, { sale_id: 's-eozcma-1' }))).json(); // same sale, new timestamp
  assert.equal(later.service, 'job already queued');
  assert.equal(jobs(DB).length, 1);
  assert.equal(recs(DB).filter((x) => x.kind === 'sale.service').length, 1);
});

test('a refund cancels the open job with its own record; a second refund does nothing more', async () => {
  const DB = d1();
  await ping(DB, sale('full-stack-audit', 1));
  const r = await (await ping(DB, { resource_name: 'refund', sale_id: 's-full-stack-audit-1', refunded: 'true', email: 'buyer@acme.com', seller_id: SELLER_IDS[0], product_permalink: 'https://moonbeam846.gumroad.com/l/full-stack-audit', updated_at: '2026-10-10T02:00:00Z' })).json();
  assert.match(String(r.service || ''), /^cancelled job /, JSON.stringify(r));
  const j = jobs(DB)[0];
  assert.equal(j.state, 'cancelled'); assert.match(j.note, /refunded on Gumroad/);
  assert.equal(recs(DB).filter((x) => x.kind === 'sale.service.refund').length, 1);
  const r2 = await (await ping(DB, { resource_name: 'refund', sale_id: 's-full-stack-audit-1', refunded: 'true', seller_id: SELLER_IDS[0], product_permalink: 'https://moonbeam846.gumroad.com/l/full-stack-audit', updated_at: '2026-10-10T03:00:00Z' })).json();
  assert.ok(!r2.service, 'nothing left to cancel');
  assert.equal(recs(DB).filter((x) => x.kind === 'sale.service.refund').length, 1);
});

test('what never becomes a job: a test ping, another seller, a non-service product; and the gate stays shut without the key', async () => {
  const DB = d1();
  const t = await (await ping(DB, sale('eozcma', 1, { sale_id: 'tst-1', test: 'true' }))).json();
  assert.equal(t.service, 'no job: test ping');
  const o = await (await ping(DB, sale('eozcma', 2, { sale_id: 'oth-1', seller_id: 'somebody-else==' }))).json();
  assert.equal(o.service, 'no job: different seller');
  const m = await (await ping(DB, sale('yinmj', 3, { sale_id: 'mem-1' }))).json(); // the membership: not a crew job
  assert.ok(!m.service, 'a membership sale queues nothing');
  assert.equal(jobs(DB).length, 0); assert.equal(recs(DB).length, 0);
  const bad = await onRequestPost({ env: env(DB), request: new Request('https://a-to-mind.com/api/gumroad?k=wrong', { method: 'POST', body: 'sale_id=x' }) });
  assert.equal(bad.status, 403);
});

test('the helpers read a ping the way Gumroad writes one', () => {
  assert.equal(domainOf('Buyer@Acme.COM'), 'acme.com');
  assert.equal(domainOf('not-an-email'), 'unknown'); assert.equal(domainOf(''), 'unknown');
  assert.equal(serviceFor({ product_permalink: 'https://moonbeam846.gumroad.com/l/eozcma?layout=profile' }).id, 'one-time-fix');
  assert.equal(serviceFor({ permalink: 'keep-it-running-membership' }).id, 'keep-it-running');
  assert.equal(serviceFor({ product_permalink: 'https://moonbeam846.gumroad.com/l/yinmj' }), null, 'the membership has no send list');
});
