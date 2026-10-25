// Comments: lib/comments.js (the rules and the signed sum) and functions/api/comments.js (with a FAKE D1). Run: node --test tools/comments.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as C from '../void-live-deploy/lib/comments.js';
import * as route from '../void-live-deploy/functions/api/comments.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql), raw: db }; }
const SALT = 'test-salt', KEY = 'owner-key-for-tests-only'; // secret-scan: ok (made-up values for the test)
function world() { store.clear(); resetGuard(); route.resetReady(); const DB = d1(); DB.raw.exec('CREATE TABLE void_gens (id TEXT PRIMARY KEY, reports INTEGER DEFAULT 0)'); DB.raw.prepare('INSERT INTO void_gens (id) VALUES (?)').run('abcdefgh'); return { DB, SALT, READ_TOKEN: KEY }; }
const answer = (q) => { const [, a, b] = q.match(/(\d) \+ (\d)/); return String(+a + +b); };
const oldCheck = async () => { const c = await C.newCheck(SALT, Date.now() - 5000); return { token: c.token, answer: answer(c.q) }; };
const post = async (env, b, ip = '203.0.113.60') => (await route.onRequestPost({ env, request: new Request('https://x/api/comments', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(b) }) })).json();
const get = async (env, thread) => (await route.onRequestGet({ env, request: new Request('https://x/api/comments?thread=' + thread) })).json();

test('the sum: signed, not before 3 seconds, not after a day, the right answer only', async () => {
  const c = await C.newCheck(SALT, 1e12, 'k3x9a2'); assert.match(c.q, /^What is \d \+ \d\?$/);
  assert.equal(await C.checkOk(SALT, c.token, answer(c.q), 1e12 + 4000), '');
  assert.match(await C.checkOk(SALT, c.token, answer(c.q), 1e12 + 1000), /quicker than a person/);
  assert.match(await C.checkOk(SALT, c.token, answer(c.q), 1e12 + 2 * 864e5), /old/);
  assert.match(await C.checkOk(SALT, c.token, '99', 1e12 + 4000), /not the answer/);
  assert.match(await C.checkOk('other-salt', c.token, answer(c.q), 1e12 + 4000), /not the answer/, 'a page cannot sign its own');
});
test('what is refused: links, rude words, keys, noise; names and text cut to size', () => {
  assert.match(C.commentProblem('a', 'see https://spam.example'), /links/); assert.match(C.commentProblem('a', 'buy at cheap.shop now'), /links/);
  assert.match(C.commentProblem('a', 'you nazi'), /not something/); assert.match(C.commentProblem('a', 'aaaaaaaaaaaaaaaaaaaaa'), /noise/);
  assert.equal(C.commentProblem('a', 'Lovely generator, thanks!'), ''); assert.equal(C.cleanName('  <b>Ann</b>  '), 'bAnn/b'); assert.equal(C.cleanName(''), 'Anonymous');
});
test('the route: post under a published generator and under /image/, read back as text; bots, unknown threads and fast posts are turned away', async () => {
  const env = world();
  const r = await post(env, { act: 'post', thread: 'gen:abcdefgh', name: 'Ann', text: 'Great one!\nThanks', ...(await oldCheck()) }); assert.equal(r.ok, true);
  assert.equal((await post(env, { act: 'post', thread: 'image', text: 'Pretty foxes', ...(await oldCheck()) }, '203.0.113.61')).ok, true);
  const g = await get(env, 'gen:abcdefgh'); assert.deepEqual(g.items.map((c) => [c.name, c.text]), [['Ann', 'Great one!\nThanks']]); assert.match(g.check.q, /What is/);
  assert.equal((await post(env, { act: 'post', thread: 'gen:zzzzzzzz', text: 'hi', ...(await oldCheck()) }, '1.1.1.2')).error, 'not a thread');
  const bot = await post(env, { act: 'post', thread: 'image', text: 'spam', website: 'x', ...(await oldCheck()) }, '1.1.1.3'); assert.equal(bot.ok, true);
  assert.equal((await get(env, 'image')).items.length, 1, 'the bot was told yes and nothing was kept');
  const fresh = await C.newCheck(SALT); assert.match((await post(env, { act: 'post', thread: 'image', text: 'hi', token: fresh.token, answer: answer(fresh.q) }, '1.1.1.4')).error, /quicker/);
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_comments_days').all()).includes('203.0.113.60'), 'no address stored');
});
test('limits, reports and the owner', async () => {
  const env = world();
  for (let i = 0; i < route.POST_MINUTE; i++) assert.equal((await post(env, { act: 'post', thread: 'image', text: 'comment ' + i, ...(await oldCheck()) })).ok, true);
  assert.match((await post(env, { act: 'post', thread: 'image', text: 'one more', ...(await oldCheck()) })).error, /slow down/);
  const id = (await get(env, 'image')).items[0].id;
  for (const ip of ['10.3.0.1', '10.3.0.1', '10.3.0.2']) await post(env, { act: 'report', id }, ip);
  assert.equal((await get(env, 'image')).items.length, 2); await post(env, { act: 'report', id }, '10.3.0.3'); assert.equal((await get(env, 'image')).items.length, 1);
  const other = (await get(env, 'image')).items[0].id;
  const del = (k) => route.onRequestDelete({ env, request: new Request('https://x/api/comments?id=' + other, { method: 'DELETE', headers: k ? { authorization: 'Bearer ' + k } : {} }) });
  assert.equal((await del('x')).status, 401); assert.equal((await del(KEY)).status, 200); assert.equal((await get(env, 'image')).items.length, 0);
});
test('the widget (lib/comments-ui.js): nothing to mount on is a no-op; the full form is driven in a real browser by tools/generators-e2e.mjs', async () => {
  const { mountComments } = await import('../void-live-deploy/lib/comments-ui.js');
  assert.equal(mountComments(null, 'image'), undefined);
});
test('the forum: a topic with its first post, replies keep it on top, three reports hide it, the owner deletes it with its posts', async () => {
  const env = world();
  const t = await post(env, { act: 'topic', title: 'Share your tavern generators', name: 'Ann', text: 'Post your best ones below.', ...(await oldCheck()) }); assert.equal(t.ok, true); assert.match(t.id, /^[a-z2-7]{10}$/);
  const t2 = await post(env, { act: 'topic', title: 'Odds help', text: 'How do ^0.5 odds work?', ...(await oldCheck()) }, '203.0.113.62');
  const list = async () => (await (await route.onRequestGet({ env, request: new Request('https://x/api/comments?topics=1') })).json()).items;
  assert.deepEqual((await list()).map((x) => x.title), ['Odds help', 'Share your tavern generators']);
  assert.equal((await post(env, { act: 'post', thread: 'forum:' + t.id, text: 'Mine is the Rusty Dragon.', ...(await oldCheck()) }, '203.0.113.63')).ok, true);
  const l2 = await list(); assert.equal(l2[0].title, 'Share your tavern generators'); assert.equal(l2[0].replies, 1);
  const th = await get(env, 'forum:' + t.id); assert.equal(th.topic.title, 'Share your tavern generators'); assert.deepEqual(th.items.map((c) => c.text), ['Post your best ones below.', 'Mine is the Rusty Dragon.'], 'oldest first in a topic');
  assert.match((await post(env, { act: 'topic', title: '', text: 'x', ...(await oldCheck()) }, '203.0.113.64')).error, /title/);
  assert.match((await post(env, { act: 'topic', title: 'buy at cheap.shop', text: 'hi', ...(await oldCheck()) }, '203.0.113.65')).error, /links/);
  for (const ip of ['10.4.0.1', '10.4.0.2', '10.4.0.3']) await post(env, { act: 'report-topic', id: t2.id }, ip);
  assert.deepEqual((await list()).map((x) => x.title), ['Share your tavern generators']); assert.equal((await get(env, 'forum:' + t2.id)).ok, false);
  const del = (k) => route.onRequestDelete({ env, request: new Request('https://x/api/comments?topic=' + t.id, { method: 'DELETE', headers: k ? { authorization: 'Bearer ' + k } : {} }) });
  assert.equal((await del('x')).status, 401); assert.equal((await del(KEY)).status, 200); assert.equal((await list()).length, 0);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM void_comments WHERE thread = ?").get('forum:' + t.id).n, 0);
});
