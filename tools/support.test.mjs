// functions/api/support.js: someone who pays says "it broke", gets a ticket, and reads the owner's answer; nobody else can write.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/support.js';
import { ensureTables, sessionId } from '../void-live-deploy/lib/void-me.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}
const OWNER = 'owner-token-for-tests-1234567890';
async function world() {
  const env = { DB: d1(), READ_TOKEN: OWNER };
  await ensureTables(env);
  const sess = async (tok, user, tier) => {
    env.DB.raw.prepare("INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier").run(user, tier, new Date().toISOString());
    env.DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(tok), user, new Date().toISOString(), Date.now() + 864e5);
  };
  return { env, sess };
}
const req = (method, auth, body) => new Request('https://x.test/api/support', { method, headers: auth ? { authorization: 'Bearer ' + auth } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
const post = (env, auth, body) => api.onRequestPost({ request: req('POST', auth, body), env });
const get = async (env, auth) => api.onRequestGet({ request: req('GET', auth), env });

test('a paying account reports, reads its own ticket, and sees the owner answer it', async () => {
  const { env, sess } = await world();
  const PAID = 'p'.repeat(43), FREE = 'f'.repeat(43);
  await sess(PAID, 'u-paid', 'paid'); await sess(FREE, 'u-free', 'free');
  const r = await post(env, PAID, { what: 'The closer read stopped showing. My key is vr1.' + 'A'.repeat(43), where: 'action' });
  assert.equal(r.status, 201);
  const t = await r.json();
  assert.match(t.id, /^S-[0-9A-F]{8}$/); assert.equal(t.status, 'open');
  const mine = (await (await get(env, PAID)).json()).tickets;
  assert.equal(mine.length, 1); assert.equal(mine[0].where, 'action');
  assert.ok(!mine[0].what.includes('A'.repeat(43)), 'a key typed into the report is masked before it is kept');
  // a free account and a stranger cannot write or read
  assert.equal((await post(env, FREE, { what: 'broken' })).status, 401);
  assert.equal((await post(env, null, { what: 'broken' })).status, 401);
  assert.equal((await get(env, null)).status, 401);
  assert.equal((await post(env, PAID, { what: '' })).status, 400, 'a report needs words');
  // only the owner answers; the owner sees every open ticket
  assert.equal((await post(env, PAID, { action: 'answer', id: t.id, answer: 'self-answer' })).status, 403);
  const all = await (await get(env, OWNER)).json();
  assert.equal(all.open, 1);
  assert.equal((await post(env, OWNER, { action: 'answer', id: t.id, answer: 'Fixed in today\'s deploy: the key check was failing.' })).status, 200);
  assert.equal((await post(env, OWNER, { action: 'answer', id: 'S-00000000', answer: 'x' })).status, 404);
  const after = (await (await get(env, PAID)).json()).tickets[0];
  assert.equal(after.status, 'answered'); assert.match(after.answer, /Fixed in today/);
  assert.equal((await (await get(env, OWNER)).json()).open, 0);
  // another payer never sees someone else's tickets
  const OTHER = 'o'.repeat(43); await sess(OTHER, 'u-other', 'paid');
  assert.deepEqual((await (await get(env, OTHER)).json()).tickets, []);
});
