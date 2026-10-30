// One owner identity (owner, 2026-10-30: "make it to where i have access to everything stop locking me out of things").
// lib/guard.js ownerOk is the one server-side owner check: the key, an owner session, or a signed-in session of the owner's account.
// A member's session is never the owner. /api/passkey 'owner' hands the owner's account a fresh owner session, and
// 'owner-bind-account' (key only) makes a whole signed-in account the owner's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ownerOk, ownerAccount, ownerAccountSession, ownerSessionOk } from '../void-live-deploy/lib/guard.js';
import { newSession } from '../void-live-deploy/lib/void-me.js';
import { onRequestPost } from '../void-live-deploy/functions/api/passkey.js';

const KEY = 'k'.repeat(40);
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  db.exec("CREATE TABLE void_passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL DEFAULT '', alg INTEGER NOT NULL DEFAULT -7, sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT, backed_up INTEGER, at TEXT NOT NULL DEFAULT '', used TEXT)");
  db.exec('CREATE TABLE void_owner_passkeys (id TEXT PRIMARY KEY, at TEXT NOT NULL)');
  db.exec('CREATE TABLE void_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, at TEXT NOT NULL, expires INTEGER NOT NULL)');
  return { prepare: (sql) => stmt(sql), batch: async (s) => Promise.all(s.map((x) => x.run())), exec: async (sql) => db.exec(sql), raw: db };
}
async function world() {
  const env = { DB: d1(), READ_TOKEN: KEY, SALT: 's' };
  for (const [id, user] of [['owner-phone', 'owner-acct'], ['owner-laptop', 'owner-acct'], ['member-key', 'member-acct']]) env.DB.raw.prepare('INSERT INTO void_passkeys (id, user_id) VALUES (?, ?)').run(id, user);
  env.DB.raw.prepare("INSERT INTO void_owner_passkeys (id, at) VALUES ('owner-phone', 'now')").run();
  const owner = await newSession(env, 'owner-acct'), member = await newSession(env, 'member-acct');
  await owner.stmt.run(); await member.stmt.run();
  return { env, owner: owner.token, member: member.token };
}
const req = (tok, body) => new Request('https://a-to-mind.com/api/passkey', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': 'test-' + Math.random(), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
const call = async (env, tok, body) => { const r = await onRequestPost({ request: req(tok, body), env }); return { status: r.status, j: await r.json().catch(() => null) }; };

test('ownerOk: the key and the owner account session pass; a member session, no token and a wrong key fail', async () => {
  const { env, owner, member } = await world();
  assert.equal(await ownerOk(req(KEY), env), true, 'the key is a fallback, never removed');
  assert.equal(await ownerOk(req(owner), env), true, 'the owner, signed in with a passkey on their account');
  assert.equal(await ownerOk(req(member), env), false, 'a member is never the owner');
  assert.equal(await ownerOk(req(null), env), false);
  assert.equal(await ownerOk(req('x'.repeat(44)), env), false);
  assert.equal(await ownerAccount(env, 'owner-acct'), true);
  assert.equal(await ownerAccount(env, 'member-acct'), false);
});

test('an expired owner session is not the owner; a broken database fails closed', async () => {
  const { env, owner } = await world();
  env.DB.raw.prepare('UPDATE void_sessions SET expires = 1').run();
  assert.equal(await ownerAccountSession(owner, env), null);
  assert.equal(await ownerOk(req(owner), env), false);
  const broken = { READ_TOKEN: KEY, SALT: 's', DB: { prepare: () => { throw new Error('d1 down'); } } };
  assert.equal(await ownerOk(req(owner), broken), false);
  assert.equal(await ownerOk(req(KEY), broken), true, 'the key still works when D1 does not');
});

test("passkey 'owner' gives the owner account a fresh owner session, and a member a 401", async () => {
  const { env, owner, member } = await world();
  const ok = await call(env, owner, { step: 'owner' });
  assert.equal(ok.status, 200);
  assert.ok(ok.j.session && /^vo1\./.test(ok.j.session.token), 'an owner session comes back');
  assert.equal(await ownerSessionOk(ok.j.session.token, env), true);
  assert.equal(await ownerOk(req(ok.j.session.token), env), true, 'every page that reads the owner token now opens');
  assert.equal((await call(env, member, { step: 'owner' })).status, 401);
});

test("passkey 'tier' says owner for the owner account only", async () => {
  const { env, owner, member } = await world();
  const o = await call(env, owner, { step: 'tier' }), m = await call(env, member, { step: 'tier' });
  assert.deepEqual([o.j.tier, o.j.owner], ['paid', true]);
  assert.deepEqual([m.j.tier, m.j.owner], ['free', false]);
});

test("'owner-bind-account': only the key binds a signed-in account, and then every passkey on it is the owner's", async () => {
  const { env, member } = await world();
  assert.equal((await call(env, member, { step: 'owner-bind-account', session: member })).status, 401, 'an account cannot bind itself');
  assert.equal((await call(env, KEY, { step: 'owner-bind-account', session: 'nope' })).status, 400);
  const r = await call(env, KEY, { step: 'owner-bind-account', session: member });
  assert.equal(r.status, 200);
  assert.deepEqual([r.j.owner, r.j.bound], [true, 1]);
  assert.equal(await ownerOk(req(member), env), true, 'that account is the owner now');
});

test('an account the owner named (env.OWNER_ACCOUNTS) is the owner with no passkey bound; a bad or other id is not', async () => {
  const { env, member } = await world();
  assert.equal(await ownerOk(req(member), env), false);
  env.OWNER_ACCOUNTS = ' x , member-acct-0000000001 ';
  assert.equal(await ownerOk(req(member), env), false, 'member-acct is not named');
  const w = await world();
  w.env.OWNER_ACCOUNTS = 'member-acct';
  assert.equal(await ownerAccount(w.env, 'member-acct'), false, 'too short to be an account id');
  const id = 'Abc_DEF-ghij0123456789';
  w.env.DB.raw.prepare('INSERT INTO void_passkeys (id, user_id) VALUES (?, ?)').run('named-key', id);
  const s = await newSession(w.env, id); await s.stmt.run();
  assert.equal(await ownerOk(req(s.token), w.env), false, 'not named yet');
  w.env.OWNER_ACCOUNTS = 'other-acct-00000000000,' + id;
  assert.equal(await ownerOk(req(s.token), w.env), true, 'named: a live session of it is the owner');
  assert.equal(await ownerOk(req(w.member), w.env), false, 'other accounts still are not');
  w.env.DB.raw.prepare('UPDATE void_sessions SET expires = 1').run();
  assert.equal(await ownerOk(req(s.token), w.env), false, 'only a live session counts');
});
