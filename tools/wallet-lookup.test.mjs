// Ethereum and Solana public address lookups on the markets card (wishlist #15, lists run 23, 2026-11-12): the free path the wishlist
// named, through PublicNode's keyless RPC (CORS open, no account, no key), read-only like the Bitcoin lookup. Never a key, never a trade.
// Run: node --test tools/wallet-lookup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import markets, { marketsAsk, walletChain, unitsOf, balanceCall, CHAIN } from '../void-live-deploy/skills/markets.js';

const ETH = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', SOL = 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg', BTC = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

test('the ask names the chain, or the address shape does; Bitcoin stays as it was', () => {
  assert.deepEqual(marketsAsk('ethereum wallet ' + ETH), { addr: ETH, chain: 'eth' });
  assert.deepEqual(marketsAsk('eth balance of ' + ETH), { addr: ETH, chain: 'eth' });
  assert.deepEqual(marketsAsk('wallet ' + ETH), { addr: ETH, chain: 'eth' }, 'a 0x address is EVM by its shape');
  assert.deepEqual(marketsAsk('solana wallet ' + SOL), { addr: SOL, chain: 'sol' });
  assert.deepEqual(marketsAsk('check sol address ' + SOL), { addr: SOL, chain: 'sol' });
  assert.deepEqual(marketsAsk('bitcoin wallet ' + BTC), { addr: BTC }, 'the Bitcoin lookup is unchanged');
  assert.deepEqual(marketsAsk('wallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), { addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' }, 'a Bitcoin-shaped address stays Bitcoin');
  assert.equal(marketsAsk('ethereum wallet ' + SOL), null, 'a named chain the address does not fit is no lookup');
  assert.equal(marketsAsk('solana wallet ' + ETH), null);
  assert.equal(walletChain('not an address'), null);
  assert.ok(marketsAsk('here is my seed phrase').refuse, 'a seed phrase is still refused');
});

test('amounts come out exact from wei and lamports', () => {
  assert.equal(unitsOf('eth', '0xde0b6b3a7640000'), '1');
  assert.equal(unitsOf('eth', '0x' + (5794616980000000000n + 123n).toString(16)), '5.79461698', 'cut at 8 decimals, not rounded up by a float');
  assert.equal(unitsOf('eth', '0x0'), '0');
  assert.equal(unitsOf('eth', '0x' + (12345678n * 10n ** 18n).toString(16)), '12,345,678');
  assert.equal(unitsOf('sol', 39869364), '0.03986936');
  assert.equal(unitsOf('sol', 2500000000), '2.5');
  assert.equal(unitsOf('sol', 0), '0');
  assert.deepEqual(balanceCall('eth', ETH), { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [ETH, 'latest'] });
  assert.deepEqual(balanceCall('sol', SOL), { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [SOL] });
  for (const c of Object.values(CHAIN)) for (const u of c.rpc) assert.ok(u.startsWith('https://'), u);
});

test('the card reads the balance, falls back to the next public node, and says so plainly when none answers', async () => {
  const calls = [];
  const page = { innerHTML: '' };
  const api = { showPage: (f) => { f(page); return page; }, esc: (s) => String(s).replace(/[&<>"']/g, '') };
  globalThis.fetch = async (url, init) => { calls.push(url); const body = JSON.parse(init.body);
    if (url.includes('solana-rpc.publicnode.com')) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => (body.method === 'getBalance' ? { result: { value: 2500000000 } } : { result: '0xde0b6b3a7640000' }) }; };
  await markets.run('ethereum wallet ' + ETH, api);
  assert.match(page.innerHTML, /1 ETH/); assert.match(page.innerHTML, /etherscan\.io\/address\//i); assert.match(page.innerHTML, /read-only/);
  await markets.run('solana wallet ' + SOL, api);
  assert.match(page.innerHTML, /2\.5 SOL/); assert.match(page.innerHTML, /solscan\.io\/account\//);
  assert.ok(calls.includes('https://api.mainnet-beta.solana.com'), 'the second node is asked when the first fails');
  globalThis.fetch = async () => { throw new Error('offline'); };
  await markets.run('ethereum wallet ' + ETH, api);
  assert.match(page.innerHTML, /didn't answer/);
});
