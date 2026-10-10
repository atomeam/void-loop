// The job drafts its own first step (void-live-deploy/lib/job-draft.js, wired into the claim in functions/api/queue.js):
// a claimed serve job carrying a buyer's reply gets the proposal drafted onto it — lib/proposal.js fields, blank price,
// To = the reply's domain — with one proposal.draft execution record, idempotent per job; a job without a reply drafts
// nothing; Send stays stubbed behind the confirm line (nothing here sends).
// Run: node --test tools/job-draft.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handoffIdIn, draftOnClaim } from '../void-live-deploy/lib/job-draft.js';
import { PRICE_BLANK } from '../void-live-deploy/lib/proposal.js';
import { onRequestPatch } from '../void-live-deploy/functions/api/queue.js';

const TOKEN = 'owner-token-for-tests';
const HID = 'a'.repeat(32);
// the proposal tests' own fixture: the request as a buyer replies to the receipt with it
const REQUEST = `Hi Adam,

We run a small bakery in Portland and our online orders come in through Shopify. We need the Zapier zap that copies each order into our Google Sheet fixed: since last week every order shows up twice and the morning bake list is wrong. We would also like someone to check the whole flow once a month so it does not break again before the holidays.

Can you tell us what you would do and when you could start?

Thanks,
Maria`;

function d1() {
  const db = new DatabaseSync(':memory:');
  db.prepare('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)').run();
  db.prepare('CREATE TABLE handoff (id TEXT PRIMARY KEY, name TEXT, author TEXT, body TEXT, created INTEGER, job TEXT)').run();
  db.prepare('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)').run();
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const seed = (DB, { reply = true, hid = HID } = {}) => {
  const url = ' · reply received: https://a-to-mind.com/api/handoff?id=' + hid + '&raw=1';
  DB.raw.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('j1', 'serve Full Stack Audit for sunrisebakery.example: wait for their reply to the receipt, then …' + (reply ? url : ''), 'sale:s-1', 'queued', 'from a Gumroad sale', '2026-10-10T02:00:00Z', '2026-10-10T02:00:00Z');
  if (reply) DB.raw.prepare('INSERT INTO handoff (id, name, author, body, created, job) VALUES (?, ?, ?, ?, ?, ?)')
    .run(hid, 'Re receipt [sale:s-1]', 'sunrisebakery.example', REQUEST, Math.floor(Date.now() / 1000), 'sale:s-1');
};
const job = (DB) => DB.raw.prepare("SELECT * FROM void_queue WHERE id = 'j1'").get();
const recs = (DB) => { try { return DB.raw.prepare("SELECT * FROM void_actions WHERE kind = 'proposal.draft' ORDER BY started").all(); } catch (_) { return []; } };
const row = (DB) => ({ ...job(DB) });

test('the reply link on a job body is found, the last one when there are two', () => {
  assert.equal(handoffIdIn('… · reply received: https://a-to-mind.com/api/handoff?id=' + HID + '&raw=1'), HID);
  assert.equal(handoffIdIn('x · reply received: https://a-to-mind.com/api/handoff?id=' + 'b'.repeat(32) + '&raw=1 · reply received: https://a-to-mind.com/api/handoff?id=' + HID + '&raw=1'), HID);
  assert.equal(handoffIdIn('serve Full Stack Audit: wait for their reply'), '');
  assert.equal(handoffIdIn(''), '');
});

test('a claimed job with a reply gets one draft and one record, fields the proposal way, To = the domain', async () => {
  const DB = d1(); seed(DB);
  const env = { DB };
  const line = await draftOnClaim(env, row(DB));
  assert.equal(line, 'draft proposal on job j1 for sunrisebakery.example, waiting on the confirm line');
  const d = job(DB).draft;
  assert.ok(d, 'the draft is stored on the job');
  assert.match(d, /^# Proposal: /); assert.match(d, /To: sunrisebakery\.example/);
  assert.ok(d.includes(PRICE_BLANK), 'the price line is left for the owner');
  assert.match(d, /## What they asked for/); assert.match(d, /Zapier zap/);
  assert.ok(!d.includes('maria@'), 'no address of the buyer lands in the draft header');
  const a = recs(DB); assert.equal(a.length, 1);
  assert.equal(a[0].state, 'done'); assert.equal(a[0].owner, 'void');
  assert.equal(a[0].ref, 'sale:s-1 for sunrisebakery.example');
  assert.match(a[0].result, /waiting on the confirm line/);
});

test('a second claim reuses the draft: nothing new, no second record', async () => {
  const DB = d1(); seed(DB);
  const env = { DB };
  await draftOnClaim(env, row(DB));
  const before = job(DB).draft;
  const again = await draftOnClaim(env, row(DB));
  assert.equal(again, 'draft already on the job');
  assert.equal(job(DB).draft, before);
  assert.equal(recs(DB).length, 1);
});

test('a job without a reply, a non-sale job, and an expired reply draft nothing', async () => {
  const DB = d1(); seed(DB, { reply: false });
  const env = { DB };
  assert.equal(await draftOnClaim(env, row(DB)), '');
  assert.equal(await draftOnClaim(env, { id: 'x', target: 'next', ask: 'reply received: https://a-to-mind.com/api/handoff?id=' + HID + '&raw=1' }), '');
  assert.equal(job(DB).draft ?? null, null);
  assert.equal(recs(DB).length, 0);
  const DB2 = d1(); seed(DB2); DB2.raw.prepare('DELETE FROM handoff').run();
  assert.equal(await draftOnClaim({ DB: DB2 }, row(DB2)), 'no draft: the reply link has expired');
  assert.equal(job(DB2).draft ?? null, null);
  assert.equal(recs(DB2).length, 0, 'no record without a reply to draft from');
});

test('the claim endpoint itself answers with the draft line and the drafted job', async () => {
  const DB = d1(); seed(DB);
  const env = { DB, READ_TOKEN: TOKEN };
  const r = await onRequestPatch({ env, request: new Request('https://a-to-mind.com/api/queue', { method: 'PATCH',
    headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify({ target: 'sale:s-1', state: 'building', from: 'queued', by: 'builder tests' }) }) });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.claimed.id, 'j1');
  assert.match(String(j.draft || ''), /^draft proposal on job j1 for sunrisebakery\.example/, JSON.stringify(j.draft));
  assert.ok(job(DB).draft.includes(PRICE_BLANK));
  assert.equal(recs(DB).length, 1);
});
