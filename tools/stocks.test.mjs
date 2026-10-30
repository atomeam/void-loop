// stocks (skills/stocks.js): what a stock or index ask reads as, and the card run() draws from a canned /api/markets answer (fetch stubbed, nothing leaves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import stocks, { stockAsk, pageOfStock, cardHtml } from '../void-live-deploy/skills/stocks.js';
import { pageOfCard } from '../void-live-deploy/lib/card-frame.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const apiOf = (still = true) => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '', dataset: {} }; fn(el); pages.push(el); return el; }, _pageStill: () => still }; };
const withFetch = async (answer, fn) => {
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); if (answer instanceof Error) throw answer; return { json: async () => answer }; };
  try { return await fn(urls); } finally { globalThis.fetch = real; }
};
const sym = (a) => { const r = stockAsk(a); return r ? r.sym : null; };

test('the asks: a company by name, a typed ticker, an index, in the ways people type them', () => {
  for (const [a, s] of [['apple stock price', 'AAPL'], ['TSLA stock', 'TSLA'], ['stock price of nvidia', 'NVDA'], ['aapl price', 'AAPL'], ['how is the s&p 500 today', 'SPX'],
    ['how is the dow doing', 'DJI'], ['dow jones today', 'DJI'], ['what is the price of apple stock', 'AAPL'], ["what's apple's stock price?", 'AAPL'], ['how is tesla stock doing today', 'TSLA'],
    ['nvidia shares', 'NVDA'], ['microsoft stock', 'MSFT'], ['uber stock price', 'UBER'], ['$tsla price', 'TSLA'], ['VOD.L stock', 'VOD.L'], ['BRK-B stock', 'BRK-B'], ['nasdaq today', 'IXIC'],
    ['ABCD stock price', 'ABCD'], ['SPY price', 'SPY'], ['google stock price', 'GOOGL']]) assert.equal(sym(a), s, a);
  assert.equal(stockAsk('how is the s&p 500 today').kind, 'index'); assert.equal(stockAsk('apple stock price').kind, 'stock');
});

test('not a stock: broth, fruit, coins, currency pairs, a lowercase word shaped like a ticker, a ticker that is an everyday word, a question about stocks', () => {
  for (const a of ['stock market', 'beef stock', 'chicken stock recipe', 'apple price', 'tesla price', 'bitcoin price', 'buy stock', 'what is a stock', 'eur usd', 'spot price', 'coin price',
    'uber price', 'cost price', 'penny stocks', 'the stock price', 'should i buy apple stock', 'abcd stock price', 'spy price', 'dow', 'nasdaq', 'weather today', '']) assert.equal(stockAsk(a), null, a);
  for (const e of stocks.examples) assert.ok(stocks.match(e.toLowerCase(), e), e);
  for (const n of stocks.nearMisses) assert.ok(!stocks.match(n.toLowerCase(), n), n);
});

test('the card opens Markets on the same symbol', () => {
  for (const a of ['apple stock price', 'how is the s&p 500 today', 'BRK-B stock', 'VOD.L stock']) {
    const r = stockAsk(a), page = pageOfStock(r);
    assert.equal(page, '/markets/?s=' + encodeURIComponent(r.sym), a);
    assert.deepEqual(pageOfCard('stocks', page), [page, 'Markets'], a);
  }
});

test('run: asks /api/markets for five days, shows the price, the move on the day, the line and the source', async () => {
  const answer = { ok: true, sym: 'AAPL', kind: 'stock', name: 'Apple', currency: 'USD', price: 227.52, change: -1.48, pct: -0.6463, asOf: Date.UTC(2026, 9, 29), source: 'Stooq', points: [[1, 230], [2, 229], [3, 231], [4, 229], [5, 227.52]] };
  await withFetch(answer, async (urls) => {
    const api = apiOf();
    assert.equal(await stocks.run('apple stock price', api), 'stocks');
    assert.deepEqual(urls, ['/api/markets?s=AAPL&r=5d']);
    const el = api.pages[0], h = el.innerHTML;
    assert.equal(el.dataset.page, '/markets/?s=AAPL');
    assert.ok(h.includes('<h2>Apple</h2>') && h.includes('AAPL · Stock or ETF · USD'), h);
    assert.ok(h.includes('227.52') && h.includes('▼ ') && h.includes('#ff8a8a') && h.includes('(−0.65%) on the day'), h);
    assert.ok(/<path d="M0\.0 /.test(h), 'the five-day line: ' + h);
    assert.ok(h.includes('Source: Stooq') && h.includes('data may be delayed') && h.includes('as of 29 Oct 2026') && h.includes('not advice'), h);
  });
  await withFetch({ ok: true, sym: 'SPX', kind: 'index', name: 'S&P 500', currency: 'pts', price: 5800.1, change: 12.3, pct: 0.21, points: [], source: 'Stooq' }, async (urls) => {
    const api = apiOf(); assert.equal(await stocks.run('how is the s&p 500 today', api), 'stocks');
    assert.deepEqual(urls, ['/api/markets?s=SPX&r=5d']);
    const h = api.pages[0].innerHTML; assert.ok(h.includes('<h2>S&amp;P 500</h2>') && h.includes('SPX · Index</div>'), 'an index has no currency: ' + h);
    assert.ok(h.includes('▲ ') && h.includes('#7fd6a0') && !h.includes('<svg'), h);
  });
});

test('run: no price says so and still opens Markets; a dead service; a page left; an ask it does not read', async () => {
  await withFetch({ ok: false, kind: 'none', sym: 'ABCD', say: 'No price for ABCD from the free sources just now.' }, async () => {
    const api = apiOf(); assert.equal(await stocks.run('ABCD stock price', api), 'none');
    assert.ok(api.pages[0].innerHTML.includes('No price for ABCD from the free sources just now.')); assert.equal(api.pages[0].dataset.page, '/markets/?s=ABCD');
  });
  await withFetch({ ok: true, partial: true, sym: 'AAPL', kind: 'stock', price: null, note: 'The live price sources did not answer; this is the close from Verse\'s year-end record.' }, async () => {
    const api = apiOf(); assert.equal(await stocks.run('apple stock price', api), 'none'); assert.ok(api.pages[0].innerHTML.includes('year-end record'));
  });
  await withFetch(new Error('offline'), async () => {
    const api = apiOf(); assert.equal(await stocks.run('apple stock price', api), 'none'); assert.ok(api.pages[0].innerHTML.includes('did not answer just now'));
  });
  await withFetch({ ok: true, price: 1 }, async () => { const api = apiOf(false); assert.equal(await stocks.run('apple stock price', api), 'stocks'); assert.ok(api.pages[0].innerHTML.includes('…'), 'a page left keeps its placeholder'); });
  await withFetch({}, async (urls) => { const api = apiOf(); assert.equal(await stocks.run('stock market', api), 'none'); assert.equal(urls.length, 0); assert.equal(api.pages.length, 0); });
  assert.ok(!cardHtml(stockAsk('apple stock price'), { ok: true, name: '<b>x</b>', price: 1, source: '<i>' }, esc).includes('<b>'), 'what the service says is escaped');
});
