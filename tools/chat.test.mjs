// Verse's chat: lib/chat-core.js (the key, the room, sealing and opening, the shapes) and the relay functions/api/chat.js with a FAKE D1 (node:sqlite).
// Run: node --test tools/chat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as C from '../void-live-deploy/lib/chat-core.js';
import * as route from '../void-live-deploy/functions/api/chat.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const ME = 'devAAAAAAAA1', YOU = 'devBBBBBBBB2';
test('a key is 43 base64url characters; its room is 32 hex, the same every time, and different for another key', async () => {
  const k = C.newKey(), k2 = C.newKey();
  assert.match(k, C.KEY_RE); assert.notEqual(k, k2);
  const r = await C.roomOf(k); assert.match(r, C.ROOM_RE); assert.equal(r, await C.roomOf(k)); assert.notEqual(r, await C.roomOf(k2));
  assert.ok(!r.includes(k.slice(0, 8)), 'the room does not carry the key');
  await assert.rejects(() => C.roomOf('short'));
});
test('encryption round trips: text, accents and emoji, a picture; every seal is different (a fresh IV)', async () => {
  const k = C.newKey();
  const m = { t: 'msg', id: 'msg0000001', from: ME, name: 'Ana', at: 1700000000000, text: 'Grüße 👋 — line one\nline two' };
  const a = await C.seal(k, m), b = await C.seal(k, m);
  assert.notEqual(a, b); assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(!a.includes('Ana') && !Buffer.from(a.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1').includes('line one'), 'the sealed text shows nothing of the words');
  assert.deepEqual(await C.open(k, a), m);
  const pic = { t: 'img', id: 'img0000001', from: YOU, name: 'Ben', at: 1, data: 'data:image/jpeg;base64,' + Buffer.from('jpegbytes').toString('base64'), w: 640, h: 480, cap: 'the view' };
  assert.deepEqual(await C.open(k, await C.seal(k, pic)), pic);
});
test('a wrong key, a changed byte or a cut message opens to null', async () => {
  const k = C.newKey(), s = await C.seal(k, { t: 'msg', id: 'msg0000001', from: ME, name: 'A', text: 'hi' });
  assert.equal(await C.open(C.newKey(), s), null);
  const flip = s.slice(0, 30) + (s[30] === 'A' ? 'B' : 'A') + s.slice(31);
  assert.equal(await C.open(k, flip), null);
  assert.equal(await C.open(k, s.slice(0, -4)), null);
  assert.equal(await C.open(k, 'not+base64url'), null);
});
test('only the known shapes pass, cleaned: no control or direction characters, names cut, bad pictures and calls dropped', async () => {
  assert.equal(C.clean({ t: 'msg', id: 'msg0000001', from: ME, text: '   ' }), null);
  assert.equal(C.clean({ t: 'script', from: ME }), null);
  assert.equal(C.clean({ t: 'msg', id: 'x', from: ME, text: 'hi' }), null, 'an id too short');
  const c = C.clean({ t: 'msg', id: 'msg0000001', from: ME, name: 'A‮B' + 'x'.repeat(80), text: 'a\u0000b‮c' });
  assert.equal(c.text, 'abc'); assert.equal(c.name.length, C.LIMITS.name); assert.ok(!c.name.includes('‮'));
  assert.equal(C.clean({ t: 'img', id: 'img0000001', from: ME, data: 'javascript:alert(1)' }), null);
  assert.equal(C.clean({ t: 'img', id: 'img0000001', from: ME, data: 'data:image/svg+xml;base64,PHN2Zz4=' }), null, 'no SVG: it can carry script');
  assert.equal(C.clean({ t: 'call', from: ME, kind: 'offer', cid: 'call000001', sdp: 'nope' }), null);
  assert.deepEqual(C.clean({ t: 'call', from: ME, name: 'A', kind: 'end', cid: 'call000001' }), { t: 'call', from: ME, name: 'A', at: 0, kind: 'end', cid: 'call000001', video: false });
  assert.equal(C.clean({ t: 'read', from: ME, upTo: -3 }), null);
});
test('the invite link carries the key in the fragment only, and reads back', () => {
  const k = C.newKey(), l = C.linkOf('https://a-to-mind.com', k, 'Family & friends');
  const u = new URL(l); assert.equal(u.pathname, '/chat/'); assert.equal(u.search, ''); assert.ok(u.hash.includes(k));
  assert.deepEqual(C.fromHash(u.hash), { key: k, title: 'Family & friends' });
  assert.equal(C.fromHash('#k=short'), null);
});
test('read receipts, members, a chat\'s name and search across chats', () => {
  const log = [{ t: 'msg', s: 1, from: ME, name: 'Ana', text: 'hello there', at: 1 }, { t: 'msg', s: 2, from: YOU, name: 'Ben', text: 'Café at noon?', at: 2 }, { t: 'msg', s: 3, from: ME, name: 'Ana', text: 'yes', at: 3 }, { t: 'read', s: 4, from: YOU, name: 'Ben', upTo: 1, at: 4 }, { t: 'read', s: 5, from: YOU, name: 'Ben', upTo: 3, at: 5 }];
  assert.deepEqual(C.readers(log, ME), { 1: ['Ben'], 3: ['Ben'] });
  assert.deepEqual(C.readers(log.slice(0, 4), ME), { 1: ['Ben'], 3: [] });
  assert.deepEqual(C.members(log).map((m) => m.name).sort(), ['Ana', 'Ben']);
  assert.equal(C.titleOf({ log }, ME), 'Ben'); assert.equal(C.titleOf({ log: [...log, { t: 'title', from: YOU, name: 'Ben', title: 'Lunch' }] }, ME), 'Lunch');
  assert.deepEqual(C.searchChats({ r1: { log } }, 'cafe NOON').map((x) => x.m.s), [2]);
  assert.deepEqual(C.searchChats({ r1: { log } }, ''), []);
});

// ---- the relay, with a FAKE D1 ----
function fakeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const world = (extra = {}) => { route.resetReady(); resetGuard(); return { DB: fakeDb(), SALT: 'test-salt', ...extra }; };
const post = (env, body, { ip = '1.2.3.4', origin = 'https://a-to-mind.com' } = {}) => route.onRequestPost({ env, request: new Request('https://a-to-mind.com/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': ip }, body: JSON.stringify(body) }) });
const get = (env, qs) => route.onRequestGet({ env, request: new Request('https://a-to-mind.com/api/chat?' + qs) });

test('the relay keeps sealed messages in order per room and gives back only those after a number', async () => {
  const env = world(), k = C.newKey(), r = await C.roomOf(k);
  const s1 = await C.seal(k, { t: 'msg', id: 'msg0000001', from: ME, name: 'Ana', text: 'one' }), s2 = await C.seal(k, { t: 'msg', id: 'msg0000002', from: YOU, name: 'Ben', text: 'two' });
  const a = await post(env, { r, c: s1 }); assert.equal(a.status, 201); assert.equal((await a.json()).s, 1);
  assert.equal((await (await post(env, { r, c: s2 }, { ip: '5.6.7.8' })).json()).s, 2);
  let j = await (await get(env, 'r=' + r + '&after=0')).json(); assert.deepEqual(j.msgs.map((m) => m.s), [1, 2]);
  assert.equal((await C.open(k, j.msgs[1].c)).text, 'two');
  j = await (await get(env, 'r=' + r + '&after=1')).json(); assert.deepEqual(j.msgs.map((m) => m.s), [2]);
  const other = await C.roomOf(C.newKey()); j = await (await get(env, 'r=' + other)).json(); assert.deepEqual(j.msgs, []);
  const rows = env.DB.raw.prepare('SELECT * FROM void_chat').all(); assert.ok(rows.every((x) => !/Ana|Ben|one|two/.test(x.c)), 'the server holds no words');
  const days = env.DB.raw.prepare('SELECT k FROM void_chat_days').all().map((x) => x.k); assert.ok(days.every((x) => !/1\.2\.3\.4|5\.6\.7\.8/.test(x)), 'no address is kept');
});
test('the relay refuses what is not a sealed message, a foreign page, and works only with D1 and SALT', async () => {
  const env = world(), r = 'a'.repeat(32), c = 'A'.repeat(60);
  assert.equal((await post(env, { r: 'bad', c })).status, 400);
  assert.equal((await post(env, { r, c: '<script>alert(1)</script>'.repeat(3) })).status, 400);
  assert.equal((await post(env, { r, c: 'A'.repeat(10) })).status, 400);
  assert.equal((await post(env, { r, c }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(world({ SALT: undefined }), { r, c })).status, 503);
  assert.equal((await get({}, 'r=' + r)).status, 503);
  assert.equal((await get(env, 'r=../x')).status, 400);
});
test('the relay\'s limits: 40 a minute per connection, pictures counted on their own, the day\'s cap in all', async () => {
  let env = world(); const r = 'b'.repeat(32), c = 'A'.repeat(60);
  for (let i = 0; i < route.RATES.perMinute; i++) assert.equal((await post(env, { r, c })).status, 201, 'message ' + i);
  const over = await post(env, { r, c }); assert.equal(over.status, 429); assert.ok(over.headers.get('retry-after'));
  assert.equal((await post(env, { r, c }, { ip: '9.9.9.9' })).status, 201, 'another connection still writes');
  env = world(); const big = 'A'.repeat(C.LIMITS.sealed + 10);
  env.DB.raw.exec("CREATE TABLE IF NOT EXISTS void_chat_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL, pics INTEGER NOT NULL)");
  await post(env, { r, c }); // makes the tables
  env.DB.raw.prepare('UPDATE void_chat_days SET pics = ? WHERE k = ?').run(route.RATES.allPics, 'all');
  assert.equal((await post(env, { r, c: big }, { ip: '7.7.7.7' })).status, 429, 'no picture past the day\'s pictures');
  assert.equal((await post(env, { r, c }, { ip: '7.7.7.7' })).status, 201, 'text still goes');
  assert.equal((await post(env, { r, c: 'A'.repeat(C.LIMITS.blob + 1) })).status, 413);
});
test('expired messages are swept on a write and never given out', async () => {
  const env = world(), r = 'c'.repeat(32), c = 'A'.repeat(60);
  await post(env, { r, c }); env.DB.raw.prepare('UPDATE void_chat SET exp = 1').run();
  assert.deepEqual((await (await get(env, 'r=' + r)).json()).msgs, []);
  await post(env, { r, c }, { ip: '2.2.2.2' });
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_chat').get().n, 1);
});
