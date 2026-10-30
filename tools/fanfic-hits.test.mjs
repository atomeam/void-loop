// /fanfic/ hits: functions/api/fanfic-hits.js with a FAKE D1 (node:sqlite). Real reads only, one a visitor a story a day, no address kept,
// bots and unknown stories never counted, the count atomic. Run: node --test tools/fanfic-hits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as H from '../void-live-deploy/functions/api/fanfic-hits.js';
import * as F from '../void-live-deploy/lib/fanfic.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const DAY = 864e5, T0 = Date.UTC(2026, 9, 29, 12);
const READER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
function world() {
  H.resetReady();
  const DB = d1();
  DB.raw.exec('CREATE TABLE void_boards (code TEXT PRIMARY KEY, title TEXT NOT NULL, about TEXT NOT NULL)');
  DB.raw.exec('CREATE TABLE void_board_posts (board TEXT NOT NULL, no INTEGER NOT NULL, thread INTEGER NOT NULL, body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (board, no))');
  DB.raw.exec("INSERT INTO void_boards VALUES ('ficink', 'Ink', 'Fan fiction'), ('tech', 'Technology', 'Computers')");
  const add = DB.raw.prepare('INSERT INTO void_board_posts (board, no, thread, body, hidden, deleted) VALUES (?, ?, ?, ?, ?, ?)');
  add.run('ficink', 1, 1, 'A story.', 0, 0); add.run('ficink', 2, 1, 'A reply.', 0, 0); add.run('ficink', 3, 3, 'Hidden.', 1, 0);
  add.run('ficink', 4, 4, 'Deleted.', 0, 1); add.run('ficink', 5, 5, F.challengeBody('Write a ghost story.'), 0, 0); add.run('tech', 1, 1, 'Not fiction.', 0, 0);
  add.run('ficink', 6, 6, 'Another story.', 0, 0);
  return { DB, SALT: 'test-salt' };
}
const hit = (env, b, t, { ip = '203.0.113.7', ua = READER, now = T0 } = {}) => H.onRequestPost({ env, now, request: new Request('https://verse.test/api/fanfic-hits?b=' + b + '&t=' + t, { method: 'POST', headers: { 'cf-connecting-ip': ip, 'user-agent': ua } }) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const get = (env, ids) => H.onRequestGet({ env, request: new Request('https://verse.test/api/fanfic-hits?ids=' + ids) }).then((r) => r.json());

test('one read counts 1; the same visitor, story and day never counts again; a new day or another visitor counts', async () => {
  const env = world();
  assert.deepEqual(await hit(env, 'ficink', 1), { status: 200, ok: true, hits: 1, counted: true });
  assert.deepEqual(await hit(env, 'ficink', 1, { now: T0 + 3600e3 }), { status: 200, ok: true, hits: 1, counted: false }, 'the same day, the same reader');
  assert.equal((await hit(env, 'ficink', 1, { ip: '198.51.100.9' })).hits, 2, 'another reader');
  assert.equal((await hit(env, 'ficink', 1, { now: T0 + DAY })).hits, 3, 'the next day');
  assert.equal((await hit(env, 'ficink', 6)).hits, 1, 'another story keeps its own count');
});

test('bots, empty agents, unknown, hidden, deleted, non-fiction and challenge posts are never counted', async () => {
  const env = world();
  for (const ua of ['', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.5.0', 'Mozilla/5.0 HeadlessChrome/130.0', 'python-requests/2.32', 'facebookexternalhit/1.1']) {
    const r = await hit(env, 'ficink', 1, { ua }); assert.equal(r.counted, false, ua); assert.equal(r.hits, 0, ua);
  }
  assert.equal(H.isBotAgent(READER), false);
  for (const [b, t] of [['ficink', 99], ['ficink', 2], ['ficink', 3], ['ficink', 4], ['ficink', 5], ['tech', 1]]) assert.equal((await hit(env, b, t)).status, 404, b + '/' + t);
  for (const [b, t] of [['', 1], ['FIC', 1], ['ficink', 0], ['ficink', 'x'], ['a/b', 1]]) assert.equal((await hit(env, encodeURIComponent(b), t)).status, 400, b + '/' + t);
  assert.equal((await H.onRequestPost({ env: { DB: env.DB }, now: T0, request: new Request('https://verse.test/api/fanfic-hits?b=ficink&t=1', { method: 'POST' }) })).status, 503, 'no salt, no counting');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_fanfic_hits').get().n, 0, 'nothing was stored');
});

test('one connection is held to the route limit a minute', async () => {
  const env = world();
  for (let i = 0; i < H.RATE_MIN; i++) assert.notEqual((await hit(env, 'ficink', 1, { now: T0 + i })).status, 429, 'read ' + (i + 1));
  assert.equal((await hit(env, 'ficink', 6, { now: T0 + 100 })).status, 429, 'over the limit, even for another story');
  assert.equal((await hit(env, 'ficink', 6, { now: T0 + 60e3 })).counted, true, 'the next minute is open again');
  assert.deepEqual(LIMITS['fanfic-hits'], { rpm: 60, body: 0 }, 'the guard limits the route too');
});

test('no address and no lasting visitor key is kept', async () => {
  const env = world(), ip = '203.0.113.77';
  await hit(env, 'ficink', 1, { ip }); await hit(env, 'ficink', 6, { ip });
  for (const t of ['void_fanfic_hits', 'void_fanfic_hit_seen', 'void_fanfic_hit_rate']) {
    const dump = JSON.stringify(env.DB.raw.prepare('SELECT * FROM ' + t).all());
    assert.ok(!dump.includes(ip) && !dump.includes('203.0.113'), t + ' keeps no address');
  }
  const k1 = await H.dayKey(env, 1, 'seen|' + ip + '|ficink/1'), k2 = await H.dayKey(env, 2, 'seen|' + ip + '|ficink/1'), k3 = await H.dayKey(env, 1, 'seen|' + ip + '|ficink/6');
  assert.notEqual(k1, k2, 'a new key every day'); assert.notEqual(k1, k3, 'a new key for every story'); assert.match(k1, /^[0-9a-f]{32}$/);
  assert.notEqual(await H.dayKey({ SALT: 'other' }, 1, 'seen|' + ip + '|ficink/1'), k1, 'the key needs the server secret');
});

test('reads at the same moment count once; the count is one atomic step', async () => {
  const env = world();
  const rs = await Promise.all(Array.from({ length: 8 }, () => hit(env, 'ficink', 1)));
  assert.equal(rs.filter((r) => r.counted).length, 1); assert.equal(env.DB.raw.prepare("SELECT n FROM void_fanfic_hits WHERE board = 'ficink' AND no = 1").get().n, 1);
  const many = await Promise.all(Array.from({ length: 8 }, (_, i) => hit(env, 'ficink', 6, { ip: '198.51.100.' + (i + 1) })));
  assert.equal(many.filter((r) => r.counted).length, 8); assert.equal(env.DB.raw.prepare("SELECT n FROM void_fanfic_hits WHERE board = 'ficink' AND no = 6").get().n, 8);
});

test('GET reads counts for up to 100 stories and leaves out stories never read', async () => {
  const env = world();
  await hit(env, 'ficink', 1); await hit(env, 'ficink', 1, { ip: '198.51.100.2' });
  assert.deepEqual(await get(env, 'ficink/1,ficink/6,bad,ficink/1'), { ok: true, hits: { 'ficink/1': 2 } });
  assert.deepEqual(await get(env, ''), { ok: true, hits: {} });
  assert.deepEqual(await get(env, Array.from({ length: 150 }, (_, i) => 'ficink/' + (i + 1)).join(',')), { ok: true, hits: { 'ficink/1': 2 } });
});

test('rows and the story page show hits only when there are some', async () => {
  const s = F.storyOf({ no: 1, at: 100, name: 'Ink', trip: '', sub: 'T', body: 'One two three.' }, []);
  assert.ok(F.rowFigures(s, 12).includes('12 hits')); assert.ok(F.rowFigures(s, 1).includes('1 hit'));
  assert.ok(!F.rowFigures(s, 0).some((x) => /hit/.test(x)), 'no reads, no figure'); assert.ok(!F.rowFigures(s).some((x) => /hit/.test(x)));
  const DE = await import('../void-live-deploy/lib/fanfic-de.js');
  assert.equal(DE.de('3 hits'), '3 Aufruf(e)'); assert.equal(DE.de('Hits'), 'Aufrufe');
});
