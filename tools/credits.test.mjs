// The real /api/credits handlers on SQLite. node --test tools/credits.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet as latest } from '../void-live-deploy/functions/api/credits/latest.js';
import { onRequestGet as balance, onRequestPost as claim } from '../void-live-deploy/functions/api/credits/claim.js';
import { maskName, oddsFromCounts, botUa, DAILY_CAP, POW_BITS } from '../void-live-deploy/lib/credits.js';
import { doWork } from '../void-live-deploy/lib/boards.js';
import { sessionId } from '../void-live-deploy/lib/void-me.js';
import faucet from '../void-live-deploy/skills/faucet.js';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  const batch = async (list) => { const out = []; db.exec('BEGIN'); try { for (const s of list) out.push(await s.run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return out; };
  return { prepare: (sql) => stmt(sql), batch, raw: db };
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0';
const TOKEN = 'b'.repeat(43), USER = 'membercredits1', SALT = 'test-salt';
let ipn = 0;
const envOf = (DB, extra = {}) => ({ DB, SALT, TOOLS: new Set(['faucet', 'calc']), ...extra });
const req = (path, { method = 'GET', body, token = TOKEN, ip, ua = UA, headers = {} } = {}) => new Request('https://a-to-mind.com' + path, { method, headers: { 'user-agent': ua, 'cf-connecting-ip': ip || '203.0.113.' + (++ipn), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
async function sign(DB) {
  await latest({ request: req('/api/credits/latest', { token: '' }), env: envOf(DB) });
  DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(TOKEN), USER, new Date().toISOString(), Date.now() + 864e5);
  DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, verified, raw, at) VALUES ('sale1','sale','s1',1,'price=5000&test=false',?)").run(new Date().toISOString());
}
const prove = async (DB, ip) => { const j = await (await latest({ request: req('/api/credits/latest', { token: '', ip }), env: envOf(DB) })).json(); return { challenge: j.challenge, work: String(await doWork(j.challenge, POW_BITS)) }; };
const post = (DB, body, ip, extra) => claim({ request: req('/api/credits/claim', { method: 'POST', body, ip }), env: envOf(DB, extra) });
test('masking, odds and the card ask', () => {
  assert.equal(maskName('Ada Lovelace'), 'A····'); assert.equal(maskName('ada@example.com'), '·'); assert.equal(botUa('curl/8.4.0 (agent)'), true);
  assert.equal(oddsFromCounts({ daily: 0 }), null); assert.equal(oddsFromCounts({ daily: 2, bug: 1 }).rows[0].weight, 2);
  for (const a of ['credits', 'claim credits', 'faucet']) assert.equal(faucet.match(a), true, a);
  for (const a of ['gpa with A 4 credits', 'prize wheel odds', 'crypto faucet']) assert.equal(faucet.match(a), false, a);
});
test('the prize page keeps the wheel and sizes the strip links', () => {
  const html = readFileSync(new URL('../void-live-deploy/prizes/index.html', import.meta.url), 'utf8');
  for (const bit of ['id="h-wheel"', 'id="h-odds"', 'id="h-sim"', 'id="h-drip"', 'id="h-share"', 'Label:value:weight', 'Cost per spin', '1,000 spins', 'never pays out', 'secure random numbers', 'id="h-credits"', 'internal credits only']) assert.ok(html.includes(bit), bit);
  assert.match(html, /\.vh-strip a[^{]*\{[^}]*min-height:44px/);
});
test('a daily claim hits the endpoint, the feed masks the name, and the next claim waits', async () => {
  const DB = d1(), ip = '198.51.100.10'; await sign(DB);
  DB.raw.prepare('INSERT INTO void_pages (handle, user_id, data, updated) VALUES (?,?,?,?)').run('Ada Lovelace', USER, '{}', new Date().toISOString());
  const first = await post(DB, { kind: 'daily', ...(await prove(DB, ip)) }, ip), got = await first.json();
  assert.equal(first.status, 200, JSON.stringify(got)); assert.equal(got.balance, 1);
  const pub = await (await latest({ request: req('/api/credits/latest', { token: '', ip: '198.51.100.11' }), env: envOf(DB) })).json();
  const pubText = JSON.stringify(pub);
  assert.equal(pub.feed[0].name, 'A····'); assert.equal(pubText.includes('Ada') || pubText.includes(USER) || pubText.includes('@'), false);
  assert.equal(pub.counts.daily, 1); assert.equal(pub.odds.rows.find((r) => r.label === 'daily').weight, 1);
  assert.equal((await post(DB, { kind: 'daily', ...(await prove(DB, ip)) }, ip)).status, 429);
  assert.ok((await (await balance({ request: req('/api/credits/claim', { ip }), env: envOf(DB) })).json()).nextDaily);
});
test('the issuance cap and the daily cap are enforced on the endpoint', async () => {
  const DB = d1(); await sign(DB); const old = new Date(Date.now() - 120000).toISOString();
  DB.raw.prepare('UPDATE void_sales SET raw = ? WHERE id = ?').run('price=1&test=false', 'sale1');
  const one = await post(DB, { kind: 'tool', ref: 'faucet', ...(await prove(DB, '198.51.100.20')) }, '198.51.100.20');
  assert.equal(one.status, 200, JSON.stringify(await one.json()));
  DB.raw.prepare('UPDATE void_credits SET at = ?').run(old);
  const over = await post(DB, { kind: 'tool', ref: 'calc', ...(await prove(DB, '198.51.100.21')) }, '198.51.100.21'), overBody = await over.json();
  assert.equal(over.status, 403, JSON.stringify(overBody)); assert.match(overBody.error, /no credits are left/);
  DB.raw.prepare('UPDATE void_sales SET raw = ? WHERE id = ?').run('price=100000&test=false', 'sale1');
  const now = new Date().toISOString();
  for (let i = 0; i < DAILY_CAP - 1; i++) DB.raw.prepare('INSERT INTO void_credits (id, at, member, ip, name, kind, amount, ref) VALUES (?,?,?,?,?,?,?,?)').run('pad' + i, now, 'other', 'ip-pad', 'Member', 'daily', 1, 'd' + i);
  const capped = await post(DB, { kind: 'daily', ...(await prove(DB, '198.51.100.22')) }, '198.51.100.22'), capBody = await capped.json();
  assert.equal(capped.status, 429, JSON.stringify(capBody)); assert.match(capBody.error, /cap/);
});
test('a script, a missing proof, a bad turnstile token and a click with no activity are refused', async () => {
  const DB = d1(), ip = '198.51.100.30'; await sign(DB); const proof = await prove(DB, ip);
  assert.equal((await claim({ request: req('/api/credits/claim', { method: 'POST', body: { kind: 'daily', ...proof }, ip, ua: 'curl/8.4.0 (agent)' }), env: envOf(DB) })).status, 403);
  assert.equal((await post(DB, { kind: 'daily', website: 'http://spam.example' }, ip)).status, 403);
  assert.equal((await post(DB, { kind: 'bug', ref: 'S-00000000', ...(await prove(DB, ip)) }, ip)).status, 403);
  const ts = await claim({ request: req('/api/credits/claim', { method: 'POST', body: { kind: 'daily', turnstile: 'nope' }, ip: '198.51.100.31' }), env: envOf(DB, { TURNSTILE_SECRET: 'made-up', FETCH: async () => Response.json({ success: false }) }) }); // secret-scan: ok
  assert.equal(ts.status, 403);
});
test('an answered report and a shipped idea credit once, and a spend lowers the balance', async () => {
  const DB = d1(); await sign(DB); const at = new Date().toISOString();
  DB.raw.prepare("CREATE TABLE IF NOT EXISTS void_support (id TEXT PRIMARY KEY, who TEXT, at TEXT, place TEXT, what TEXT, status TEXT, answer TEXT, answered TEXT)").run();
  DB.raw.prepare("INSERT INTO void_support (id, who, at, place, what, status, answer, answered) VALUES ('S-ABCDEF01', ?, ?, 'site', 'the wheel label overflows', 'answered', 'fixed', ?)").run('acct:' + USER, at, at);
  DB.raw.prepare('CREATE TABLE IF NOT EXISTS void_member_ideas (id TEXT PRIMARY KEY, user_id TEXT, text TEXT, at TEXT, job TEXT)').run();
  DB.raw.prepare('CREATE TABLE IF NOT EXISTS void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)').run();
  DB.raw.prepare("INSERT INTO void_member_ideas (id, user_id, text, at, job) VALUES ('idea9', ?, 'add a star', ?, 'job9')").run(USER, at);
  DB.raw.prepare("INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES ('job9','ask','member:idea9','done','',?,?)").run(at, at);
  const back = () => DB.raw.prepare('UPDATE void_credits SET at = ?').run(new Date(Date.now() - 120000).toISOString());
  const bug = await (await post(DB, { kind: 'bug', ref: 'S-ABCDEF01', ...(await prove(DB, '198.51.100.41')) }, '198.51.100.41')).json();
  assert.equal(bug.balance, 5, JSON.stringify(bug)); back();
  const built = await (await post(DB, { kind: 'build', ref: 'idea9', ...(await prove(DB, '198.51.100.42')) }, '198.51.100.42')).json();
  assert.equal(built.balance, 15, JSON.stringify(built)); back();
  const tool = await (await post(DB, { kind: 'tool', ref: 'faucet', ...(await prove(DB, '198.51.100.43')) }, '198.51.100.43')).json();
  assert.equal(tool.amount, 1, JSON.stringify(tool)); back();
  const after = await (await post(DB, { spend: 'cap', nonce: 'abc12345', ...(await prove(DB, '198.51.100.44')) }, '198.51.100.44')).json();
  assert.equal(after.balance, 13, JSON.stringify(after)); assert.equal(after.grants.caps, 1);
});
