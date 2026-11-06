// Verse's own wallet and x402 pay-per-call (lib/x402.js, lib/verse-wallet.js, functions/api/x402/): the payment requirements
// in both protocol versions, refusing a payment that does not pay Verse, the verify -> work -> settle order (no settlement, no read,
// no charge), Coinbase CDP's two tokens signed the way its docs say, the wallet's address order, and USDC income counted in the
// treasury only after the chain shows it. Every outside call is faked: no network, no key.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { requirements, paymentRequired, readPayment, verify, settle, settlementHeader, facilitatorOf, DEFAULT_FACILITATOR, USDC_BASE, SERVICES, centsOf } from '../void-live-deploy/lib/x402.js';
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';
import { walletOf, bearerJwt, walletJwt, sortedJson, cdpAccount, usdcIncome, recordPayment, confirmPayments, usdcBalance } from '../void-live-deploy/lib/verse-wallet.js';
import * as route from '../void-live-deploy/functions/api/x402/review.js';
import { onRequestGet as x402Catalog } from '../void-live-deploy/functions/api/x402/index.js';
import * as treasury from '../void-live-deploy/functions/api/treasury.js';
import { railsOf } from '../void-live-deploy/lib/alt-pay.js';

const VERSE = '0x1111111111111111111111111111111111111111', OTHER = '0x2222222222222222222222222222222222222222', PAYER = '0x3333333333333333333333333333333333333333';
const TX = '0x' + 'ab'.repeat(32);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64').toString());
const origin = 'https://a-to-mind.com';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
}
const auth = (to = VERSE, value = '50000') => ({ from: PAYER, to, value, validAfter: '0', validBefore: '9999999999', nonce: '0x' + '01'.repeat(32) });
const v1Pay = (o = {}) => ({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' + 'cd'.repeat(65), authorization: auth(o.to, o.value) }, ...(o.top || {}) });

// ---- requirements, both versions ----
const req = requirements('review', VERSE, origin);
assert.equal(req.v1.network, 'base'); assert.equal(req.v1.maxAmountRequired, '50000'); assert.equal(req.v1.asset, USDC_BASE); assert.equal(req.v1.payTo, VERSE);
assert.equal(req.v1.resource, origin + '/api/x402/review'); assert.deepEqual(req.v1.extra, { name: 'USD Coin', version: '2' }, 'USDC\'s EIP-712 domain on Base mainnet');
assert.equal(req.v1.outputSchema.input.method, 'POST'); assert.equal(req.v1.outputSchema.input.discoverable, true, 'bazaar listing metadata');
assert.equal(req.v2.network, 'eip155:8453'); assert.equal(req.v2.amount, '50000');
assert.equal(requirements('review', 'not-an-address', origin), null, 'no wallet, no requirements');
assert.equal(requirements('nope', VERSE, origin), null);
assert.equal(centsOf('50000'), 5); assert.equal(centsOf('59999'), 5, 'a micro-remainder is never rounded up');
assert.equal(facilitatorOf({}), DEFAULT_FACILITATOR); assert.equal(facilitatorOf({ X402_FACILITATOR_URL: 'http://x' }), DEFAULT_FACILITATOR, 'https only');
assert.equal(facilitatorOf({ X402_FACILITATOR_URL: 'https://f.example/x402/' }), 'https://f.example/x402');

const pr = paymentRequired(req, 'X-PAYMENT header is required');
assert.equal(pr.status, 402);
const body402 = await pr.json(); assert.equal(body402.x402Version, 1); assert.equal(body402.accepts[0].payTo, VERSE);
const v2req = unb64(pr.headers.get('payment-required')); assert.equal(v2req.x402Version, 2); assert.equal(v2req.accepts[0].network, 'eip155:8453'); assert.equal(v2req.resource.url, origin + '/api/x402/review');

// ---- reading the payment ----
const R = (h) => new Request(origin + '/api/x402/review', { method: 'POST', headers: h });
assert.equal(readPayment(R({}), req), null);
assert.ok(readPayment(R({ 'x-payment': '!!!' }), req).bad);
assert.match(readPayment(R({ 'x-payment': b64(v1Pay({ top: { network: 'base-sepolia' } })) }), req).bad, /Base/);
assert.match(readPayment(R({ 'x-payment': b64(v1Pay({ to: OTHER })) }), req).bad, /Verse's address/, 'a payment to anyone else is refused');
assert.match(readPayment(R({ 'x-payment': b64(v1Pay({ value: '49999' })) }), req).bad, /less than 0.050000/);
const ok1 = readPayment(R({ 'x-payment': b64(v1Pay()) }), req);
assert.equal(ok1.version, 1); assert.equal(ok1.requirements, req.v1);
const v2p = { x402Version: 2, resource: req.resourceInfo, accepted: req.v2, payload: { signature: '0x' + 'cd'.repeat(65), authorization: auth() } };
const ok2 = readPayment(R({ 'payment-signature': b64(v2p) }), req);
assert.equal(ok2.version, 2); assert.equal(ok2.requirements, req.v2);
assert.match(readPayment(R({ 'payment-signature': b64({ ...v2p, accepted: { ...req.v2, asset: OTHER } }) }), req).bad, /USDC/);

// ---- the facilitator ----
function facilitator({ valid = true, settled = true } = {}) {
  const calls = [];
  const f = async (url, init) => {
    const u = String(url), body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ u, body });
    if (u.endsWith('/verify')) return Response.json(valid ? { isValid: true, payer: PAYER } : { isValid: false, invalidReason: 'insufficient_funds', payer: PAYER });
    if (u.endsWith('/settle')) return Response.json(settled ? { success: true, transaction: TX, network: 'base', payer: PAYER } : { success: false, errorReason: 'invalid_transaction_state', transaction: '', network: 'base' });
    throw new Error('unexpected fetch ' + u);
  };
  return { f, calls };
}
{
  const { f, calls } = facilitator();
  assert.deepEqual(await verify({}, ok1, f), { ok: true, payer: PAYER });
  assert.equal(calls[0].u, DEFAULT_FACILITATOR + '/verify');
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['paymentPayload', 'paymentRequirements', 'x402Version'], 'the spec\'s /verify body');
  const s = await settle({}, ok1, f); assert.equal(s.ok, true); assert.equal(s.transaction, TX);
  const [h, v] = settlementHeader(1, s); assert.equal(h, 'x-payment-response'); assert.equal(unb64(v).transaction, TX);
  assert.equal(settlementHeader(2, s)[0], 'payment-response');
  assert.equal((await verify({}, ok1, facilitator({ valid: false }).f)).reason, 'insufficient_funds');
  assert.equal((await settle({}, ok1, facilitator({ settled: false }).f)).ok, false);
}

// ---- the route: 402, then verify -> read -> settle ----
const answer = JSON.stringify({ findings: [{ file: '', line: 2, kind: 'bug', text: '= should be ===', quote: '  if (x = 5) { return eval(x); }' }] });
const BUGGY = 'function f(x) {\n  if (x = 5) { return eval(x); }\n}';
const envOf = (extra = {}) => ({ DB: d1(), AI: { run: async () => ({ response: answer }) }, ...extra });
const post = (env, body, headers = {}) => route.onRequestPost({ request: new Request(origin + '/api/x402/review', { method: 'POST', headers, body: JSON.stringify(body) }), env, params: { path: ['review'] } });
const realFetch = globalThis.fetch;
const withFetch = async (f, fn) => { globalThis.fetch = f; try { return await fn(); } finally { globalThis.fetch = realFetch; } };
{
  const env = envOf();
  assert.equal((await post(env, { code: BUGGY })).status, 503, 'no wallet: closed, nothing charged');
  env.VERSE_WALLET_ADDR = VERSE;
  assert.equal((await post(env, { code: 'x' })).status, 400, 'a bad call is refused before any payment');
  const r402 = await post(env, { code: BUGGY });
  assert.equal(r402.status, 402); assert.ok(r402.headers.get('payment-required'));
  assert.equal((await post(env, { code: BUGGY }, { 'x-payment': b64(v1Pay({ to: OTHER })) })).status, 402);
  const fac = facilitator();
  const paid = await withFetch(fac.f, () => post(env, { code: BUGGY }, { 'x-payment': b64(v1Pay()) }));
  assert.equal(paid.status, 200);
  const pj = await paid.json();
  assert.equal(pj.tier, 'x402'); assert.equal(pj.review, 'model'); assert.match(pj.answer, /===/);
  assert.equal(unb64(paid.headers.get('x-payment-response')).transaction, TX);
  assert.deepEqual(fac.calls.map((c) => c.u.split('/').pop()), ['verify', 'settle'], 'verify first, settle after the read is written');
  const row = env.DB.raw.prepare('SELECT * FROM void_x402').get();
  assert.equal(row.tx, TX); assert.equal(row.status, 'settled', 'recorded, not counted until the chain shows it'); assert.equal(row.pay_to, VERSE); assert.equal(row.units, '50000');

  const env2 = envOf({ VERSE_WALLET_ADDR: VERSE });
  const failed = await withFetch(facilitator({ settled: false }).f, () => post(env2, { code: BUGGY }, { 'x-payment': b64(v1Pay()) }));
  const fj = await failed.json();
  assert.equal(fj.paid, false); assert.equal(fj.answer, undefined, 'no settlement, no closer read'); assert.equal(failed.headers.get('x-payment-response'), null);
  assert.equal(env2.DB.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'void_x402'").get().n, 0, 'nothing recorded');
  const invalid = await withFetch(facilitator({ valid: false }).f, () => post(env2, { code: BUGGY }, { 'x-payment': b64(v1Pay()) }));
  assert.equal(invalid.status, 402); assert.match((await invalid.json()).error, /insufficient_funds/);
  const v2paid = await withFetch(facilitator().f, () => post(env2, { code: BUGGY }, { 'payment-signature': b64(v2p) }));
  assert.equal(v2paid.status, 200); assert.ok(v2paid.headers.get('payment-response'), 'v2 gets PAYMENT-RESPONSE');

  const g = await (await x402Catalog({ request: new Request(origin + '/api/x402'), env })).json();
  assert.equal(g.pay_to, VERSE); assert.equal(g.services[0].price_usdc, '0.050000'); assert.equal(g.services[0].open, true);
}

// ---- Coinbase CDP: the two tokens, signed the way docs.cdp.coinbase.com/api-reference/v2/authentication says ----
const subtle = webcrypto.subtle;
const ed = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const edJwk = await subtle.exportKey('jwk', ed.privateKey);
const seedPub = Buffer.concat([Buffer.from(edJwk.d, 'base64url'), Buffer.from(edJwk.x, 'base64url')]);
const ec = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const ecPkcs8 = Buffer.from(await subtle.exportKey('pkcs8', ec.privateKey)).toString('base64');
const cdpEnv = { CDP_API_KEY_ID: 'key-id-1', CDP_API_KEY_SECRET: seedPub.toString('base64'), CDP_WALLET_SECRET: ecPkcs8 };
const parts = (jwt) => { const [h, c, s] = jwt.split('.'); return { h: JSON.parse(Buffer.from(h, 'base64url')), c: JSON.parse(Buffer.from(c, 'base64url')), signed: Buffer.from(h + '.' + c), sig: Buffer.from(s, 'base64url') }; };
{
  const j = parts(await bearerJwt(cdpEnv, 'POST', '/platform/v2/evm/accounts', 1000));
  assert.equal(j.h.alg, 'EdDSA'); assert.equal(j.h.kid, 'key-id-1'); assert.match(j.h.nonce, /^[0-9a-f]{32}$/);
  assert.deepEqual({ sub: j.c.sub, iss: j.c.iss, aud: j.c.aud, nbf: j.c.nbf, exp: j.c.exp, uris: j.c.uris }, { sub: 'key-id-1', iss: 'cdp', aud: ['cdp_service'], nbf: 1000, exp: 1120, uris: ['POST api.cdp.coinbase.com/platform/v2/evm/accounts'] });
  assert.ok(await subtle.verify({ name: 'Ed25519' }, ed.publicKey, j.sig, j.signed), 'the bearer token verifies with the key\'s public half');
  const w = parts(await walletJwt(cdpEnv, 'POST', '/platform/v2/evm/accounts', { name: 'verse-treasury' }, 1000));
  assert.equal(w.h.alg, 'ES256');
  assert.equal(w.c.reqHash, Buffer.from(await subtle.digest('SHA-256', Buffer.from('{"name":"verse-treasury"}'))).toString('hex'));
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ec.publicKey, w.sig, w.signed), 'the wallet token verifies with the secret\'s public half');
  assert.equal(sortedJson({ b: 1, a: { d: 1, c: [2, 1] } }), '{"a":{"c":[2,1],"d":1},"b":1}');
  assert.equal((await walletJwt(cdpEnv, 'GET', '/x', null)).split('.').length, 3);
  await assert.rejects(bearerJwt({ ...cdpEnv, CDP_API_KEY_SECRET: Buffer.alloc(32).toString('base64') }, 'GET', '/x'), /Ed25519/);

  const seen = [];
  const made = await cdpAccount(cdpEnv, async (u, init) => { seen.push({ u, init }); return Response.json({ address: VERSE, name: 'verse-treasury' }, { status: 201 }); });
  assert.equal(made.address, VERSE); assert.equal(seen[0].u, 'https://api.cdp.coinbase.com/platform/v2/evm/accounts');
  assert.ok(seen[0].init.headers.authorization.startsWith('Bearer ')); assert.ok(seen[0].init.headers['x-wallet-auth']);
  const again = await cdpAccount(cdpEnv, async (u) => (String(u).endsWith('/by-name/verse-treasury') ? Response.json({ address: OTHER }) : Response.json({ errorType: 'already_exists' }, { status: 409 })));
  assert.equal(again.address, OTHER, 'made before: found by name, never a second account');
  const src = readFileSync(new URL('../void-live-deploy/lib/verse-wallet.js', import.meta.url), 'utf8');
  const paths = [...src.matchAll(/'(\/platform\/v2\/[^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(paths, ['/platform/v2/evm/accounts'], 'one CDP path: accounts (create, and get by name)');
  assert.ok(!/send-transaction|sign\/transaction|sendTransaction|eth_sendRawTransaction|\/transfers/i.test(src), 'the wallet code has no path that sends or signs a transaction');
}

// ---- the wallet's address, in order ----
{
  assert.equal(await walletOf({}), null);
  assert.equal(VERSE_WALLET === '' || /^0x[0-9a-fA-F]{40}$/.test(VERSE_WALLET), true, 'the repo address is empty or one 0x address');
  assert.deepEqual(await walletOf({}, fetch, VERSE), { address: VERSE, source: 'set', note: 'Verse\'s wallet address, kept with the site' }, 'the repo address opens paid calls with no Cloudflare step');
  assert.equal((await walletOf({ VERSE_WALLET_ADDR: OTHER }, fetch, VERSE)).address, OTHER, 'the Pages variable wins over the repo line');
  assert.equal(await walletOf({}, fetch, 'not-an-address'), null, 'a malformed repo address opens nothing');
  assert.equal((await walletOf({ CRYPTO_USDC_BASE_ADDR: OTHER })).source, 'store');
  assert.equal((await walletOf({ VERSE_WALLET_ADDR: VERSE, CRYPTO_USDC_BASE_ADDR: OTHER })).address, VERSE);
  const env = { DB: d1(), ...cdpEnv, CRYPTO_USDC_BASE_ADDR: OTHER };
  let n = 0;
  const f = async () => { n++; return Response.json({ address: VERSE }, { status: 201 }); };
  assert.deepEqual([(await walletOf(env, f)).source, (await walletOf(env, f)).address, n], ['cdp', VERSE, 1], 'Verse makes its CDP wallet once and keeps the address');
  assert.equal((await walletOf({ DB: d1(), ...cdpEnv, CRYPTO_USDC_BASE_ADDR: OTHER }, async () => new Response('no', { status: 500 }))).source, 'store', 'CDP down: the store address still receives');
  assert.equal(railsOf({ VERSE_WALLET_ADDR: VERSE })['usdc-base'].address, VERSE.toLowerCase(), 'the store\'s USDC rail opens on Verse\'s wallet');
  assert.equal(railsOf({ VERSE_WALLET_ADDR: VERSE, CRYPTO_USDC_BASE_ADDR: OTHER })['usdc-base'].address, OTHER.toLowerCase(), 'an existing store address is kept');
}

// ---- income: counted only once the chain shows it ----
const pad = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
const chain = ({ to = VERSE, value = 50000n, ok = true } = {}) => async (_u, init) => {
  const { method } = JSON.parse(init.body);
  if (method === 'eth_blockNumber') return Response.json({ result: '0x64' });
  if (method === 'eth_call') return Response.json({ result: '0x' + (1234560n).toString(16) });
  return Response.json({ result: ok ? { status: '0x1', blockNumber: '0x10', logs: [{ address: USDC_BASE, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad(PAYER), pad(to)], data: '0x' + value.toString(16) }] } : null });
};
{
  assert.deepEqual(usdcIncome([{ status: 'verified', units: '50000' }, { status: 'settled', units: '50000' }, { status: 'not on chain', units: '50000' }], [{ provider: 'usdc-base', status: 'paid', cents: 900 }, { provider: 'usdc-base', status: 'awaiting', cents: 900 }]),
    { x402_payments: 1, x402_cents: 5, x402_waiting: 1, store_usdc_orders: 1, store_usdc_cents: 900, cents: 905 });
  assert.equal(await usdcBalance({}, VERSE, chain()), '1234560');
  const policy = JSON.parse(readFileSync(new URL('../void-live-deploy/treasury/policy.json', import.meta.url), 'utf8'));
  const env = { DB: d1(), VERSE_WALLET_ADDR: VERSE, ASSETS: { fetch: async () => Response.json(policy) } };
  await recordPayment(env, { tx: TX, service: 'review', units: '50000', network: 'base', payTo: VERSE });
  await recordPayment(env, { tx: '0x' + 'ef'.repeat(32), service: 'review', units: '50000', network: 'base', payTo: VERSE });
  const read = () => withFetch(chain(), async () => (await treasury.onRequestGet({ request: new Request(origin + '/api/treasury'), env })).json());
  // both rows go through the same fake chain: each shows a 0.05 USDC transfer to Verse 84 blocks deep, so both are confirmed
  const t = await read();
  assert.equal(t.revenue.usdc.x402_payments, 2); assert.equal(t.revenue.usdc.x402_cents, 10);
  assert.equal(t.revenue.realized_cents, 10, 'USDC received is realized revenue, no fee taken off');
  assert.equal(t.split_cents, 10, 'and it goes through the same split: Atom\'s cut first');
  assert.equal(t.wallet.address, VERSE); assert.equal(t.wallet.balance_units, '1234560'); assert.equal(t.wallet.balance_cents, 123);
  const env3 = { DB: d1(), VERSE_WALLET_ADDR: VERSE, ASSETS: env.ASSETS };
  await recordPayment(env3, { tx: TX, service: 'review', units: '50000', network: 'base', payTo: VERSE });
  await withFetch(chain({ value: 1n }), () => confirmPayments(env3));
  assert.equal(env3.DB.raw.prepare('SELECT status FROM void_x402').get().status, 'not on chain', 'a transfer that is not the amount is never counted');
  await recordPayment(env3, { tx: '0x' + '99'.repeat(32), service: 'review', units: '50000', network: 'base', payTo: VERSE });
  await withFetch(chain({ ok: false }), () => confirmPayments(env3));
  assert.equal(env3.DB.raw.prepare("SELECT status FROM void_x402 WHERE tx = ?").get('0x' + '99'.repeat(32)).status, 'settled', 'not on chain yet: tried again later');
}
assert.ok(SERVICES.review.units > 0);
console.log('x402 + wallet: ok');
