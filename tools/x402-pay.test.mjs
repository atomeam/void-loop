// The paying side of Verse's code review Action over x402 (tools/x402-pay.mjs): it takes only USDC on Base at or under the limit, signs an
// EIP-3009 TransferWithAuthorization for exactly the amount asked to the address asked, sends it in the header of the version the 402
// spoke, and says paid only when the answer carries a settlement. The account is faked here (it records what it was asked to sign);
// with viem installed (the action installs it), the real signature is checked to recover to the payer.
import assert from 'node:assert/strict';
import { pick, payAndPost, USDC_BASE, TYPES } from './x402-pay.mjs';

const VERSE = '0x172198B6aBcDeF0123456789aBcDeF0123457196', ME = '0x3333333333333333333333333333333333333333', TX = '0x' + 'ab'.repeat(32);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64'), dec = (s) => JSON.parse(Buffer.from(s, 'base64').toString());
const acc = { scheme: 'exact', network: 'eip155:8453', amount: '50000', asset: USDC_BASE, payTo: VERSE, maxTimeoutSeconds: 120, extra: { name: 'USD Coin', version: '2' } };
const req2 = (accepts = [acc]) => new Headers({ 'payment-required': enc({ x402Version: 2, error: 'payment required', resource: { url: 'https://a-to-mind.com/api/x402/review' }, accepts }) });

// the terms it takes, and the ones it refuses before signing anything
assert.equal(pick(req2(), null, 50000n).units, 50000n);
assert.match(pick(req2(), null, 49999n).why, /over the limit/);
assert.match(pick(req2([{ ...acc, network: 'eip155:1' }]), null, 50000n).why, /USDC on Base/);
assert.match(pick(req2([{ ...acc, asset: '0x' + '9'.repeat(40) }]), null, 50000n).why, /USDC on Base/);
assert.match(pick(new Headers(), { accepts: [] }, 50000n).why, /no payment terms/);
assert.equal(pick(new Headers(), { x402Version: 1, accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '50000', asset: USDC_BASE, payTo: VERSE }] }, 50000n).version, 1, 'a v1 body is read too');

const signed = [];
const account = { address: ME, signTypedData: async (t) => { signed.push(t); return '0x' + 'cd'.repeat(65); } };
let sent;
const service = (settles = true) => async (url, init) => {
  const h = new Headers(init.headers);
  if (!h.get('payment-signature') && !h.get('x-payment')) return new Response('{"x402Version":1,"accepts":[]}', { status: 402, headers: req2() });
  sent = dec(h.get('payment-signature'));
  return new Response(JSON.stringify({ review: 'model', answer: 'Line 2 assigns instead of comparing.' }), { status: 200,
    headers: settles ? { 'payment-response': enc({ success: true, transaction: TX, network: 'eip155:8453', payer: ME }) } : {} });
};
const r = await payAndPost('https://a-to-mind.com/api/x402/review', { code: 'if (x = 5) {}' }, { account, fetchImpl: service() });
assert.equal(r.paid, true); assert.equal(r.json.answer, 'Line 2 assigns instead of comparing.'); assert.equal(r.settlement.transaction, TX);
const t = signed[0];
assert.equal(t.primaryType, 'TransferWithAuthorization'); assert.deepEqual(t.types, TYPES);
assert.deepEqual(t.domain, { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC_BASE });
assert.equal(t.message.to, VERSE.toLowerCase()); assert.equal(t.message.value, 50000n); assert.ok(t.message.validBefore > t.message.validAfter);
assert.equal(sent.x402Version, 2); assert.deepEqual(sent.accepted, acc); assert.equal(sent.payload.authorization.value, '50000'); assert.equal(sent.payload.authorization.from, ME);
assert.equal((await payAndPost('https://x/', {}, { account, fetchImpl: service(false) })).paid, false, 'no settlement, not paid');
assert.match((await payAndPost('https://x/', {}, { privateKey: 'nope' })).why, /not a 0x-prefixed/);
assert.equal((await payAndPost('https://x/', {}, { account, fetchImpl: async () => Response.json({ answer: 'free' }) })).paid, false, 'a free answer is never paid for');

// the real signature, where viem is installed (the action's own install)
let viem = null; try { viem = await import('viem'); } catch (_) {}
if (viem) {
  const { privateKeyToAccount, generatePrivateKey } = await import('viem/accounts');
  const real = privateKeyToAccount(generatePrivateKey());
  await payAndPost('https://x/', {}, { account: real, fetchImpl: service() });
  const a = sent.payload.authorization;
  assert.equal(await viem.verifyTypedData({ address: real.address, domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC_BASE }, types: TYPES, primaryType: 'TransferWithAuthorization',
    message: { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) }, signature: sent.payload.signature }), true);
}
console.log('x402 pay: ok' + (viem ? ' (signature verified with viem)' : ''));
