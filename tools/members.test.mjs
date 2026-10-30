// Paid Verse members add to Verse (lib/members.js, functions/api/members.js): the idea check, the tier gate, the limits, the queue job
// and the member's own list. Run: node --test tools/members.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/members.js';
import { checkIdea, perks, stateText, queueIdea, DAILY, LIVE } from '../void-live-deploy/lib/members.js';
import { sessionId } from '../void-live-deploy/lib/void-me.js';
import { ensureStoreTables } from '../void-live-deploy/lib/store-db.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  // a batch is one transaction, and D1 runs them one at a time: the chain keeps two batches from interleaving, as D1 does
  let chain = Promise.resolve();
  const batch = (list) => (chain = chain.then(async () => { const out = []; db.exec('BEGIN'); try { for (const s of list) out.push(await s.run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return out; }, () => {}));
  return { prepare: (sql) => stmt(sql), batch, raw: db };
}
const TOKEN = 'a'.repeat(43), USER = 'user-for-members-test';
async function signIn(DB, tier) {
  await onRequestGet({ request: new Request('https://a-to-mind.com/api/members'), env: { DB } }); // makes the tables
  DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(TOKEN), USER, new Date().toISOString(), Date.now() + 864e5);
  if (tier) DB.raw.prepare("INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, ?)").run(USER, tier, new Date().toISOString());
}
let ip = 0;
const post = (DB, idea, env = {}) => onRequestPost({ env: { DB, MEMBERS_TRY: '1', ...env }, request: new Request('https://a-to-mind.com/api/members', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.' + (++ip) }, body: JSON.stringify({ idea }) }) });
const get = (DB) => onRequestGet({ env: { DB }, request: new Request('https://a-to-mind.com/api/members', { headers: { authorization: 'Bearer ' + TOKEN } }) }).then((r) => r.json());
const IDEA = 'Add a star chart to the night sky page that shows which planets are up tonight.';

test('an idea that adds passes; one that takes away, spams or carries a key is turned down with a sentence', () => {
  assert.equal(checkIdea(IDEA).ok, true);
  for (const bad of ['Remove the fan fiction page, nobody reads it', 'please delete the old games', 'hide the free tools behind the paywall', 'make the calculators members-only',
    'add a crypto casino with slots', 'short', 'ADD A HUGE BANNER TO EVERY SINGLE PAGE OF THE WHOLE SITE NOW', 'add buy buy buy buy buy buy buy now',
    'add this key sk-abcdefghijklmnopqrstuvwxyz123456 to the page', 'add links http://a.co http://b.co http://c.co to the footer page']) {
    const c = checkIdea(bad);
    assert.equal(c.ok, false, bad); assert.ok(c.why && c.why.length > 10, bad);
  }
  assert.match(checkIdea('Remove the fan fiction page please').why, /add/i, 'a subtracting idea is told members add');
});

test('visitors see the perks with no sign-in; helping build Verse is always listed, and says it opens soon until go-live', async () => {
  const DB = d1();
  const j = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/members'), env: { DB } })).json();
  assert.equal(j.signedIn, false); assert.equal(j.live, LIVE);
  assert.ok(j.perks.length >= 4); assert.match(j.buy, /^https:\/\/moonbeam846\.gumroad\.com\/l\/yinmj$/);
  assert.equal(perks(true).length, perks(false).length);
  assert.match(perks(false).find((p) => p.id === 'build').title, /help build verse/i);
  assert.match(perks(false).find((p) => p.id === 'build').text, /Opens soon\.$/);
  assert.doesNotMatch(perks(true).find((p) => p.id === 'build').text, /Opens soon/);
});

test('only a signed-in paid member can send; a free account gets 402 with the way to join', async () => {
  const DB = d1();
  assert.equal((await post(DB, IDEA)).status, 401);
  await signIn(DB, null);
  const r = await post(DB, IDEA); assert.equal(r.status, 402); assert.match((await r.json()).buy, /gumroad/);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM void_queue').get().n, 0, 'nothing queued for a free account');
});

test('before go-live the API refuses even a member (the switch is lib/members.js LIVE)', async () => {
  if (LIVE) return;
  const DB = d1(); await signIn(DB, 'paid');
  assert.equal((await post(DB, IDEA, { MEMBERS_TRY: '' })).status, 503);
});

test('the pre-launch pilot lets a paid member send through every check, and still nothing else', async () => {
  if (LIVE) return;
  const pilot = (DB, idea) => onRequestPost({ env: { DB }, request: new Request('https://a-to-mind.com/api/members', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json', 'cf-connecting-ip': '10.1.0.' + (++ip) }, body: JSON.stringify({ idea, pilot: true }) }) });
  const free = d1(); await signIn(free, null);
  assert.equal((await pilot(free, IDEA)).status, 402, 'a free account cannot use the pilot');
  const DB = d1(); await signIn(DB, 'paid');
  assert.equal((await pilot(DB, 'Remove the games page from the site')).status, 400, 'the add-only check holds in the pilot');
  const r = await pilot(DB, IDEA); assert.equal(r.status, 200);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM void_queue WHERE target LIKE 'member:%'").get().n, 1);
});

test('a member idea becomes one member:<id> queue job, shows in their list, and the daily limit holds', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const r = await post(DB, IDEA); const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.left, DAILY - 1);
  const q = DB.raw.prepare('SELECT * FROM void_queue').all();
  assert.equal(q.length, 1); assert.equal(q[0].target, 'member:' + j.id); assert.equal(q[0].state, 'queued');
  assert.match(q[0].ask, /^A paid member asked Verse to add this/); assert.ok(q[0].ask.includes(IDEA));
  assert.equal((await post(DB, 'Remove the games page from the site')).status, 400);
  for (let i = 1; i < DAILY; i++) assert.equal((await post(DB, IDEA + ' Number ' + i + '.')).status, 200);
  assert.equal((await post(DB, IDEA + ' One more.')).status, 429, 'the daily limit');
  const g = await get(DB);
  assert.equal(g.tier, 'paid'); assert.equal(g.left, 0); assert.equal(g.ideas.length, DAILY);
  assert.equal(g.ideas[0].state, 'queued'); assert.equal(typeof g.ideas[0].text, 'string'); assert.ok(g.ideas.every((x) => x.text.startsWith(IDEA)));
});

test('a shipped job reads as built with its pull request', () => {
  assert.deepEqual(stateText('done', 'verse-job: PR https://github.com/atomeam/void-loop/pull/1600'), { state: 'shipped', status: 'Built in 1600', pr: 'https://github.com/atomeam/void-loop/pull/1600' });
  assert.equal(stateText('set aside', '').state, 'set aside');
  assert.equal(stateText('queued', '').state, 'queued');
});

test('sends at the same moment cannot pass the daily limit: the count is checked inside the insert', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const now = Date.now();
  const all = await Promise.all(Array.from({ length: DAILY + 3 }, (_, i) => queueIdea({ DB }, USER, IDEA + ' Copy ' + i + '.', now + i)));
  assert.equal(all.filter(Boolean).length, DAILY);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM void_member_ideas').get().n, DAILY);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM void_queue').get().n, DAILY, 'no queue job without its idea row');
});

// The owner bought their own membership while signed in to Gumroad as the creator: Gumroad sends that as a test ping. It was recorded
// before such a ping was trusted, so the purchase is applied when their Verse next loads /members/ (functions/api/gumroad.js relinkRecorded).
test('a recorded purchase from before today\'s rules unlocks its own Verse on the next load, and nobody else\'s', async () => {
  const SELLER = 'I1O8RSqkcoRWcew39cQx7A==';
  const raw = (extra) => new URLSearchParams({ sale_id: 'own-1', seller_id: SELLER, product_id: 'ITp6zMMOC7A2h-bsSejYSA==', product_permalink: 'https://moonbeam846.gumroad.com/l/yinmj', subscription_id: 'sub-own', test: 'true', resource_name: 'sale', 'url_params[void]': USER, ...extra }).toString();
  const rec = (DB, id, r, voidId = USER) => DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, 'sale', 'own-1', 'sub-own', 'yinmj', ?, 0, 'not trusted: test ping', ?, ?)").run(id, voidId, r, new Date().toISOString());
  const DB = d1(); await signIn(DB, null); await ensureStoreTables({ DB });
  rec(DB, 'sale:own-1:t', raw({}));
  const j = await get(DB);
  assert.equal(j.tier, 'paid', 'the owner\'s own purchase unlocks their Verse');
  assert.equal(DB.raw.prepare('SELECT tier FROM void_accounts WHERE user_id = ?').get(USER).tier, 'paid');
  assert.equal(DB.raw.prepare("SELECT verified FROM void_sales WHERE id = 'sale:own-1:t'").get().verified, 1);
  // another seller's ping, a cancelled one, or a ping for someone else's Verse unlocks nothing
  for (const [r, cancel, voidId] of [[raw({ seller_id: 'zzOtherSellerZZzzzzzzz==' }), false, USER], [raw({}), true, USER], [raw({}), false, 'someone-else-verse-id']]) {
    const D2 = d1(); await signIn(D2, null); await ensureStoreTables({ DB: D2 }); rec(D2, 'sale:own-1:t', r, voidId);
    if (cancel) D2.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES ('cancellation:sub-own:x', 'cancellation', NULL, 'sub-own', 'yinmj', NULL, 0, 'x', 'resource_name=cancellation', ?)").run(new Date().toISOString());
    assert.equal((await get(D2)).tier, 'free');
  }
});

// A purchase made with no ?void= on the link (bought signed out, or straight from Gumroad) is linked by the buyer with the Order ID
// from the receipt and the email they paid with (owner, 2026-10-30: "i paid and everything just now and it went nowhere").
test('a buyer unlocks their own Verse with the receipt Order ID and email, and every wrong claim is turned down', async () => {
  const SELLER = 'I1O8RSqkcoRWcew39cQx7A==', SALE = 'N6blWbTnSDY7nQYhsLEGrg==', MAIL = 'Buyer@Example.com';
  const ping = (extra) => new URLSearchParams({ sale_id: SALE, order_number: '524459935', seller_id: SELLER, email: MAIL, product_id: 'ITp6zMMOC7A2h-bsSejYSA==', product_permalink: 'https://moonbeam846.gumroad.com/l/yinmj', subscription_id: 'sub-c', test: 'true', resource_name: 'sale', ...extra }).toString();
  const rec = (DB, r, id = 'sale:' + SALE + ':t') => DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, 'sale', ?, 'sub-c', 'yinmj', NULL, 1, 'verified, no Verse id: link by hand', ?, ?)").run(id, SALE, r, new Date().toISOString());
  const claim = (DB, order, email, env = {}) => onRequestPost({ env: { DB, ...env }, request: new Request('https://a-to-mind.com/api/members', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json', 'cf-connecting-ip': '10.2.0.' + (++ip) }, body: JSON.stringify({ do: 'claim', order, email }) }) });
  const fresh = async (r) => { const DB = d1(); await signIn(DB, null); await ensureStoreTables({ DB }); if (r) rec(DB, r); return DB; };

  let DB = await fresh(ping({}));
  assert.equal((await get(DB)).tier, 'free', 'a ping with no Verse id unlocks nothing by itself');
  let r = await claim(DB, SALE, ' buyer@example.COM ');
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.equal((await get(DB)).tier, 'paid', 'the receipt claim unlocks the Verse');
  assert.equal(DB.raw.prepare('SELECT sale_id FROM void_accounts WHERE user_id = ?').get(USER).sale_id, SALE);
  assert.equal(DB.raw.prepare('SELECT void_id FROM void_sales').get().void_id, USER);
  assert.equal((await claim(DB, SALE, MAIL)).status, 200, 'claiming again from the same Verse is fine');

  DB = await fresh(ping({})); assert.equal((await claim(DB, '524459935', MAIL)).status, 200, 'the order number works too');
  DB = await fresh(null); assert.equal((await claim(DB, SALE, MAIL)).status, 404, 'no ping on record and no token: nothing to link');
  DB = await fresh(ping({})); assert.equal((await claim(DB, SALE, 'someone@else.com')).status, 403, 'the wrong email');
  DB = await fresh(ping({ 'url_params[void]': 'another-verse-id-0000' })); assert.equal((await claim(DB, SALE, MAIL)).status, 409, 'a purchase made for another Verse');
  DB = await fresh(ping({ seller_id: 'zzOtherSellerZZzzzzzzz==' })); assert.equal((await claim(DB, SALE, MAIL)).status, 403, 'another seller');
  DB = await fresh(ping({ product_id: 'other', product_permalink: 'https://moonbeam846.gumroad.com/l/other' })); assert.equal((await claim(DB, SALE, MAIL)).status, 404, 'another product');
  DB = await fresh(ping({}));
  DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES ('cancellation:sub-c:x', 'cancellation', NULL, 'sub-c', 'yinmj', NULL, 0, 'x', 'resource_name=cancellation', ?)").run(new Date().toISOString());
  assert.equal((await claim(DB, SALE, MAIL)).status, 403, 'a cancelled membership');
  DB = await fresh(ping({}));
  DB.raw.prepare("INSERT INTO void_accounts (user_id, tier, sale_id, updated) VALUES ('other-verse', 'paid', ?, ?)").run(SALE, new Date().toISOString());
  assert.equal((await claim(DB, SALE, MAIL)).status, 409, 'a sale already linked to another Verse');
  assert.equal((await get(DB)).tier, 'free');
  DB = await fresh(ping({})); assert.equal((await claim(DB, 'x', MAIL)).status, 400, 'a bad Order ID');

  // with GUMROAD_ACCESS_TOKEN and no ping on record, the sale is read back from Gumroad itself
  const api = (sale) => async () => new Response(JSON.stringify({ success: !!sale, sale }));
  const S = { id: SALE, email: MAIL, product_id: 'ITp6zMMOC7A2h-bsSejYSA==', product_permalink: 'https://moonbeam846.gumroad.com/l/yinmj', subscription_id: 'sub-c' };
  DB = await fresh(null); assert.equal((await claim(DB, SALE, MAIL, { GUMROAD_ACCESS_TOKEN: 't', GUMROAD_FETCH: api(S) })).status, 200, 'an API-confirmed sale');
  DB = await fresh(null); assert.equal((await claim(DB, SALE, MAIL, { GUMROAD_ACCESS_TOKEN: 't', GUMROAD_FETCH: api({ ...S, refunded: true }) })).status, 403, 'an API sale that was refunded');
  DB = await fresh(null); assert.equal((await claim(DB, SALE, MAIL, { GUMROAD_ACCESS_TOKEN: 't', GUMROAD_FETCH: api(null) })).status, 404, 'Gumroad does not know the sale');
});
