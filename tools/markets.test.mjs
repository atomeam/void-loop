// The /markets/ page's pure half (lib/markets.js) and its API (functions/api/markets.js) against FIXTURES standing in for Stooq, Yahoo, CoinGecko and frankfurter
// (the sources cannot be reached from the build machine, so nothing here is a live read): what a typed symbol means, the numbers worked out by hand from fixed rows,
// the fallback from one source to the next, and the bounds an open GET must keep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { capsRows, scanRows, screen, resolve, parseStooqDaily, parseYahoo, summarize, closeOn, thin, fmtPrice, fmtBig, fmtMove, fmtDay, chartPath, comparePaths, cleanList, rowsFromFx, rowsFromPrices, RANGES } from '../void-live-deploy/lib/markets.js';
import { onRequestGet, lookQuote, wantFrom, cleanIds, STRIP } from '../void-live-deploy/functions/api/markets.js';
import { routeAsk, TOOLS, RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
import { NOW, DAYMS, csvFixture, resp, calls, fake } from './markets.fixtures.mjs';
test('what a typed symbol means: tickers, names, indices, coins, currency pairs, and nothing a stranger could use to pick a host', () => {
  assert.deepEqual([resolve('aapl').sym, resolve('AAPL').kind, resolve('aapl').stooq, resolve('aapl').yahoo], ['AAPL', 'stock', 'aapl.us', 'AAPL']);
  assert.equal(resolve('apple').sym, 'AAPL');
  assert.equal(resolve('tesla').sym, 'TSLA'); assert.equal(resolve('brk-b').sym, 'BRK-B'); assert.equal(resolve('brk-b').stooq, 'brk-b.us');
  assert.deepEqual([resolve('s&p 500').sym, resolve('s&p 500').stooq, resolve('^GSPC').sym, resolve('dow').sym, resolve('nasdaq').sym], ['SPX', '^spx', 'SPX', 'DJI', 'IXIC']);
  assert.deepEqual([resolve('btc').coin, resolve('BTC-USD').sym, resolve('bitcoin').sym, resolve('ethusd').sym, resolve('sol').coin], ['bitcoin', 'BTC', 'BTC', 'ETH', 'solana']);
  assert.deepEqual([resolve('eurusd').kind, resolve('EUR/USD').sym, resolve('gbp jpy').from, resolve('USDJPY=X').to], ['fx', 'EUR/USD', 'GBP', 'JPY']);
  assert.equal(resolve('usdusd'), null, 'a pair needs two currencies'); assert.equal(resolve('eurxyz'), null, 'both from the ECB list');
  assert.equal(resolve('vod.l').stooq, 'vod.uk'); assert.equal(resolve('vod.l').yahoo, 'VOD.L'); assert.equal(resolve('sap.de').stooq, 'sap.de'); assert.equal(resolve('xx.zz'), null, 'an unlisted exchange');
  for (const bad of ['', '   ', 'http://evil.example/x', 'aapl&host=evil', '../../etc', 'a b c d e', 'toolongtickersymbol', 'aapl;drop', 'AAPL\nHost: x', '<script>', '12345']) assert.equal(resolve(bad), null, JSON.stringify(bad));
  assert.equal(resolve(null), null);
});
test('Stooq rows are read, an error page or a key wall is not', () => {
  const rows = parseStooqDaily('Date,Open,High,Low,Close,Volume\n2024-12-30,252.2,253.5,250.75,252.2,35557500\n2024-12-31,252.44,253.28,249.43,250.42,39480700\n');
  assert.equal(rows.length, 2); assert.equal(rows[1].c, 250.42); assert.equal(rows[1].v, 39480700);
  for (const wall of ['No data', '', 'Get your apikey:\n1. Open this page', '<html>blocked</html>', 'Date,Open,High,Low,Close,Volume\n']) assert.deepEqual(parseStooqDaily(wall), [], wall);
});
test('the card worked out by hand from fixed rows: the move from the previous close, the day range, 52 weeks and volume', () => {
  const rows = parseStooqDaily(csvFixture()), s = summarize(rows, '1y');
  assert.equal(s.price, 188.5); assert.equal(s.prev, 180); assert.ok(Math.abs(s.change - 8.5) < 1e-9); assert.ok(Math.abs(s.pct - 4.7222) < 0.001);
  assert.equal(s.dayHigh, 189.5); assert.equal(s.dayLow, 187.5); assert.equal(s.hi52, 230); assert.equal(s.lo52, 90, '52 weeks reach back to Feb and Mar 2026');
  assert.ok(s.points.length <= 240 && s.points.length > 100); assert.equal(s.points[s.points.length - 1][1], 188.5);
  const w = summarize(rows, '5d'); assert.ok(w.points.length >= 4 && w.points.length <= 6, '5 sessions');
  assert.equal(summarize(rows, '1m').points.length > 15, true); assert.equal(summarize(rows, 'ytd').points[0][0] >= Date.UTC(2026, 0, 1), true);
  assert.ok(summarize(rows, 'max').points.length <= 240);
  assert.equal(summarize(rows.slice(-100), '1y').hi52, null, 'less than a year of rows: no 52 weeks claimed'); assert.equal(summarize([], '1y'), null);
});
test('the close on a fixed day: the last row on or before it (a weekend gives Friday)', () => {
  const rows = parseStooqDaily(csvFixture());
  assert.deepEqual(closeOn(rows, '2024-12-31'), { date: '2024-12-31', close: 250.42 });
  assert.equal(closeOn(rows, '2024-12-29').date, '2024-12-27', 'Sunday reads Friday'); assert.equal(closeOn(rows, '1990-01-01'), null); assert.equal(closeOn(rows, 'nonsense'), null);
});
test('numbers for the screen', () => {
  assert.equal(fmtPrice(250.42), '250.42'); assert.equal(fmtPrice(1234.5), '1,234.50'); assert.equal(fmtPrice(0.000123), '0.000123'); assert.equal(fmtPrice(null), '–');
  assert.equal(fmtBig(1.4e12), '1.4T'); assert.equal(fmtBig(39480700), '39.48M'); assert.equal(fmtBig(512), '512'); assert.equal(fmtMove(8.5, 4.7222), '+8.50 (+4.72%)'); assert.equal(fmtMove(-1, -0.5), '−1.00 (−0.50%)');
  assert.equal(fmtDay(Date.UTC(2024, 11, 31)), '31 Dec 2024'); assert.equal(thin([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], 3).map((p) => p[0]).join(), '1,3,5');
  const c = chartPath([[0, 1], [10, 3], [20, 2]], 100, 50, 0); assert.equal(c.xy.length, 3); assert.equal(c.xy[0][0], 0); assert.equal(c.xy[2][0], 100); assert.equal(c.xy[1][1], 0, 'the highest point is at the top');
  const cmp = comparePaths([[0, 100], [1, 110]], [[0, 50], [1, 45]]); assert.ok(Math.abs(cmp.endA - 10) < 1e-9 && Math.abs(cmp.endB + 10) < 1e-9); assert.equal(comparePaths([[0, 1]], [[0, 1], [1, 2]]), null);
  assert.deepEqual(cleanList('aapl, BTC,aapl,nonsense word here,eurusd'), ['AAPL', 'BTC', 'EUR/USD']); assert.equal(cleanList(Array(40).fill('aapl').map((s, i) => 'aa' + 'abcdefghijklmnopqrstuvwxyz'[i % 26])).length <= 20, true);
  assert.deepEqual(rowsFromFx({ rates: { '2024-12-31': { EUR: 0.96 }, '2024-12-30': { EUR: 0.97 } } }, 'EUR').map((r) => r.c), [0.97, 0.96]); assert.equal(rowsFromPrices({ prices: [[1, 2], ['x', 3]] }).length, 1);
});
test('Yahoo chart JSON is read into rows and the meta the card needs', () => {
  const y = parseYahoo({ chart: { result: [{ meta: { currency: 'USD', longName: 'Apple Inc.', regularMarketPrice: 250.42, chartPreviousClose: 252.2, fiftyTwoWeekHigh: 260.1, fiftyTwoWeekLow: 164.08, regularMarketDayHigh: 253.28, regularMarketDayLow: 249.43, regularMarketVolume: 39480700 }, timestamp: [1735561800, 1735648200], indicators: { quote: [{ open: [252.2, 252.44], high: [253.5, 253.28], low: [250.75, 249.43], close: [252.2, null], volume: [1, 2] }] } }] } });
  assert.equal(y.rows.length, 1, 'a null close is skipped'); assert.equal(y.meta.name, 'Apple Inc.'); assert.equal(y.meta.hi52, 260.1);
  const s = summarize(y.rows.concat([{ t: y.rows[0].t + DAYMS, o: 1, h: 1, l: 1, c: 250.42, v: 5 }]), '1m', y.meta); assert.equal(s.hi52, 260.1); assert.equal(s.dayLow, 249.43); assert.equal(parseYahoo({ chart: { result: null } }), null);
});

test('a share quote: Stooq answers, the page gets every number, labelled with its source and a delayed flag', async () => {
  const q = await lookQuote(resolve('aapl'), '1y', null, fake(), NOW);
  assert.equal(q.ok, true); assert.equal(q.sym, 'AAPL'); assert.equal(q.source, 'Stooq'); assert.equal(q.delayed, true); assert.equal(q.currency, 'USD'); assert.equal(q.price, 188.5); assert.equal(q.hi52, 230); assert.equal(q.name, 'Apple');
  assert.equal(q.rows, undefined, 'the rows stay on the server'); assert.ok(q.points.length > 100);
});
test('the close on a fixed day rides along: ?on=2024-12-31 gives 250.42', async () => {
  const q = await lookQuote(resolve('aapl'), '5y', '2024-12-31', fake(), NOW);
  assert.deepEqual(q.closeOn, { date: '2024-12-31', close: 250.42 }); assert.equal(q.on, '2024-12-31');
});
test('Stooq down or behind a key wall: Yahoo answers (and says so); one day is Yahoo\'s alone', async () => {
  const yahoo = (n, base = 100) => ({ chart: { result: [{ meta: { currency: 'USD', longName: 'Apple Inc.', regularMarketPrice: base + n - 1, chartPreviousClose: base + n - 2, fiftyTwoWeekHigh: 300, fiftyTwoWeekLow: 150 }, timestamp: Array.from({ length: n }, (_, i) => Math.floor((NOW - (n - i) * DAYMS / 8) / 1000)), indicators: { quote: [{ close: Array.from({ length: n }, (_, i) => base + i) }] } }] } });
  const wall = await lookQuote(resolve('aapl'), '1m', null, fake({ stooq: 'Get your apikey:\nhttps://stooq.com/q/d/?s=aapl.us&get_apikey', yahoo: yahoo(60) }), NOW);
  assert.equal(wall.ok, true); assert.match(wall.source, /Yahoo/); assert.equal(wall.name, 'Apple Inc.'); assert.equal(wall.hi52, 300);
  const day = await lookQuote(resolve('aapl'), '1d', null, fake({ yahoo: yahoo(78) }), NOW); assert.match(day.source, /Yahoo/); assert.ok(day.points.length > 50);
  const none = await lookQuote(resolve('aapl'), '1y', null, fake({ down: ['stooq.com', 'query1.finance.yahoo.com'] }), NOW);
  assert.equal(none.ok, false); assert.equal(none.kind, 'none'); assert.match(none.say, /AAPL/);
  const intraday = await lookQuote(resolve('aapl'), '1d', null, fake({ down: ['query1.finance.yahoo.com'] }), NOW); assert.equal(intraday.ok, true); assert.match(intraday.note, /five days/);
});
test('the day move is the last two daily rows, never Yahoo\'s chartPreviousClose (a year ago on a one-year chart)', async () => {
  const n = 250, rowsT = Array.from({ length: n }, (_, i) => Math.floor((NOW - (n - i) * DAYMS) / 1000)), closes = Array.from({ length: n }, (_, i) => 6700 + i * 3.5); closes[n - 1] = 7600; closes[n - 2] = 7590; // 0.13% today
  const y = { chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 7600, chartPreviousClose: 6700, fiftyTwoWeekHigh: 7700, fiftyTwoWeekLow: 6600 }, timestamp: rowsT, indicators: { quote: [{ close: closes }] } }] } };
  const q = await lookQuote(resolve('spx'), '1y', null, fake({ stooq: 'No data', yahoo: y }), NOW);
  assert.match(q.source, /Yahoo/); assert.ok(Math.abs(q.pct - 0.1318) < 0.01, 'a day move of about 0.13%, not the 13% since a year ago: ' + q.pct); assert.equal(q.prev, 7590);
});
test('a coin: price, 24 hour range, volume and market cap from CoinGecko, a year of daily history, and the 1D chart from the fine series', async () => {
  const q = await lookQuote(resolve('btc'), '1d', null, fake(), NOW);
  assert.equal(q.source, 'CoinGecko'); assert.equal(q.price, 70000); assert.equal(q.prev, 68600); assert.equal(q.dayHigh, 71000); assert.equal(q.cap, 1.4e12); assert.equal(q.volume, 3e10); assert.equal(q.points.length, 48); assert.ok(q.hi52 > q.lo52);
  const long = await lookQuote(resolve('btc'), '5y', null, fake(), NOW); assert.match(long.note, /one year/);
});
test('a coin when CoinGecko does not answer: Yahoo\'s chart gives the price, named as the coin and said to be from Yahoo; both down is honestly nothing', async () => {
  const y = { chart: { result: [{ meta: { currency: 'USD', longName: 'Bitcoin USD', regularMarketPrice: 70100, chartPreviousClose: 69000 }, timestamp: Array.from({ length: 300 }, (_, i) => Math.floor((NOW - (300 - i) * DAYMS) / 1000)), indicators: { quote: [{ close: Array.from({ length: 300 }, (_, i) => 40000 + i * 100) }] } }] } };
  const q = await lookQuote(resolve('btc'), '1y', null, fake({ down: ['api.coingecko.com'], yahoo: y }), NOW);
  assert.equal(q.ok, true); assert.match(q.source, /Yahoo/); assert.equal(q.name, 'Bitcoin'); assert.equal(q.kind, 'crypto'); assert.ok(q.price > 0);
  const none = await lookQuote(resolve('btc'), '1y', null, fake({ down: ['api.coingecko.com', 'query1.finance.yahoo.com'] }), NOW); assert.equal(none.ok, false);
});
test('a currency pair: ECB rates, daily, one day shown as five; the rate on a fixed day', async () => {
  const q = await lookQuote(resolve('eurusd'), '1d', '2024-12-31', fake(), NOW);
  assert.equal(q.source.includes('ECB'), true); assert.equal(q.range, '5d'); assert.match(q.note, /once a day/); assert.equal(q.volume, null); assert.equal(q.kind, 'fx'); assert.equal(q.closeOn.close, 0.9652);
});
test('the endpoint: bounds, closed lists, a rate limit, and the old crypto list unchanged', async () => {
  const ask = (qs, extra = {}) => onRequestGet({ request: new Request('https://a-to-mind.com/api/markets' + qs), env: {}, fetchFn: fake(), ...extra });
  assert.equal((await ask('?s=aapl&r=1y')).status, 200); const j = await (await ask('?s=aapl&r=5d')).json(); assert.equal(j.range, '5d');
  for (const qs of ['?s=http://evil.example', '?s=aapl&r=10y', '?s=aapl&r=1y&on=2030-01-01', '?s=aapl&r=1y&on=2024-02-30', '?s=aapl&r=1y&on=garbage', '?s=' + 'a'.repeat(300), '?s=']) assert.equal((await ask(qs)).status, 400, qs);
  const before = calls.length; await ask('?s=aapl%0d%0aHost:%20x&r=1y'); assert.equal(calls.length, before, 'a refused symbol costs no upstream call');
  const hosts = new Set(calls.map((u) => new URL(u).host)); for (const h of hosts) assert.ok(['stooq.com', 'query1.finance.yahoo.com', 'api.coingecko.com', 'api.frankfurter.dev'].includes(h), h);
  const strip = await (await ask('?strip=1')).json(); assert.equal(strip.ok, true); assert.ok(strip.quotes.length >= 4); assert.deepEqual(strip.quotes.map((x) => x.sym).slice(0, 3), STRIP.slice(0, 3));
  const mv = await (await ask('?movers=1')).json(); assert.equal(mv.ok, true); assert.equal(mv.up.length, 3); assert.equal(mv.down.length, 3);
  assert.equal((await ask('?s=aapl&r=1y', { fetchFn: fake({ down: ['stooq.com', 'query1.finance.yahoo.com'] }) })).status, 404, 'no price is not cached as an answer');
  assert.equal(cleanIds('bitcoin,Ethereum,bad id!'), 'bitcoin,ethereum', 'the crypto card keeps its list');
  assert.equal(wantFrom('max', NOW), 0); assert.ok(NOW - wantFrom('1m', NOW) >= 400 * DAYMS, 'at least a year of rows for the 52 weeks'); assert.ok(RANGES.includes('ytd'));
});
test('every source down: a day in the bundled record still has its close, said to be from the record; any other day is honestly nothing', async () => {
  const down = fake({ down: ['stooq.com', 'query1.finance.yahoo.com', 'api.coingecko.com', 'api.frankfurter.dev'] });
  const q = await lookQuote(resolve('spx'), '5y', '2024-12-31', down, NOW);
  assert.equal(q.ok, true); assert.equal(q.partial, true); assert.deepEqual(q.closeOn, { date: '2024-12-31', close: 5881.63 }); assert.equal(q.source, 'Verse year-end record (AP market reports)'); assert.equal(q.currency, 'pts'); assert.equal(q.price, null); assert.match(q.note, /did not answer/);
  assert.equal((await lookQuote(resolve('spx'), '5y', '2024-12-30', down, NOW)).ok, false, 'a day that is not in the record'); assert.equal((await lookQuote(resolve('spx'), '5y', null, down, NOW)).ok, false, 'no day asked, no record used'); assert.equal((await lookQuote(resolve('aapl'), '5y', '2024-12-31', down, NOW)).ok, false, 'a share close that could not be confirmed is not kept');
});
test('the strip and the watchlist cannot starve the quote: each counts against its own bucket, once per fresh lookup, and a repeat from the edge cache counts nothing', async () => {
  const kept = new Map(); const had = globalThis.caches;
  globalThis.caches = { default: { match: async (r) => { const v = kept.get(r.url); return v ? new Response(v.body, v.init) : undefined; }, put: async (r, res) => { kept.set(r.url, { body: await res.text(), init: { headers: [...res.headers] } }); } } };
  try {
    const ask = (qs) => onRequestGet({ request: new Request('https://a-to-mind.com/api/markets' + qs, { headers: { 'cf-connecting-ip': '1.2.3.4' } }), env: { SALT: 'x' }, fetchFn: fake() });
    const bucketsUsed = () => new Set([...kept.keys()].filter((k) => /\/__void-[a-z-]+\/rl\//.test(k)).map((k) => k.match(/\/__void-([a-z-]+)\/rl\//)[1]));
    await ask('?strip=1'); assert.deepEqual([...bucketsUsed()], ['markets-batch']); const n = Number(await (await globalThis.caches.default.match(new Request([...kept.keys()].find((k) => k.includes('markets-batch/rl/'))))).text());
    assert.equal(n, STRIP.length, 'one place per fresh symbol, in the batch bucket');
    assert.equal((await ask('?s=aapl&r=1y')).status, 200); assert.deepEqual([...bucketsUsed()].sort(), ['markets', 'markets-batch']);
    const before = kept.size; await ask('?strip=1'); await ask('?s=aapl&r=1y'); assert.equal(kept.size, before, 'repeats are answered from the cache and count nothing');
  } finally { globalThis.caches = had; }
});
test('the coin table and the screener: rows, filters and the endpoint', async () => {
  const ask = (qs) => onRequestGet({ request: new Request('https://a-to-mind.com/api/markets' + qs), env: {}, fetchFn: fake() });
  const caps = await (await ask('?caps=1')).json(); assert.equal(caps.ok, true); assert.equal(caps.coins.length, 50); assert.deepEqual([caps.coins[0].rank, caps.coins[0].name, caps.coins[0].sym], [1, 'Bitcoin', 'BTC']); assert.ok(caps.total > 1e12); assert.equal(caps.source, 'CoinGecko');
  assert.deepEqual(capsRows([{ id: 'x', symbol: 'x', name: 'X', current_price: 1 }, { nothing: 1 }, null]).map((r) => r.sym), ['X']);
  const scan = await (await ask('?scan=1')).json(); assert.equal(scan.ok, true); assert.equal(scan.universe.coins, 30); assert.ok(scan.rows.filter((r) => r.group === 'stocks').length === 12 && scan.rows.filter((r) => r.group === 'indices').length === 4);
  const a = scan.rows.find((r) => r.sym === 'AAPL'); assert.equal(a.pct.toFixed(2), '4.72'); assert.equal(a.below.toFixed(1), '18.0'); assert.ok(a.volX > 0.5 && a.volX < 2); assert.equal(a.basis, '52-week high');
  const rows = [{ sym: 'A', group: 'stocks', pct: 3, below: 2, volX: 2.5 }, { sym: 'B', group: 'stocks', pct: -4, below: 30, volX: 0.8 }, { sym: 'C', group: 'coins', pct: 1, below: 50, volX: null }, { sym: 'D', group: 'indices', pct: 0.2, below: 0.5, volX: 1 }];
  const syms = (f) => screen(rows, f).map((r) => r.sym).join('');
  assert.equal(syms({}), 'ABCD'); assert.equal(syms({ group: 'coins' }), 'C'); assert.equal(syms({ minPct: 1 }), 'AC'); assert.equal(syms({ maxPct: 0 }), 'B'); assert.equal(syms({ nearHigh: 5 }), 'AD'); assert.equal(syms({ minVolX: 2 }), 'A', 'a coin has no volume ratio, so it never passes a volume filter');
  assert.equal(syms({ sort: 'pct' }), 'ACDB'); assert.equal(syms({ sort: '-pct' }), 'BDCA'); assert.equal(syms({ sort: 'below' }), 'DABC'); assert.equal(syms({ group: 'junk', minPct: 'abc' }), 'ABCD', 'nonsense is ignored');
});
test('a burst of 20 loads from one address: one upstream try, none refused, and a bad moment is answered from the record or the last good answer', async () => {
  const kept = new Map(), had = globalThis.caches, up = [];
  globalThis.caches = { default: { match: async (r) => { const v = kept.get(r.url); return v ? new Response(v.body, v.init) : undefined; }, put: async (r, res) => { kept.set(r.url, { body: await res.text(), init: { headers: [...res.headers] } }); } } };
  const ip = { 'cf-connecting-ip': '9.9.9.9' }, hosts = ['stooq.com', 'query1.finance.yahoo.com', 'api.coingecko.com', 'api.frankfurter.dev'];
  const load = (qs, f) => onRequestGet({ request: new Request('https://a-to-mind.com/api/markets' + qs, { headers: ip }), env: { SALT: 'x' }, fetchFn: async (u, o) => { up.push(u); return f(u, o); } });
  try {
    const live = fake(), down = fake({ down: hosts });
    let bad = 0; for (let i = 0; i < 20; i++) { const r = await load('?s=SPX&r=5y&on=2024-12-31', live); const j = await r.json(); if (r.status !== 200 || !j.ok || j.closeOn.close !== 5881.63) bad++; }
    assert.equal(bad, 0, 'twenty loads, twenty answers with the close'); assert.ok(up.length <= 3, 'one live try, then the edge cache: ' + up.length); const n = up.length;
    // the limiter's own count never reached its limit: only the fresh lookup counted
    const bucket = [...kept.keys()].find((k) => k.includes('/__void-markets/rl/')); assert.equal(Number(kept.get(bucket).body), 1);
    // the sources down and the two minutes over: the last good answer (said to be old) is served, not an error
    for (const k of [...kept.keys()]) if (k.includes('/__markets/q/') && !k.includes('/stale/')) kept.delete(k);
    const old = await (await load('?s=SPX&r=5y&on=2024-12-31', down)).json(); assert.equal(old.ok, true); assert.equal(old.stale, true); assert.match(old.note, /last answer saved/); assert.equal(old.closeOn.close, 5881.63);
    // a symbol never seen, the sources down: the failure is remembered 45 seconds, so a burst does not try the sources again each time
    const before = up.length; for (let i = 0; i < 5; i++) assert.equal((await load('?s=ZZZ&r=1y', down)).status, 404); assert.ok(up.length - before <= 4, 'one try of the sources, not five: ' + (up.length - before));
    // asked to wait (the limiter full) and the day is in the record: the record answers; a plain quote is told to wait
    for (const k of [...kept.keys()]) if (k.includes('/__void-markets/rl/')) kept.set(k, { body: '9999', init: { headers: [] } });
    for (const k of [...kept.keys()]) if (k.includes('/__markets/q/DJI') || k.includes('/stale/q/DJI')) kept.delete(k);
    const rec = await (await load('?s=DJI&r=5y&on=2024-12-31', down)).json(); assert.equal(rec.ok, true); assert.equal(rec.partial, true); assert.equal(rec.closeOn.close, 42544.22);
    assert.equal((await load('?s=MSFT&r=1y', down)).status, 429);
  } finally { globalThis.caches = had; }
});
test('a slow Stooq does not hold the answer: Yahoo joins and the first answer wins', async () => {
  const slowStooq = async (u) => { if (new URL(u).host === 'stooq.com') await new Promise((r) => setTimeout(r, 2600)); return fake({ yahoo: { chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 200, fiftyTwoWeekHigh: 220, fiftyTwoWeekLow: 100 }, timestamp: Array.from({ length: 60 }, (_, i) => Math.floor((NOW - (60 - i) * DAYMS) / 1000)), indicators: { quote: [{ close: Array.from({ length: 60 }, (_, i) => 150 + i) }] } }] } } })(u); };
  const t0 = Date.now(); const q = await lookQuote(resolve('aapl'), '1m', null, slowStooq, NOW); assert.equal(q.ok, true); assert.match(q.source, /Yahoo/); assert.ok(Date.now() - t0 < 2400, 'answered in ' + (Date.now() - t0) + ' ms, not after the slow source');
});
test('the first paint carries the record: the page\'s inline copy of the year-end record agrees with lib/markets-record.js', async () => {
  const { RECORD } = await import('../void-live-deploy/lib/markets-record.js'); const html = fs.readFileSync(path.join(root, 'markets', 'index.html'), 'utf8');
  const m = html.match(/var R = (\{ SPX:[^;]*\});/); assert.ok(m, 'the inline copy is there'); const R = Function('return ' + m[1])();
  for (const sym of Object.keys(RECORD)) assert.deepEqual(R[sym][1], RECORD[sym], sym); assert.deepEqual(Object.keys(R).sort(), Object.keys(RECORD).sort());
});
test('registered everywhere a page must be: the ask bar, the service worker, the SEO list, the page itself', () => {
  assert.ok(TOOLS['/markets/']); assert.ok(RELATED['/markets/'] && RELATED['/markets/'].includes('/convert/'));
  for (const a of ['aapl stock price', 'stock price of apple', 'tesla stock', 'stock market']) { const r = routeAsk(a); assert.ok(r && /^\/markets\//.test(r.path || r), a + ' -> ' + JSON.stringify(r)); }
  assert.ok(PAGES.some((p) => p.path === '/markets/')); assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /'\/markets\/'/);
  const html = fs.readFileSync(path.join(root, 'markets', 'index.html'), 'utf8');
  assert.match(html, /\$\('qs'\)\.textContent = q\.sym \+ ' · ' \+ \(\{ stock: 'Stock or ETF', index: 'Index'/, 'the header says the symbol and its kind before anything else'); assert.match(html, /not financial advice/i); assert.match(html, /delayed/i); assert.equal((html.match(/not financial advice/gi) || []).length, 1, 'said once');
});
