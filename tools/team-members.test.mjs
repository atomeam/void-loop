// Members of the Verse team (/team/, functions/api/team.js joinMember, lib/team.js MEMBER_PRODUCTS): a buyer joins with the license key
// from the Gumroad receipt, no owner step. A FAKE D1 (node:sqlite) and a fake Gumroad. A made-up key is refused and writes nothing; a real
// purchase makes one member (the same purchase again is a new key for the same member); a member claims a job from the public board,
// proposes in #ideas, cannot invite, remove, queue or make channels; the owner posts a job in one line and makes a proposal a job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as T from '../void-live-deploy/lib/team.js';
import * as API from '../void-live-deploy/functions/api/team.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const OWNER = 'test-owner-key'; // secret-scan: ok
const T0 = Date.UTC(2026, 10, 3, 20);
const GOOD = 'AAAA1111-BBBB2222-CCCC3333-DDDD4444', FREE = 'FFFF0000-FFFF0000-FFFF0000-FFFF0000', REFUND = 'RRRR0000-RRRR0000-RRRR0000-RRRR0000'; // secret-scan: ok
function world() {
  const DB = d1();
  DB.raw.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const add = DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)');
  add.run('v1', 'Versus: hexo.io (Hexo) needs a page no floor has yet', 'versus:hexo.io', 'queued', '', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z');
  add.run('h1', 'fix the red check', 'heal:verify.yml', 'queued', '', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z');
  add.run('m1', 'what a visitor typed, private', 'miss:abc', 'queued', '', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z');
  const calls = [];
  const GUMROAD_FETCH = async (url, init) => {
    const f = new URLSearchParams(init.body); calls.push({ url, product: f.get('product_id'), inc: f.get('increment_uses_count') });
    const k = f.get('license_key'), pid = f.get('product_id');
    const purchase = (o) => Response.json({ success: true, uses: 0, purchase: { product_id: pid, sale_id: 'sale-' + k.slice(0, 4), price: 100, refunded: false, chargebacked: false, ...o } });
    if (k === GOOD) return purchase({});
    if (k === FREE) return purchase({ price: 0 });
    if (k === REFUND) return purchase({ refunded: true });
    return Response.json({ success: false, message: 'That license does not exist for the provided product.' }, { status: 404 });
  };
  return { DB, SALT: 'test-salt', READ_TOKEN: OWNER, GUMROAD_FETCH, calls };
}
let ip = 0;
const req = (method, q = '', body, key) => new Request('https://verse.test/api/team' + q, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.' + (++ip % 250), ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: body ? JSON.stringify(body) : undefined });
const get = async (env, q, key, now = T0) => { const r = await API.onRequestGet({ env, request: req('GET', q, null, key), now }); return { status: r.status, ...(await r.json()) }; };
const post = async (env, body, key, now = T0) => { const r = await API.onRequestPost({ env, request: req('POST', '', body, key), now }); return { status: r.status, ...(await r.json()) }; };
const agents = (env) => env.DB.raw.prepare('SELECT * FROM void_team_agents').all();

test('the store products that open the team, found by permalink, link, id or name; Gumroad answers read the strict way', () => {
  assert.equal(T.memberProduct('join-the-team').name, 'Join the Team');
  assert.equal(T.memberProduct('https://moonbeam846.gumroad.com/l/yinmj?x=1').name, 'Void Monthly');
  assert.equal(T.memberProduct('ITp6zMMOC7A2h-bsSejYSA==').slug, 'yinmj');
  assert.equal(T.memberProduct('nothing-here'), null);
  const p = T.memberProduct('join-the-team');
  assert.match(T.purchaseProblem({ success: false }, p), /does not know/);
  assert.match(T.purchaseProblem({ success: true, purchase: { product_id: 'other', sale_id: 's', price: 100 } }, p), /another product/);
  assert.match(T.purchaseProblem({ success: true, purchase: { product_id: p.id, sale_id: 's', price: 100, subscription_cancelled_at: '2026-11-01' } }, p), /cancelled/);
  assert.match(T.purchaseProblem({ success: true, purchase: { product_id: p.id, sale_id: 's', price: 0 } }, p), /free copy/);
  assert.equal(T.purchaseProblem({ success: true, purchase: { product_id: p.id, sale_id: 's', price: 100 } }, p), '');
});

test('a made-up license key is refused by Gumroad and writes nothing; a free or refunded copy is refused too', async () => {
  const env = world();
  const r = await post(env, { do: 'member', product: 'join-the-team', key: 'ZZZZ9999-ZZZZ9999-ZZZZ9999-ZZZZ9999', name: 'Ada' }); // secret-scan: ok
  assert.equal(r.status, 403); assert.match(r.say, /does not know that license key/); assert.equal(r.key, undefined);
  assert.equal(env.calls[0].url, 'https://api.gumroad.com/v2/licenses/verify'); assert.equal(env.calls[0].product, 'yRV2Tdxi4Sfo93dngFfueQ=='); assert.equal(env.calls[0].inc, 'false');
  assert.equal((await post(env, { do: 'member', product: 'join-the-team', key: FREE, name: 'Ada' })).status, 403);
  assert.equal((await post(env, { do: 'member', product: 'yinmj', key: REFUND, name: 'Ada' })).status, 403);
  assert.equal((await post(env, { do: 'member', product: 'join-the-team', key: '<script>', name: 'Ada' })).status, 400);
  assert.equal((await post(env, { do: 'member', product: 'not-a-product', key: GOOD, name: 'Ada' })).status, 400);
  assert.equal((await post(env, { do: 'member', name: 'Ada' })).status, 400, 'no key and no order');
  assert.equal(agents(env).length, 0, 'no member was made');
});

test('a real purchase makes one member at once, with a key; the same purchase again is a new key for the same member', async () => {
  const env = world();
  const j = await post(env, { do: 'member', product: 'join-the-team', key: GOOD, name: 'Ada', about: 'front-end dev' });
  assert.equal(j.status, 201, j.say); assert.ok(T.KEY_RE.test(j.key)); assert.equal(j.role, 'member');
  const me = await get(env, '?me', j.key); assert.equal(me.me.name, 'Ada'); assert.equal(me.me.role, 'member');
  const row = agents(env)[0]; assert.equal(row.role, 'member'); assert.ok(!JSON.stringify(row).includes('sale-AAAA'), 'only the sale\'s keyed hash is kept');
  const shell = await get(env, ''); assert.equal(shell.members[0].role, 'member');
  const again = await post(env, { do: 'member', product: 'join-the-team', key: GOOD, name: 'Someone' });
  assert.equal(again.status, 201); assert.equal(again.name, 'Ada'); assert.equal(again.again, true); assert.notEqual(again.key, j.key);
  assert.equal((await get(env, '?me', j.key)).me, null, 'the old key stopped');
  assert.equal(agents(env).length, 1, 'one purchase, one member');
  const general = await get(env, '?c=general', again.key); assert.ok(general.messages.some((m) => /Ada joined the team as a member/.test(m.body)));
  await post(env, { do: 'remove', name: 'Ada' }, OWNER);
  assert.equal((await post(env, { do: 'member', product: 'join-the-team', key: GOOD, name: 'Ada2' })).status, 403, 'a removed member stays out');
});

test('the public board lists only the team\'s kinds, good first tasks on top; a member claims one with one call and is credited when it ships', async () => {
  const env = world();
  const b = await get(env, '?jobs'); assert.equal(b.status, 200);
  assert.deepEqual(b.jobs.map((x) => x.id), ['v1', 'h1'], 'the versus page first (a good first task), never a visitor\'s miss');
  assert.equal(b.jobs[0].good, true); assert.ok(!JSON.stringify(b).includes('visitor typed'));
  const m = await post(env, { do: 'member', product: 'join-the-team', key: GOOD, name: 'Ada' });
  assert.equal((await post(env, { do: 'claim', job: 'v1' })).status, 401, 'a stranger claims nothing');
  const c = await post(env, { do: 'claim', job: 'v1' }, m.key); assert.equal(c.status, 201, c.say); assert.equal(c.job.job, 'v1');
  assert.equal((await post(env, { do: 'claim', job: 'h1' }, m.key)).status, 409, 'one job at a time');
  assert.deepEqual((await get(env, '?jobs')).jobs.map((x) => x.id), ['h1'], 'a claimed job leaves the board');
  const d = await post(env, { do: 'done', ok: true, link: 'https://github.com/atomeam/void-loop/pull/9999', note: 'hexo page' }, m.key); assert.equal(d.status, 200, d.say);
  const cr = await get(env, '?credits');
  assert.equal(cr.people[0].name, 'Ada'); assert.equal(cr.people[0].shipped, 1);
  assert.equal(cr.shipped[0].link, 'https://github.com/atomeam/void-loop/pull/9999'); assert.equal(cr.shipped[0].state, 'in review');
});

test('a member proposes in #ideas and cannot invite, remove, queue or make channels; the owner posts a job in one line and makes a proposal a job', async () => {
  const env = world();
  const m = await post(env, { do: 'member', product: 'yinmj', key: GOOD, name: 'Ada' });
  for (const b of [{ do: 'invite', name: 'x' }, { do: 'remove', name: 'Ada' }, { do: 'queue' }, { do: 'channel', code: 'mine' }, { do: 'quick', text: 'job: x' }]) assert.equal((await post(env, b, m.key)).status, 403, b.do);
  const p = await post(env, { do: 'propose', body: 'a dark mode for /team/' }, m.key); assert.equal(p.status, 201, p.say);
  const ideas = await get(env, '?c=ideas', m.key); assert.equal(ideas.messages[0].body, 'Proposal: a dark mode for /team/'); assert.equal(ideas.messages[0].kind, 'member');
  const pr = await post(env, { do: 'promote', id: p.id }, OWNER); assert.equal(pr.status, 201, pr.say); assert.equal(pr.job, 'team-' + p.id);
  assert.ok((await get(env, '?jobs')).jobs.some((x) => x.id === 'team-' + p.id && x.owner), 'the proposal is on the board as the owner\'s ask, its words kept in the chat');
  assert.equal((await post(env, { do: 'promote', id: p.id }, m.key)).status, 403);
  const q = await post(env, { do: 'quick', text: 'job: add a tide table to /weather/' }, OWNER); assert.equal(q.status, 201, q.say); assert.match(q.job, /^team-\d+$/);
  const qi = await post(env, { do: 'quick', text: 'idea: a weekly members call' }, OWNER); assert.equal(qi.status, 201); assert.equal(qi.job, undefined, 'an idea is not a job');
  assert.deepEqual(T.quickPost('fix: the red check'), { c: 'work', body: 'Fix: the red check' });
  assert.deepEqual(T.quickPost('Idea - more stars'), { c: 'ideas', body: 'more stars' });
  assert.equal(T.quickPost('   '), null);
});

test('the stage: "help build verse" and the owner\'s "team job: ..." go to the team skill; a job search does not', async () => {
  const { default: skill, postLink } = await import('../void-live-deploy/skills/team-chat.js');
  for (const q of ['help build verse', 'how can i help build verse?', 'verse jobs', 'team job: add a tide table', 'post an idea to the team: a members call']) assert.ok(skill.match(q.toLowerCase(), q), q);
  for (const q of ['jobs near me', 'post a job', 'team building ideas']) assert.ok(!skill.match(q.toLowerCase(), q), q);
  assert.equal(postLink('team job: add a tide table'), '/team/?job=add+a+tide+table#build');
  assert.equal(postLink('Verse idea, a members call'), '/team/?idea=a+members+call#build');
  assert.equal(postLink('help build verse'), '');
});
