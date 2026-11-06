// Verse's paid services over MCP (lib/mcp.js PAID_TOOLS, functions/api/mcp.js ctx.paid), on x402's MCP transport (x402 Foundation,
// specs/transports-v2/mcp.md): tools/list names a paid_* tool for every service sold; a call without payment is a tool result with isError and
// the PaymentRequired object (x402Version 2, Verse's wallet on eip155:8453) in structuredContent and as JSON text; the call again with
// _meta["x402/payment"] is verified, worked, settled and answered with _meta["x402/payment-response"]; a call the route refuses is never
// settled; a payment to anyone else is refused with the terms again. Every outside call is faked.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SERVICES } from '../void-live-deploy/lib/x402.js';
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';
import { rpc, TOOLS, PAID_TOOLS, paidResult, PAY_META, PAY_RESPONSE_META } from '../void-live-deploy/lib/mcp.js';
import { onRequestPost, mcpFailure } from '../void-live-deploy/functions/api/mcp.js';

const PAYER = '0x3333333333333333333333333333333333333333', TX = '0x' + 'ab'.repeat(32), origin = 'https://a-to-mind.com';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a); return r == null ? null : col ? r[col] : r; } });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
}
const realFetch = globalThis.fetch;
function facilitator(settles = true) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url); calls.push(u);
    if (u.endsWith('/verify')) return Response.json({ isValid: true, payer: PAYER });
    if (u.endsWith('/settle')) return settles ? Response.json({ success: true, transaction: TX, network: 'eip155:8453', payer: PAYER }) : Response.json({ success: false, errorReason: 'insufficient_funds' });
    return new Response('offline in tests', { status: 503 });
  };
  return calls;
}
const call = async (env, name, args, meta) => {
  const body = { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args, ...(meta ? { _meta: meta } : {}) } };
  const r = await onRequestPost({ request: new Request(origin + '/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }), env, waitUntil: () => {} });
  assert.equal(r.status, 200); return (await r.json()).result;
};
// a v2 PaymentPayload as an x402 client signs it, for the requirement it chose (the signature is faked: the facilitator is faked too)
const payload = (accepted, to = accepted.payTo) => ({ x402Version: 2, resource: { url: 'mcp://tool/paid_digest' }, accepted,
  payload: { signature: '0x' + 'cd'.repeat(65), authorization: { from: PAYER, to, value: accepted.amount, validAfter: '0', validBefore: '9999999999', nonce: '0x' + '01'.repeat(32) } } });

// the list: one paid tool for every service, priced, saying how to pay, with the service's own fields
const names = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools.map((t) => t.name);
for (const id of Object.keys(SERVICES)) {
  assert.ok(names.includes('paid_' + id), 'paid_' + id + ' is listed');
  const t = PAID_TOOLS.find((x) => x.name === 'paid_' + id);
  assert.match(t.description, /0\.05 USDC on Base/); assert.match(t.description, /_meta\["x402\/payment"\]/);
  assert.deepEqual(Object.keys(t.inputSchema.properties).sort(), Object.keys(SERVICES[id].input).sort());
  assert.equal(t.annotations.readOnlyHint, false, 'a paid call is not read-only: it can charge');
}
assert.ok(TOOLS.includes(PAID_TOOLS[0]));

const DIGEST = { text: 'Energy can be stored in batteries. Energy can also be stored by pumping water uphill. Flywheels store energy as motion. These are the three ways we cover today.', ask: 'what are the three ways' };
{
  const env = { DB: d1() };
  // no payment: the PaymentRequired result, the same object as text and as structuredContent, Verse's wallet on Base, 0.05 USDC
  const need = await call(env, 'paid_digest', DIGEST);
  assert.equal(need.isError, true);
  const pr = need.structuredContent;
  assert.equal(pr.x402Version, 2); assert.equal(pr.resource.url, 'mcp://tool/paid_digest'); assert.deepEqual(JSON.parse(need.content[0].text), pr);
  const acc = pr.accepts[0];
  assert.equal(acc.scheme, 'exact'); assert.equal(acc.network, 'eip155:8453'); assert.equal(acc.amount, '50000'); assert.equal(acc.payTo, VERSE_WALLET);
  assert.equal(mcpFailure({ method: 'tools/call', params: { name: 'paid_digest' } }, { result: need }), null, 'asking to be paid is not a failed call');

  // a bad call is refused before any payment: no terms, nothing to pay
  const bad = await call(env, 'paid_digest', { text: 'too short' });
  assert.equal(bad.isError, true); assert.equal(bad.structuredContent && bad.structuredContent.x402Version, undefined); assert.match(bad.content[0].text, /nothing was charged/);

  // a payment to anyone else: refused, the terms again with why
  const wrong = await call(env, 'paid_digest', DIGEST, { [PAY_META]: payload(acc, PAYER) });
  assert.equal(wrong.isError, true); assert.match(wrong.structuredContent.error, /does not pay Verse/);

  // paid: verified, the digest done, settled, the settlement in _meta, recorded for the treasury
  const calls = facilitator();
  try {
    const done = await call(env, 'paid_digest', DIGEST, { [PAY_META]: payload(acc) });
    assert.equal(done.isError, false); assert.ok(done.structuredContent.points.length);
    assert.equal(done._meta[PAY_RESPONSE_META].success, true); assert.equal(done._meta[PAY_RESPONSE_META].transaction, TX);
    assert.deepEqual(calls.filter((u) => /verify|settle/.test(u)).map((u) => u.split('/').pop()), ['verify', 'settle']);
    const row = env.DB.raw.prepare('SELECT * FROM void_x402').get();
    assert.equal(row.service, 'digest'); assert.equal(row.status, 'settled');
  } finally { globalThis.fetch = realFetch; }

  // settling fails after the work: no content, the terms with "Settlement failed" (the transport's rule)
  facilitator(false);
  try {
    const failed = await call({ DB: d1() }, 'paid_digest', DIGEST, { [PAY_META]: payload(acc) });
    assert.equal(failed.isError, true); assert.match(failed.structuredContent.error, /^Settlement failed/); assert.equal(failed.structuredContent.accepts[0].payTo, VERSE_WALLET);
    assert.equal(failed._meta, undefined);
  } finally { globalThis.fetch = realFetch; }

  // the route refuses the work (no picture): never settled, nothing charged
  const calls2 = facilitator();
  try {
    const no = await call({ DB: d1() }, 'paid_image', { prompt: 'x' }, { [PAY_META]: { ...payload(acc), resource: { url: 'mcp://tool/paid_image' } } });
    assert.equal(no.isError, true); assert.match(no.content[0].text, /nothing was charged/); assert.ok(!calls2.some((u) => u.endsWith('/settle')));
  } finally { globalThis.fetch = realFetch; }
}
// a malformed payment is refused without reaching the route
assert.equal((await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'paid_answer', arguments: { ask: 'what is a star' }, _meta: { [PAY_META]: 'nope' } } }, { paid: () => assert.fail('not reached') })).result.isError, true);
// a picture that comes back as a data URL is an MCP image block, not text
const pic = paidResult('image', { status: 200, body: { state: 'art', img: 'data:image/png;base64,iVBORw0KGgo=', seed: 4 }, settlement: { success: true, transaction: TX } });
assert.deepEqual(pic.content[1], { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' }); assert.equal(pic.structuredContent.img, undefined);
console.log('mcp x402: ok');
