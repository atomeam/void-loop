// tools/wallet-watch.mjs: only USDC transfers into the wallet count, no transfer twice, totals survive the list being cut, the read
// resumes where it stopped and shrinks its range when the RPC asks, and the repo's wallet address is the one read. The chain is faked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { incoming, merge, read, walletFromSource, USDC_BASE, TRANSFER } from './wallet-watch.mjs';
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';

const W = '0x1111111111111111111111111111111111111111', P = '0x3333333333333333333333333333333333333333';
const t = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
const log = (block, i, units, { to = W, token = USDC_BASE, topic = TRANSFER, from = P } = {}) => ({ address: token, topics: [topic, t(from), t(to)], data: '0x' + BigInt(units).toString(16).padStart(64, '0'),
  blockNumber: '0x' + block.toString(16), logIndex: '0x' + i.toString(16), transactionHash: '0x' + String(block).padStart(64, 'a') });

assert.equal(walletFromSource(readFileSync(new URL('../void-live-deploy/lib/verse-wallet-address.js', import.meta.url), 'utf8')), VERSE_WALLET, 'reads the wallet the repo records');
assert.equal(walletFromSource("export const VERSE_WALLET = '';"), null);

// only USDC, only Transfer, only into the wallet; newest first
const rows = incoming([log(10, 0, 50000), log(12, 1, 2500000), log(11, 0, 9, { to: P }), log(13, 0, 7, { token: '0x' + '22'.repeat(20) }), log(14, 0, 7, { topic: '0x' + '00'.repeat(32) })], W);
assert.deepEqual(rows.map((r) => [r.block, r.units, r.from]), [[12, '2500000', P], [10, '50000', P]]);

// merge: no transfer twice; totals in cents
const a = merge(null, rows, { address: W, toBlock: 12, balanceUnits: '2550000', now: 'x' });
assert.equal(a.transfers_in, 2); assert.equal(a.received_units, '2550000'); assert.equal(a.received_cents, 255); assert.equal(a.balance_cents, 255);
const b = merge(a, [rows[0], ...incoming([log(20, 0, 50000)], W)], { address: W, toBlock: 20, balanceUnits: '2600000', now: 'y' });
assert.equal(b.transfers_in, 3, 'the transfer read twice counts once'); assert.equal(b.received_units, '2600000');
// another address: the old record does not carry over
assert.equal(merge(b, [], { address: P, toBlock: 21, balanceUnits: '0', now: 'z' }).transfers_in, 0);
// a cut list keeps its total
const many = incoming(Array.from({ length: 250 }, (_, i) => log(100 + i, 0, 1)), W);
const m = merge(null, many, { address: W, toBlock: 400, balanceUnits: '250', now: 'x' });
assert.equal(m.incoming.length, 200); assert.equal(m.transfers_in, 250); assert.equal(m.received_units, '250');
const m2 = merge(m, incoming([log(500, 0, 5)], W), { address: W, toBlock: 500, balanceUnits: '255', now: 'y' });
assert.equal(m2.transfers_in, 251); assert.equal(m2.received_units, '255', 'a transfer cut from the list still counts in the total');

// read: resumes after the last block, halves the range when the RPC refuses it, reads the balance
const realFetch = globalThis.fetch;
const ranges = [];
globalThis.fetch = async (_u, init) => {
  const q = JSON.parse(init.body);
  if (q.method === 'eth_blockNumber') return Response.json({ result: '0x' + (5000).toString(16) });
  if (q.method === 'eth_call') return Response.json({ result: '0x' + (123456).toString(16).padStart(64, '0') });
  const f = parseInt(q.params[0].fromBlock, 16), to = parseInt(q.params[0].toBlock, 16); ranges.push([f, to]);
  assert.equal(q.params[0].topics[2], t(W), 'asks only for transfers into the wallet');
  if (to - f + 1 > 1000) return Response.json({ error: { message: 'block range too large' } });
  return Response.json({ result: f <= 4000 && 4000 <= to ? [log(4000, 2, 50000)] : [] });
};
try {
  const r = await read({ url: 'https://rpc.test', address: W, prev: { ...a, read_to_block: 2999 }, now: 'n' });
  assert.equal(ranges[0][0], 3000, 'starts after the last block read');
  assert.ok(ranges.every(([f, to]) => f >= 3000 && to <= 5000)); assert.equal(r.read_to_block, 5000);
  assert.equal(r.balance_units, '123456'); assert.equal(r.transfers_in, 3); assert.equal(r.incoming[0].block, 4000);
  assert.equal(r.gap, undefined);
} finally { globalThis.fetch = realFetch; }
console.log('wallet watch: ok');
