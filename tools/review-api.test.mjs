// node --test tools/review-api.test.mjs: Void's code review API (functions/api/review.js, lib/review-api.js) on a real
// SQLite standing in for D1: the free instant checks, Pro keys (minted only by a paid account, stored as a hash, refused
// once the account is free again), the closer read and its daily cap, revoking, and "forget me" taking the keys too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/review.js';
import { ensureTables, sessionId } from '../void-live-deploy/lib/void-me.js';
import { quick, KEY_RE, PRO_DAILY, keyHash, today } from '../void-live-deploy/lib/review-api.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const st = (sql, a = []) => ({ sql, a, bind: (...b) => st(sql, b), first: async (c) => { const r = db.prepare(sql).get(...a) ?? null; return c ? (r ? r[c] : null) : r; }, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a) });
  return { db, prepare: (sql) => st(sql), batch: async (list) => { db.exec('BEGIN'); try { for (const s of list) db.prepare(s.sql).run(...s.a); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}
const TOKEN = 'a'.repeat(43), USER = 'user-1';
async function envWith({ tier = 'paid', ai } = {}) {
  const env = { DB: d1(), AI: ai };
  await ensureTables(env);
  env.DB.db.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(TOKEN), USER, 'now', Date.now() + 1e9);
  env.DB.db.prepare("INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, 'now')").run(USER, tier);
  return env;
}
const call = (fn, env, body, auth) => fn({ request: new Request('https://a-to-mind.com/api/review', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: body == null ? undefined : JSON.stringify(body) }), env });
const ai = (reply, calls = []) => ({ run: async (m, o) => { calls.push(o); return { response: reply }; } });
const BUGGY = 'function f(x) {\n  if (x = 5) { return eval(x); }\n}';

test('free: the instant checks, no account, in milliseconds, with an upgrade line', async () => {
  const env = await envWith();
  const r = await (await call(api.onRequestPost, env, { code: BUGGY })).json();
  assert.equal(r.tier, 'free'); assert.equal(r.review, 'rules');
  assert.ok(r.findings.some((f) => f.rule === 'assign-in-condition' && f.line === 2), JSON.stringify(r.findings));
  assert.ok(r.ms < 500 && /code-review/.test(r.upgrade));
  assert.equal((await call(api.onRequestPost, env, { code: 'x' })).status, 400);
});

test('a diff is checked on its added lines, with the new file\'s line numbers', () => {
  const diff = 'diff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -10,2 +10,3 @@\n const a = 1;\n-if (a === 5) go();\n+if (a = 5) go();\n+const b = 2;\n';
  const q = quick({ diff });
  assert.deepEqual(q.findings.filter((f) => f.kind === 'bug').map((f) => f.line), [11]);
});

test('Pro keys: only a paid account mints one; only its hash is kept; it unlocks the closer read', async () => {
  const calls = [], env = await envWith({ ai: ai('Line 2: = should be ===.', calls) });
  assert.equal((await call(api.onRequestPost, env, { action: 'key' })).status, 401);
  const m = await (await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).json();
  assert.ok(KEY_RE.test(m.key), m.key);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys WHERE hash = ?').get(await keyHash(m.key)).n, 1);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys WHERE hash = ?').get(m.key).n, 0, 'the key itself is never stored');
  const r = await (await call(api.onRequestPost, env, { code: BUGGY + '\nconst k = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";' }, m.key)).json();
  assert.equal(r.tier, 'pro'); assert.equal(r.review, 'model'); assert.match(r.answer, /===/);
  assert.equal(r.left, PRO_DAILY - 1);
  assert.ok(!JSON.stringify(calls).includes('abcdefghijklmnopqrstuvwxyz0123456789'), 'keys in the code are masked before the model sees them');
  const g = await (await api.onRequestGet({ request: new Request('https://a-to-mind.com/api/review', { headers: { authorization: 'Bearer ' + TOKEN } }), env })).json();
  assert.equal(g.keys.length, 1); assert.equal(g.keys[0].total, 1); assert.equal(g.keys[0].prefix, m.key.slice(0, 10));
});

test('a free account gets no key; a refunded account\'s key falls back to the free checks; unknown keys are refused', async () => {
  const env = await envWith({ tier: 'free', ai: ai('x') });
  const r = await call(api.onRequestPost, env, { action: 'key' }, TOKEN);
  assert.equal(r.status, 402); assert.match((await r.json()).buy, /code-review/);
  const paid = await envWith({ ai: ai('closer read') });
  const { key } = await (await call(api.onRequestPost, paid, { action: 'key' }, TOKEN)).json();
  paid.DB.db.prepare("UPDATE void_accounts SET tier = 'free'").run();
  const back = await (await call(api.onRequestPost, paid, { code: BUGGY }, key)).json();
  assert.equal(back.tier, 'free'); assert.equal(back.answer, undefined); assert.ok(back.findings.length);
  assert.equal((await call(api.onRequestPost, paid, { code: BUGGY }, 'vr1.' + 'b'.repeat(43))).status, 401);
});

test('the daily cap, five keys at most, revoking, and forget me', async () => {
  const env = await envWith({ ai: ai('ok') });
  const keys = [];
  for (let i = 0; i < 5; i++) keys.push((await (await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).json()).key);
  assert.equal((await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).status, 409);
  env.DB.db.prepare('UPDATE void_review_keys SET day = ?, uses = ? WHERE hash = ?').run(today(), PRO_DAILY, await keyHash(keys[0]));
  const capped = await (await call(api.onRequestPost, env, { code: BUGGY }, keys[0])).json();
  assert.equal(capped.tier, 'pro'); assert.equal(capped.answer, undefined); assert.match(capped.note, /used/);
  const del = await api.onRequestDelete({ request: new Request('https://a-to-mind.com/api/review', { method: 'DELETE', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ prefix: keys[1].slice(0, 10) }) }), env });
  assert.equal(del.status, 200);
  assert.equal((await call(api.onRequestPost, env, { code: BUGGY }, keys[1])).status, 401, 'a revoked key stops working');
  const passkey = await import('../void-live-deploy/functions/api/passkey.js');
  const f = await passkey.onRequestPost({ request: new Request('https://a-to-mind.com/api/passkey', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ step: 'forget' }) }), env });
  assert.equal(f.status, 200, await f.clone().text());
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys').get().n, 0, 'forget me removes the review keys');
});

test('Void Code Review Pro on its own: a Gumroad license key, checked with Gumroad and remembered; refunds turn it off', async () => {
  const LIC = 'A1B2C3D4-E5F60718-293A4B5C-6D7E8F90', asked = [];
  let purchase = { refunded: false, test: false };
  const gumroad = async (url, init) => { asked.push(String(init.body)); const k = new URLSearchParams(init.body).get('license_key'); return k === LIC ? Response.json({ success: true, purchase }) : Response.json({ success: false, message: 'That license does not exist for the provided product.' }, { status: 404 }); };
  const env = await envWith({ ai: ai('closer read') });
  env.fetchGumroad = gumroad;
  // the store catalog knows the product by its permalink (dkmcjk) and holds Gumroad's long id for it
  const { ensureStoreTables } = await import('../void-live-deploy/lib/store-db.js');
  await ensureStoreTables(env);
  env.DB.db.prepare("INSERT INTO void_catalog (slug, data, available, updated) VALUES ('dkmcjk', ?, 1, 'now')").run(JSON.stringify({ id: 'prod123==', short: 'dkmcjk', name: 'Void Code Review Pro' }));
  const r = await (await call(api.onRequestPost, env, { code: BUGGY }, LIC)).json();
  assert.equal(r.tier, 'pro'); assert.equal(r.review, 'model'); assert.ok(r.left > 0);
  assert.match(asked[0], /product_id=prod123/); assert.ok(!/product_permalink/.test(asked[0])); assert.match(asked[0], /increment_uses_count=false/);
  await call(api.onRequestPost, env, { code: BUGGY }, LIC.toLowerCase());
  assert.equal(asked.length, 1, 'the answer is remembered (and the key is case-blind)');
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_licenses WHERE hash LIKE ?').get('%' + LIC + '%').n, 0, 'only a hash of the license is kept');
  purchase = { refunded: true };
  env.DB.db.prepare('UPDATE void_licenses SET checked = 0').run(); // hours later
  const after = await (await call(api.onRequestPost, env, { code: BUGGY }, LIC)).json();
  assert.equal(after.tier, 'free'); assert.match(after.note, /refunded/); assert.ok(after.findings.length, 'the free checks still run');
  assert.equal((await call(api.onRequestPost, env, { code: BUGGY }, 'FFFFFFFF-FFFFFFFF-FFFFFFFF-FFFFFFFF')).status, 401);
  const offer = await (await api.onRequestGet({ request: new Request('https://a-to-mind.com/api/review?offer'), env })).json();
  assert.equal(offer.standalone.url, 'https://moonbeam846.gumroad.com/l/dkmcjk'); assert.match(offer.included.url, /yinmj/);
});

test('before the catalog has seen the product, the license is checked by its permalink instead', async () => {
  const { askGumroad } = await import('../void-live-deploy/lib/products.js');
  let body = '';
  const r = await askGumroad('', 'A1B2C3D4-E5F60718-293A4B5C-6D7E8F90', async (u, init) => { body = String(init.body); return Response.json({ success: true, purchase: {} }); }, 'dkmcjk');
  assert.equal(r.ok, true); assert.match(body, /product_permalink=dkmcjk/); assert.ok(!/product_id/.test(body));
});

test('the owner always gets the closer read, free, with no daily cap', async () => {
  const env = await envWith({ ai: ai('owner read') });
  env.READ_TOKEN = 'owner-secret-0123456789';
  for (let i = 0; i < 3; i++) {
    const r = await (await call(api.onRequestPost, env, { code: BUGGY }, env.READ_TOKEN)).json();
    assert.equal(r.tier, 'owner'); assert.equal(r.review, 'model'); assert.equal(r.left, undefined);
  }
  const wrong = await (await call(api.onRequestPost, env, { code: BUGGY }, 'not-the-owner-key-000')).json();
  assert.equal(wrong.tier, 'free');
});
