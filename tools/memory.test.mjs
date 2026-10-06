// Tests for Void's memory API (void-live-deploy/functions/api/memory.js) against a real SQLite (D1 is SQLite).
// Run: node --test tools/memory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/memory.js';
import { cleanRecord } from '../void-live-deploy/lib/memory-core.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), batch: async (l) => { for (const q of l) db.prepare(q.sql).run(...q.a); return []; }, raw: db };
}
const call = (fn, env, { method = 'GET', url = 'https://x/api/memory', body, auth = true } = {}) =>
  fn({ env, request: new Request(url, { method, headers: auth ? { authorization: 'Bearer ' + TOKEN } : {}, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }) });
const rec = (o = {}) => ({ id: 'alpha-1234abcd', name: 'alpha', summary: 'A tiny tool.', links: ['React', 'py'], state: 'remote-current', remote: 'https://github.com/o/alpha', last_commit: '2025-01-01T00:00:00+00:00', digest: 'alpha-1234abcd/digest.md', sha256: 'a'.repeat(64), ...o });

test('owner only: no token, wrong token, and no database all refuse', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  assert.equal((await call(api.onRequestGet, env, { auth: false })).status, 401);
  assert.equal((await call(api.onRequestPost, { ...env, READ_TOKEN: 'other-token-0000000000000000' }, { method: 'POST', body: { records: [rec()] } })).status, 401);
  assert.equal((await call(api.onRequestGet, { READ_TOKEN: TOKEN })).status, 503);
  assert.equal((await call(api.onRequestGet, { DB: d1() })).status, 401, 'fails closed without READ_TOKEN');
});

test('save is an upsert: the same id twice is one row, the second write wins', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  let r = await (await call(api.onRequestPost, env, { method: 'POST', body: { source: 'ouroboros', records: [rec()] } })).json();
  assert.deepEqual(r, { saved: 1, rejected: 0 });
  r = await (await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ summary: 'Changed.' })] } })).json();
  assert.equal(r.saved, 1);
  const got = (await (await call(api.onRequestGet, env)).json()).memory;
  assert.equal(got.length, 1);
  assert.equal(got[0].summary, 'Changed.');
  assert.deepEqual(got[0].links, ['react', 'py']);
});

test('bad records are rejected and counted, good ones in the same batch still save', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const r = await (await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec(), rec({ id: '../etc/passwd' }), rec({ id: 'x', state: 'weird' }), rec({ id: 'y', name: '  ' }), null, 'str'] } })).json();
  assert.deepEqual(r, { saved: 1, rejected: 5 });
});

test('the server redacts secrets itself, whatever the sender did', () => {
  const c = cleanRecord(rec({ summary: 'key sk-abcdefghijklmnopqrstuvwxyz123456 and me@example.com, password = hunter2hunter2', remote: 'https://user:pw12345@github.com/o/r' }));
  assert.ok(!/sk-abc|me@example|hunter2|pw12345/.test(JSON.stringify(c)), JSON.stringify(c));
});

test('size and shape limits', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  assert.equal((await call(api.onRequestPost, env, { method: 'POST', body: 'x'.repeat(262145) })).status, 413);
  assert.equal((await call(api.onRequestPost, env, { method: 'POST', body: '{nope' })).status, 400);
  assert.equal((await call(api.onRequestPost, env, { method: 'POST', body: { records: Array.from({ length: 201 }, (_, i) => rec({ id: 'r' + i })) } })).status, 400);
  assert.equal((await call(api.onRequestPost, env, { method: 'POST', body: { nope: 1 } })).status, 400);
});

test('search: every word must match, wildcards are literal, newest first, limit is capped', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec(), rec({ id: 'beta', name: 'beta', summary: '100% rebuilt dashboard', links: ['vue'] })] } });
  const q = async (s, extra = '') => (await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?q=' + encodeURIComponent(s) + extra })).json()).memory.map((m) => m.name);
  assert.deepEqual(await q('react'), ['alpha']);
  assert.deepEqual(await q('tiny react'), ['alpha']);
  assert.deepEqual(await q('tiny vue'), []);
  assert.deepEqual(await q('%'), ['beta'], '% is matched literally, not as a wildcard');
  assert.deepEqual(await q('_'), [], '_ is literal too');
  assert.equal((await q('', '&limit=1')).length, 1);
  assert.equal((await q('', '&limit=9999')).length, 2);
});

test('forget removes one record', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec()] } });
  assert.deepEqual(await (await call(api.onRequestDelete, env, { method: 'DELETE', url: 'https://x/api/memory?id=alpha-1234abcd' })).json(), { removed: 1 });
  assert.equal((await call(api.onRequestDelete, env, { method: 'DELETE' })).status, 400);
  assert.equal((await (await call(api.onRequestGet, env)).json()).memory.length, 0);
});

test('exact lookup by id returns the record with its sha256 (what a client checks before it lets go of a source)', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec(), rec({ id: 'beta', name: 'beta' })] } });
  const one = (await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=alpha-1234abcd' })).json()).memory;
  assert.equal(one.length, 1);
  assert.equal(one[0].id, 'alpha-1234abcd');
  assert.equal(one[0].sha256, 'a'.repeat(64));
  assert.deepEqual((await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=nope' })).json()).memory, []);
  assert.equal((await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=alpha-1234abcd', auth: false })).status, 401);
  const listed = (await (await call(api.onRequestGet, env)).json()).memory;
  assert.ok(listed.every((m) => m.sha256 !== undefined), 'search results carry sha256 too');
});
