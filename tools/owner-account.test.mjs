// functions/api/passkey.js ownerFor: the owner is an account, not one device (owner, 2026-10-14: "build me into it so I stop having
// to struggle to access my own site"). A passkey brings an owner session when it, or any passkey on its account, was bound.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ownerFor } from '../void-live-deploy/functions/api/passkey.js';
import { ownerSessionOk } from '../void-live-deploy/lib/guard.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => db.prepare(sql).run(...a), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  db.exec("CREATE TABLE void_passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL DEFAULT '', alg INTEGER NOT NULL DEFAULT -7, sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT, backed_up INTEGER, at TEXT NOT NULL DEFAULT '', used TEXT)");
  db.exec('CREATE TABLE void_owner_passkeys (id TEXT PRIMARY KEY, at TEXT NOT NULL)');
  return { prepare: (sql) => stmt(sql), raw: db };
}
test('every passkey on the owner account brings an owner session; nobody else gets one', async () => {
  const env = { DB: d1(), READ_TOKEN: 'k'.repeat(32), SALT: 's' };
  for (const [id, user] of [['phone-key', 'owner-acct'], ['laptop-key', 'owner-acct'], ['stranger-key', 'other-acct']]) env.DB.raw.prepare('INSERT INTO void_passkeys (id, user_id) VALUES (?, ?)').run(id, user);
  assert.equal(await ownerFor(env, 'laptop-key'), null, 'nothing bound yet: nobody is the owner');
  env.DB.raw.prepare("INSERT INTO void_owner_passkeys (id, at) VALUES ('phone-key', 'now')").run();
  const viaBound = await ownerFor(env, 'phone-key'), viaSibling = await ownerFor(env, 'laptop-key');
  assert.ok(viaBound && viaBound.token && (await ownerSessionOk(viaBound.token, env)), 'the bound passkey');
  assert.ok(viaSibling && viaSibling.token && (await ownerSessionOk(viaSibling.token, env)), 'another passkey on the same account (a new device)');
  assert.equal(await ownerFor(env, 'stranger-key'), null, 'a passkey on another account is never the owner');
  assert.equal(await ownerFor(env, 'no-such-key'), null);
});
