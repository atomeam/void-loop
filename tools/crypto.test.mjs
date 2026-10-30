// crypto (skills/crypto.js): what a price ask reads as (coin, currency), and the card run() draws from a canned CoinGecko answer (fetch stubbed, nothing leaves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { coinOf } from '../void-live-deploy/skills/crypto.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const apiOf = (still = true) => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); pages.push(el); return el; }, _pageStill: () => still }; };
const withFetch = async (answer, fn) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); if (answer instanceof Error) throw answer; return { json: async () => answer }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };

test('the asks: coin, ticker, currency, an amount', () => {
  assert.deepEqual(coinOf('bitcoin price'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd' });
  assert.deepEqual(coinOf('how much is bitcoin'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd' });
  assert.deepEqual(coinOf('what is ethereum worth in euros'), { id: 'ethereum', name: 'ethereum', vs: 'eur' });
  assert.deepEqual(coinOf('price of btc in yen'), { id: 'bitcoin', name: 'btc', vs: 'jpy' });
  assert.deepEqual(coinOf('2 eth in euros'), { id: 'ethereum', name: 'eth', vs: 'eur' });
  assert.deepEqual(coinOf('What is 1 bitcoin in dollars?'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd' });
  assert.equal(coinOf('dogecoin price in pounds').vs, 'gbp'); assert.equal(coinOf('xrp price').id, 'ripple'); assert.equal(coinOf('bnb price').id, 'binancecoin');
  assert.equal(coinOf('what is bitcoin'), null); assert.equal(coinOf('pepe price'), null); assert.equal(coinOf('apple price'), null);
  for (const e of crypto.examples) assert.ok(crypto.match(e.toLowerCase(), e), e);
  for (const n of crypto.nearMisses) assert.ok(!crypto.match(n.toLowerCase(), n), n);
  for (const a of ['current price of solana', 'how much is one eth', 'monero value']) assert.ok(crypto.match(a.toLowerCase(), a), a);
  for (const a of ['bitcoin whitepaper', 'is ethereum a good investment', 'price of eggs']) assert.ok(!crypto.match(a.toLowerCase(), a), a);
});

test('run: asks CoinGecko for the coin and currency, shows the price, the 24 h change and the source', async () => {
  await withFetch({ bitcoin: { usd: 64250.5, usd_24h_change: -1.234, last_updated_at: 1700000000 } }, async (urls) => {
    const api = apiOf();
    assert.equal(await crypto.run('bitcoin price', api), 'crypto');
    assert.equal(urls.length, 1); assert.match(urls[0], /^https:\/\/api\.coingecko\.com\/api\/v3\/simple\/price\?ids=bitcoin&vs_currencies=usd&/);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Bitcoin</h2>'), h); assert.ok(h.includes('$64,250.50'), h);
    assert.ok(h.includes('-1.23% in 24 hours') && h.includes('#ff8a8a'), h);
    assert.ok(h.includes('https://www.coingecko.com/en/coins/bitcoin') && h.includes('not advice'), h);
  });
  await withFetch({ ethereum: { eur: 2100, eur_24h_change: 2.5 } }, async (urls) => {
    const api = apiOf(); assert.equal(await crypto.run('what is ethereum worth in euros', api), 'crypto');
    assert.ok(urls[0].includes('ids=ethereum&vs_currencies=eur'));
    const h = api.pages[0].innerHTML; assert.ok(h.includes('€2,100.00'), h); assert.ok(h.includes('+2.50% in 24 hours') && h.includes('#7fd6a0'), h);
  });
});

test('other currencies: rupees, pesos and the codes CoinGecko takes are asked for; one it does not take says the price is in dollars', async () => {
  assert.deepEqual(coinOf('price of bitcoin in rupees'), { id: 'bitcoin', name: 'bitcoin', vs: 'inr' });
  assert.deepEqual(coinOf('1 btc in pesos'), { id: 'bitcoin', name: 'btc', vs: 'mxn' });
  assert.equal(coinOf('bitcoin price in cad').vs, 'cad'); assert.equal(coinOf('2 eth in inr').vs, 'inr'); assert.equal(coinOf('dogecoin price in yuan').vs, 'cny');
  assert.deepEqual(coinOf('bitcoin price in kroner'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd', unknown: 'kroner' });
  await withFetch({ bitcoin: { inr: 5400000, inr_24h_change: 0.5 } }, async (urls) => {
    const api = apiOf(); assert.equal(await crypto.run('price of bitcoin in rupees', api), 'crypto');
    assert.ok(urls[0].includes('ids=bitcoin&vs_currencies=inr'), urls[0]);
    const h = api.pages[0].innerHTML; assert.ok(h.includes('₹'), h); assert.ok(!h.includes('Shown in US dollars'), h);
  });
  await withFetch({ bitcoin: { mxn: 1200000 } }, async (urls) => { const api = apiOf(); await crypto.run('1 btc in pesos', api); assert.ok(urls[0].includes('vs_currencies=mxn'), urls[0]); assert.ok(api.pages[0].innerHTML.includes('MX$'), api.pages[0].innerHTML); });
  await withFetch({ bitcoin: { usd: 64250.5 } }, async (urls) => {
    const api = apiOf(); assert.equal(await crypto.run('bitcoin price in kroner', api), 'crypto');
    assert.ok(urls[0].includes('vs_currencies=usd'), urls[0]);
    const h = api.pages[0].innerHTML; assert.ok(h.includes('$64,250.50'), h); assert.ok(h.includes('Shown in US dollars: "kroner" is not a currency I can price in.'), h);
  });
});

test('run: a coin the service has no price for, a dead service, a page left, an ask it does not read', async () => {
  await withFetch({}, async () => { const api = apiOf(); assert.equal(await crypto.run('solana price', api), 'none'); assert.ok(api.pages[0].innerHTML.includes("didn't answer just now")); });
  await withFetch(new Error('offline'), async () => { const api = apiOf(); assert.equal(await crypto.run('solana price', api), 'none'); assert.ok(api.pages[0].innerHTML.includes("didn't answer just now")); });
  await withFetch({ solana: { usd: 150 } }, async () => { const api = apiOf(false); assert.equal(await crypto.run('solana price', api), 'crypto'); assert.ok(!api.pages[0].innerHTML.includes('150')); });
  await withFetch({}, async (urls) => { const api = apiOf(); assert.equal(await crypto.run('who invented bitcoin', api), 'none'); assert.equal(urls.length, 0); assert.equal(api.pages.length, 0); });
});
