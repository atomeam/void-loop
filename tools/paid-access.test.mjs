// lib/paid-access.js: who may use what Verse sells. The owner, a paid account's Pro key, or a Code Review Pro license bought on its
// own; anything else is the free tier. A fake D1 and a fake Gumroad stand in, so nothing leaves the machine.
// Run: node --test tools/paid-access.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, PRODUCT } from '../void-live-deploy/lib/paid-access.js';
import { keyHash, PRO_DAILY, today } from '../void-live-deploy/lib/review-api.js';

const NOW = Date.parse('2026-11-12T15:00:00Z');
function fakeDb({ keys = {}, accounts = {}, licenses = {} } = {}) {
  const ran = [];
  const stmt = (sql) => ({ args: [], bind(...a) { this.args = a; return this; },
    async first() {
      if (/FROM void_review_keys/.test(sql)) return keys[this.args[0]] || null;
      if (/FROM void_accounts/.test(sql)) return accounts[this.args[0]] || null;
      if (/FROM void_licenses/.test(sql)) return licenses[this.args[0]] || null;
      return null;
    },
    async run() { ran.push({ sql, args: this.args }); if (/INSERT INTO void_licenses/.test(sql)) licenses[this.args[0]] = { ok: this.args[2], why: this.args[3], checked: this.args[4] }; return { meta: { changes: 1 } }; },
    async all() { return { results: [] }; } });
  return { ran, licenses, prepare: stmt, batch: async () => [] };
}
const req = (token) => new Request('https://a-to-mind.com/api/review', { headers: token ? { authorization: 'Bearer ' + token } : {} });
const KEY = 'vr1.' + 'a'.repeat(43), LIC = 'ABCDEF12-ABCDEF12-ABCDEF12-ABCDEF12';
const gumroad = (body, status = 200) => { const calls = []; const f = async (url, init) => { calls.push(String(init.body)); return new Response(JSON.stringify(body), { status }); }; f.calls = calls; return f; };

test('no bearer is the free tier', async () => {
  assert.deepEqual(await access(req(''), { DB: fakeDb() }, NOW), { tier: 'free', note: undefined });
});
test('a Pro key nobody issued is refused', async () => {
  assert.deepEqual(await access(req(KEY), { DB: fakeDb() }, NOW), { refuse: 'unknown review key' });
});
test('a Pro key on a paid account is pro, counts today\'s uses, and spend() records one more', async () => {
  const h = await keyHash(KEY), DB = fakeDb({ keys: { [h]: { user_id: 'u1', day: today(NOW), uses: 3 } }, accounts: { u1: { tier: 'paid' } } });
  const a = await access(req(KEY), { DB }, NOW);
  assert.equal(a.tier, 'pro'); assert.equal(a.who, 'acct:u1'); assert.equal(a.left, PRO_DAILY - 3);
  assert.ok(!JSON.stringify(a).includes(KEY), 'the key itself is never in the answer');
  await a.spend();
  assert.ok(DB.ran.some((r) => /UPDATE void_review_keys/.test(r.sql) && r.args[3] === h));
});
test('yesterday\'s uses do not count against today', async () => {
  const h = await keyHash(KEY), DB = fakeDb({ keys: { [h]: { user_id: 'u1', day: '2026-11-11', uses: 9 } }, accounts: { u1: { tier: 'paid' } } });
  assert.equal((await access(req(KEY), { DB }, NOW)).left, PRO_DAILY);
});
test('a Pro key whose account is free now is the free tier, with the reason', async () => {
  const h = await keyHash(KEY), DB = fakeDb({ keys: { [h]: { user_id: 'u2', day: today(NOW), uses: 0 } }, accounts: { u2: { tier: 'free' } } });
  assert.deepEqual(await access(req(KEY), { DB }, NOW), { tier: 'free', note: 'this key belongs to a free account' });
});
test('a good license is pro and is remembered, so the next ask inside the window does not ask Gumroad again', async () => {
  assert.ok(PRODUCT && PRODUCT.id === 'code-review');
  const DB = fakeDb(), fetchGumroad = gumroad({ success: true, purchase: {} });
  const a = await access(req(LIC.toLowerCase()), { DB, fetchGumroad }, NOW);
  assert.equal(a.tier, 'pro'); assert.match(a.who, /^lic:[0-9a-f]{64}$/); assert.equal(a.left, PRODUCT.daily);
  assert.ok(fetchGumroad.calls[0].includes('license_key=' + LIC), 'the license is checked upper-cased');
  const b = await access(req(LIC), { DB, fetchGumroad }, NOW + 60e3);
  assert.equal(b.tier, 'pro'); assert.equal(fetchGumroad.calls.length, 1);
});
test('a license for another product is refused; a refunded one is free with its reason', async () => {
  assert.deepEqual(await access(req(LIC), { DB: fakeDb(), fetchGumroad: gumroad({ success: false }, 404) }, NOW), { refuse: 'unknown license key' });
  assert.deepEqual(await access(req(LIC), { DB: fakeDb(), fetchGumroad: gumroad({ success: true, purchase: { refunded: true } }) }, NOW), { tier: 'free', note: 'license: refunded' });
});
test('Gumroad unreachable with nothing remembered is the free tier, never a refusal', async () => {
  const down = async () => { throw new Error('offline'); };
  const a = await access(req(LIC), { DB: fakeDb(), fetchGumroad: down }, NOW);
  assert.equal(a.tier, 'free'); assert.match(a.note, /could not check the license/);
});
test('the owner token is the owner tier; any other bearer is the free tier and is not echoed', async () => {
  const env = { DB: fakeDb(), READ_TOKEN: 'owner-secret-token-for-tests' };
  const o = await access(req('owner-secret-token-for-tests'), env, NOW);
  assert.equal(o.tier, 'owner'); assert.equal(o.left, Infinity);
  const logs = [], log = console.log; console.log = (m) => logs.push(String(m));
  try { assert.deepEqual(await access(req('not-a-key-at-all'), env, NOW), { tier: 'free', note: undefined }); } finally { console.log = log; }
  assert.ok(logs.length && !logs.join(' ').includes('not-a-key-at-all'), 'the token is never logged');
});
