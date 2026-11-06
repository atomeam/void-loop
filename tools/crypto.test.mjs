// crypto (skills/crypto.js): what a price ask reads as (coin, currency), and the card run() draws from a canned CoinGecko answer (fetch stubbed, nothing leaves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { coinOf, sourcesOf, firstPrice, tickerOf } from '../void-live-deploy/skills/crypto.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const apiOf = (still = true) => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); pages.push(el); return el; }, _pageStill: () => still }; };
const withFetch = async (answer, fn) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); if (answer instanceof Error) throw answer; return { json: async () => answer }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };

test('the asks: coin, ticker, currency, an amount', () => {
  assert.deepEqual(coinOf('bitcoin price'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd' });
  assert.deepEqual(coinOf('how much is bitcoin'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd' });
  assert.deepEqual(coinOf('what is ethereum worth in euros'), { id: 'ethereum', name: 'ethereum', vs: 'eur' });
  assert.deepEqual(coinOf('price of btc in yen'), { id: 'bitcoin', name: 'btc', vs: 'jpy' });
  assert.deepEqual(coinOf('2 eth in euros'), { id: 'ethereum', name: 'eth', vs: 'eur', amount: 2 });
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

test('crypto: other languages\' price asks find the coin (exam: "precio del bitcoin")', async () => {
  const { coinOf } = await import('../void-live-deploy/skills/crypto.js');
  for (const a of ['precio del bitcoin', '¿cuánto vale el bitcoin?', 'prix du bitcoin', 'bitcoin preis']) assert.equal((coinOf(a) || {}).id, 'bitcoin', a);
  assert.equal((coinOf('preis von ethereum') || {}).id, 'ethereum');
  assert.equal(coinOf('precio del pan'), null);
  assert.equal((coinOf('bitcoin price') || {}).id, 'bitcoin');
});

// exam prices (asked by Verse: "Fix the prices exam by solving failures in ethereum and currency conversion queries"): every way
// a person asks for ether reads as ether, and a price comes back fast from whichever source answers first
test('ethereum, said every way: price words, a currency it is turned into, a trading pair, an amount', () => {
  for (const a of ['how much is ethereum', 'eth price', 'price of ethereum', 'ethereum price', 'what is the price of eth', 'eth price now', 'how much is one eth', 'ether price today'])
    assert.deepEqual(coinOf(a), { id: 'ethereum', name: a.match(/eth(?:ereum|er)?/)[0], vs: 'usd' }, a);
  assert.deepEqual(coinOf('eth to usd'), { id: 'ethereum', name: 'eth', vs: 'usd' });
  assert.deepEqual(coinOf('ethereum in dollars'), { id: 'ethereum', name: 'ethereum', vs: 'usd' });
  assert.deepEqual(coinOf('ethereum to euros'), { id: 'ethereum', name: 'ethereum', vs: 'eur' });
  assert.deepEqual(coinOf('eth/usd'), { id: 'ethereum', name: 'eth', vs: 'usd' });
  assert.deepEqual(coinOf('ETH-EUR'), { id: 'ethereum', name: 'eth', vs: 'eur' });
  assert.deepEqual(coinOf('eth usd'), { id: 'ethereum', name: 'eth', vs: 'usd' });
  assert.deepEqual(coinOf('1 eth to usd'), { id: 'ethereum', name: 'eth', vs: 'usd' });
  assert.deepEqual(coinOf('convert 0.5 eth to usd'), { id: 'ethereum', name: 'eth', vs: 'usd', amount: 0.5 });
  assert.deepEqual(coinOf('how much is 3 eth'), { id: 'ethereum', name: 'eth', vs: 'usd', amount: 3 });
  assert.deepEqual(coinOf('how much are 2 bitcoin worth'), { id: 'bitcoin', name: 'bitcoin', vs: 'usd', amount: 2 });
  // not a price: what it is, a word that is no currency, a bare amount, a coin turned into a coin
  for (const a of ['what is ethereum', 'ethereum', 'ethereum today', 'ethereum to the moon', 'eth to btc', '2 eth', 'eth now', 'who made ethereum'])
    assert.equal(coinOf(a), null, a);
  for (const a of ['eth to usd', 'ethereum in dollars', 'eth/usd', 'convert 0.5 eth to usd']) assert.ok(crypto.match(a.toLowerCase(), a), a);
  assert.equal(tickerOf('ethereum'), 'ETH'); assert.equal(tickerOf('nope'), '');
});

test('sources: CoinGecko first; Verse Markets (dollars only) and Coinbase wait 1.2 s; each reads its own answer', () => {
  const usd = sourcesOf({ id: 'ethereum', vs: 'usd' }), eur = sourcesOf({ id: 'ethereum', vs: 'eur' });
  assert.deepEqual(usd.map((s) => [s.name, s.delay]), [['CoinGecko', 0], ['Verse Markets', 1200], ['Coinbase', 1200]]);
  assert.deepEqual(eur.map((s) => s.name), ['CoinGecko', 'Coinbase'], 'Verse Markets prices in dollars only');
  assert.equal(usd[1].url, '/api/markets?w=ETH'); assert.equal(eur[1].url, 'https://api.coinbase.com/v2/prices/ETH-EUR/spot');
  assert.deepEqual(usd[0].read({ ethereum: { usd: 3000, usd_24h_change: 1.5, last_updated_at: 10 } }), { price: 3000, change: 1.5, at: 10000 });
  assert.equal(usd[0].read({}), null);
  assert.deepEqual(usd[1].read({ ok: true, quotes: [{ ok: true, price: 3001, pct: 2, asOf: 5, source: 'CoinGecko' }] }), { price: 3001, change: 2, at: 5, via: 'CoinGecko' });
  assert.equal(usd[1].read({ ok: true, quotes: [{ ok: true, price: 3001, pct: 2, asOf: 5, source: 'Yahoo Finance (unofficial)' }] }).change, null, "Yahoo's day move is not called 24 hours");
  assert.equal(usd[1].read({ ok: false }), null);
  assert.deepEqual(eur[1].read({ data: { amount: '2800.5', base: 'ETH', currency: 'EUR' } }), { price: 2800.5, change: null, at: 0 });
  assert.equal(eur[1].read({ data: { amount: '1', currency: 'USD' } }), null, 'a price in another currency is not this one');
  assert.deepEqual(sourcesOf({ id: 'some-coin', vs: 'usd' }).map((s) => s.name), ['CoinGecko'], 'a coin with no ticker has one source');
});

// a clock the test moves by hand: wait(ms) resolves when tick() passes it
const clock = () => { const timers = []; let now = 0;
  return { wait: (d) => { const t = { at: now + d }; const p = new Promise((r) => { t.go = r; }); timers.push(t); return [p, () => { t.cancelled = true; }]; },
    tick: async (ms) => { now += ms; for (const t of timers) if (!t.cancelled && t.at <= now && !t.fired) { t.fired = true; t.go(); } for (let i = 0; i < 5; i++) await Promise.resolve(); }, timers }; };
const src = (name, delay, price) => ({ name, delay, url: name, read: (j) => (j && j.p ? { price: j.p } : null), price });
const flush = () => new Promise((r) => setImmediate(r));

test('firstPrice: a fast first source wins and the late ones never start', async () => {
  const c = clock(), asked = [];
  const f = async (u) => { asked.push(u); return { ok: true, json: async () => ({ p: 10 }) }; };
  const hit = await firstPrice([src('a', 0), src('b', 1200), src('c', 1200)], f, { wait: c.wait });
  assert.equal(hit.price, 10); assert.equal(hit.source.name, 'a');
  await c.tick(5000); await flush();
  assert.deepEqual(asked, ['a'], 'b and c were never asked');
  assert.ok(c.timers.every((t) => t.cancelled), 'their timers were stopped');
});

test('firstPrice: a first source that hangs is overtaken after the delay; one that fails starts the rest at once', async () => {
  const c = clock(), asked = [];
  const hang = async (u) => { asked.push(u); if (u === 'a') return new Promise(() => {}); return { ok: true, json: async () => ({ p: u === 'b' ? 20 : 30 }) }; };
  const p = firstPrice([src('a', 0), src('b', 1200), src('c', 1200)], hang, { wait: c.wait });
  await flush(); assert.deepEqual(asked, ['a']);
  await c.tick(1200);
  const hit = await p; assert.equal(hit.source.name, 'b'); assert.equal(hit.price, 20); assert.deepEqual(asked.sort(), ['a', 'b', 'c']);
  const c2 = clock(), asked2 = [];
  const fail = async (u) => { asked2.push(u); if (u === 'a') return { ok: false, status: 429, json: async () => ({}) }; return { ok: true, json: async () => ({ p: 7 }) }; };
  const hit2 = await firstPrice([src('a', 0), src('b', 1200)], fail, { wait: c2.wait });
  assert.equal(hit2.source.name, 'b'); assert.deepEqual(asked2, ['a', 'b'], 'b started without waiting for the clock');
  await assert.rejects(firstPrice([src('a', 0), src('b', 1200)], async () => ({ ok: true, json: async () => ({ p: 0 }) }), { wait: clock().wait }), 'no price anywhere: rejects');
});

test('run: CoinGecko silent, the price comes from the next source; an amount is priced and its unit price shown', async () => {
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); if (/coingecko/.test(u)) throw new Error('429'); if (/^\/api\/markets/.test(u)) return { ok: true, json: async () => ({ ok: true, quotes: [{ ok: true, price: 3000, pct: -1, asOf: 0, source: 'CoinGecko' }] }) }; return { ok: true, json: async () => ({ data: { amount: '3010', currency: 'USD' } }) }; };
  try {
    const api = apiOf(); assert.equal(await crypto.run('how much is ethereum', api), 'crypto');
    const h = api.pages[0].innerHTML; assert.ok(/\$3,0[01]0\.00/.test(h), h); assert.ok(/Verse Markets|Coinbase/.test(h), h); assert.ok(!h.includes('…'), h);
    const api2 = apiOf(); assert.equal(await crypto.run('convert 2 eth to usd', api2), 'crypto');
    const h2 = api2.pages[0].innerHTML; assert.ok(h2.includes('<h2>2 ETH</h2>'), h2); assert.ok(/\$6,0[02]0\.00/.test(h2), h2); assert.ok(/1 ETH = \$3,0[01]0\.00/.test(h2), h2);
  } finally { globalThis.fetch = real; }
});
