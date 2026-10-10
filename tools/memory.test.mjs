// Tests for Void's memory API (void-live-deploy/functions/api/memory.js) against a real SQLite (D1 is SQLite).
// Run: node --test tools/memory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/memory.js';
import { cleanRecord, MEMBER_MAX } from '../void-live-deploy/lib/memory-core.js';
import { ensureTables, newSession } from '../void-live-deploy/lib/void-me.js';

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

import { createHash } from 'node:crypto';
const sha = (t) => createHash('sha256').update(t).digest('hex');
const DIGEST = '# alpha\n\n- Backup state: **remote-current**\n\n## Recent commits\n- first\n- second\n\nunicode: café → ✓\n';

test('Void keeps the whole digest, and reports the hash of what it actually stored', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const r = await (await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ body: DIGEST })] } })).json();
  assert.deepEqual(r, { saved: 1, rejected: 0 });
  const got = (await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=alpha-1234abcd' })).json()).memory[0];
  assert.equal(got.body, DIGEST);
  assert.equal(got.body_sha256, sha(DIGEST), "Void's own hash of the stored text matches an independent SHA-256");
  const listed = (await (await call(api.onRequestGet, env)).json()).memory[0];
  assert.equal(listed.body, undefined, 'lists stay light: the body comes only from the exact lookup');
});

test('the stored body is re-redacted by the server, and its hash then differs from the sender\'s (so a sender cannot pass a leaky copy off as verified)', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const leaky = DIGEST + 'api_key = sk-abcdefghijklmnopqrstuvwxyz123456 and me@example.com\n';
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ body: leaky })] } });
  const got = (await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=alpha-1234abcd' })).json()).memory[0];
  assert.ok(!/sk-abc|me@example/.test(got.body), got.body);
  assert.notEqual(got.body_sha256, sha(leaky));
  assert.equal(got.body_sha256, sha(got.body));
});

test('an oversize digest is rejected, never silently cut', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const r = await (await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ body: 'x'.repeat(32769) }), rec({ id: 'ok-1', body: 'x'.repeat(32768) })] } })).json();
  assert.deepEqual(r, { saved: 1, rejected: 1 });
});

test('a record sent again with a new digest replaces the old one, and a table made before the body column existed gains it', async () => {
  const db = d1();
  db.raw.exec('CREATE TABLE void_memory (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, summary TEXT NOT NULL, links TEXT NOT NULL, state TEXT NOT NULL, remote TEXT NOT NULL, last_commit TEXT NOT NULL, digest TEXT NOT NULL, sha256 TEXT NOT NULL, source TEXT NOT NULL, at TEXT NOT NULL, updated TEXT NOT NULL)');
  const env = { READ_TOKEN: TOKEN, DB: db };
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ body: 'one' })] } });
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ body: 'two' })] } });
  const got = (await (await call(api.onRequestGet, env, { url: 'https://x/api/memory?id=alpha-1234abcd' })).json()).memory[0];
  assert.equal(got.body, 'two');
  assert.equal(got.body_sha256, sha('two'));
});

test('organize: topics group projects by shared tech (file types ignored); related ranks the projects that share the most with one', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const R = (id, links) => rec({ id, name: id, links });
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [
    R('shop', ['react', 'stripe', 'node', 'md']), R('blog', ['react', 'node', 'md']), R('game', ['unity', 'cs', 'md']), R('bot', ['node', 'discord', 'json']) ] } });
  const get = async (q) => (await call(api.onRequestGet, env, { url: 'https://x/api/memory?' + q }));
  const topics = (await (await get('view=topics')).json()).topics;
  const by = Object.fromEntries(topics.map((t) => [t.tag, t.count]));
  assert.equal(by.node, 3);
  assert.equal(by.react, 2);
  assert.equal(by.md, undefined, 'file-type tags are not topics');
  assert.equal(topics[0].tag, 'node', 'biggest group first');
  const rel = (await (await get('related=shop')).json()).related;
  assert.deepEqual(rel.map((r) => r.name), ['blog', 'bot'], 'game shares nothing real with shop, so it is left out');
  assert.deepEqual(rel[0].shared.sort(), ['node', 'react']);
  assert.ok(rel[0].score > rel[1].score);
  assert.equal((await get('related=nope')).status, 404);
  assert.equal((await call(api.onRequestGet, env, { url: 'https://x/api/memory?view=topics', auth: false })).status, 401);
});

import { LIMITS, guard } from '../void-live-deploy/lib/guard.js';
import { MAX_BODY } from '../void-live-deploy/lib/memory-core.js';
test('the guard lets a full-size push through: /api/memory has its own limit, at least as big as the body the route accepts', async () => {
  assert.ok(LIMITS.memory, 'without an entry the guard falls back to a 16 KB cap and refuses real pushes with 413');
  assert.ok(LIMITS.memory.body >= MAX_BODY, `guard body cap ${LIMITS.memory.body} < route cap ${MAX_BODY}`);
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const big = { records: Array.from({ length: 12 }, (_, i) => rec({ id: 'p' + i, body: 'x'.repeat(16000) })) }; // ~190 KB, what ouroboros sends in one request
  const res = await guard({ env, request: new Request('https://x/api/memory', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(big) }), next: (req) => api.onRequestPost({ env, request: req }) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { saved: 12, rejected: 0 });
});

test('ask: a plain question gets a plain answer from what Void remembers, filler words ignored, partial matches ranked', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec(), rec({ id: 'beta-1234abcd', name: 'beta', summary: 'Rust parser.', links: ['rust'], remote: '' })] } });
  const get = async (q) => (await call(api.onRequestGet, env, { url: 'https://x/api/memory?ask=' + encodeURIComponent(q) })).json();
  const a = await get('what did I build with react?');
  assert.deepEqual(a.matches, ['alpha-1234abcd']);
  assert.match(a.answer, /alpha/);
  const b = await get('rust and react');
  assert.equal(b.matches.length, 2, 'no project has both words, so both partial matches come back');
  assert.match((await get('rust')).answer, /no remote copy/);
  assert.match((await get('zzzz')).answer, /Nothing I remember/);
  assert.deepEqual((await get('')).matches, []);
});

// ---- members: a paid member's session reads and writes only their own memory; a free account and a stranger get nothing
async function account(env, userId, tier) {
  await ensureTables(env);
  const { token, stmt } = await newSession(env, userId); await stmt.run();
  if (tier) await env.DB.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, NULL, ?)').bind(userId, tier, 'sale-' + userId, new Date().toISOString()).run();
  return token;
}
const as = (token, fn, env, o = {}) => fn({ env, request: new Request(o.url || 'https://x/api/memory', { method: o.method || 'GET', headers: { authorization: 'Bearer ' + token }, body: o.body == null ? undefined : JSON.stringify(o.body) }) });

test('members: owner, paid member, free member and stranger each get what they should, and nobody reaches another\'s rows', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const ann = await account(env, 'annAnnAnnAnnAnnAnnAnn', 'paid'), bob = await account(env, 'bobBobBobBobBobBobBob', 'paid'), free = await account(env, 'freeFreeFreeFreeFreeFr', 'free'), nobody = await account(env, 'noneNoneNoneNoneNoneNo', null);
  await call(api.onRequestPost, env, { method: 'POST', body: { records: [rec({ id: 'owner-1', name: 'ownerthing', links: ['react'] })] } });
  assert.equal((await as(ann, api.onRequestPost, env, { method: 'POST', body: { records: [rec({ id: 'shared-id', name: 'annsapp', links: ['react'] })] } })).status, 200);
  assert.equal((await as(bob, api.onRequestPost, env, { method: 'POST', body: { records: [rec({ id: 'shared-id', name: 'bobsapp', links: ['react'] })] } })).status, 200);
  const ask = (who, q = 'what did I build with react') => (who === 'owner' ? call(api.onRequestGet, env, { url: 'https://x/api/memory?ask=' + encodeURIComponent(q) }) : as(who, api.onRequestGet, env, { url: 'https://x/api/memory?ask=' + encodeURIComponent(q) }));
  const a = await (await ask(ann)).json(), b = await (await ask(bob)).json(), o = await (await ask('owner')).json();
  assert.deepEqual(a.matches, ['shared-id']); assert.match(a.answer, /annsapp/); assert.ok(!/bobsapp|ownerthing/.test(a.answer), 'ann sees only her own');
  assert.deepEqual(b.matches, ['shared-id']); assert.match(b.answer, /bobsapp/); assert.ok(!/annsapp|ownerthing/.test(b.answer));
  assert.deepEqual(o.matches, ['owner-1'], 'the owner\'s memory holds none of the members\' rows'); assert.ok(!/annsapp|bobsapp/.test(o.answer));
  assert.equal((await ask(free)).status, 403, 'a free account is told this is for paid members');
  assert.equal((await ask(nobody)).status, 403, 'a signed-in account with no purchase is free');
  assert.equal((await as('x'.repeat(43), api.onRequestGet, env, { url: 'https://x/api/memory?ask=react' })).status, 401, 'a stranger with a made-up session');
  assert.equal((await call(api.onRequestGet, env, { auth: false, url: 'https://x/api/memory?ask=react' })).status, 401, 'no key at all');
  assert.equal((await as(free, api.onRequestPost, env, { method: 'POST', body: { records: [rec({ id: 'f' })] } })).status, 403, 'a free account cannot write');
  // a member's exact lookup, topics and delete reach only their own rows; the same id in another member's memory is untouched
  const mine = await (await as(ann, api.onRequestGet, env, { url: 'https://x/api/memory?id=shared-id' })).json();
  assert.equal(mine.memory[0].name, 'annsapp'); assert.equal(mine.memory[0].id, 'shared-id');
  assert.equal((await (await as(ann, api.onRequestGet, env, { url: 'https://x/api/memory?id=owner-1' })).json()).memory.length, 0, 'a member cannot read the owner\'s record by id');
  assert.equal((await (await as(ann, api.onRequestDelete, env, { method: 'DELETE', url: 'https://x/api/memory?id=owner-1' })).json()).removed, 0, 'nor delete it');
  assert.equal((await (await as(ann, api.onRequestDelete, env, { method: 'DELETE', url: 'https://x/api/memory?id=shared-id' })).json()).removed, 1);
  assert.deepEqual((await (await ask(bob)).json()).matches, ['shared-id'], 'bob\'s record with the same id survives ann\'s delete');
  assert.deepEqual((await (await as(bob, api.onRequestGet, env, { url: 'https://x/api/memory?view=topics' })).json()).topics.map((t) => t.tag + ':' + t.count), ['react:1'], 'topics count only the member\'s own rows');
  // a member cannot rename themselves into the owner's rows: an id shaped like the owner's is still stored behind the member's own prefix
  await as(bob, api.onRequestPost, env, { method: 'POST', body: { records: [rec({ id: 'owner-1', name: 'hijack' })] } });
  assert.match((await (await ask('owner', 'ownerthing')).json()).answer, /ownerthing/); assert.deepEqual((await (await ask('owner', 'hijack')).json()).matches, [], 'the owner never sees the member\'s row');
});

test('members: a member\'s memory is capped, and the route\'s guard limit still covers a member push', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const ann = await account(env, 'annAnnAnnAnnAnnAnnAnn', 'paid');
  const many = (from, n) => Array.from({ length: n }, (_, i) => rec({ id: 'p' + (from + i), name: 'proj' + (from + i) }));
  for (let at = 0; at < MEMBER_MAX; at += 100) assert.equal((await as(ann, api.onRequestPost, env, { method: 'POST', body: { records: many(at, 100) } })).status, 200);
  const over = await as(ann, api.onRequestPost, env, { method: 'POST', body: { records: many(MEMBER_MAX, 1) } });
  assert.equal(over.status, 413); assert.match(await over.text(), /full/);
});
