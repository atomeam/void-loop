// The trading bots and the arbitrage scanner (void-live-deploy/trading-bots/kit/, lib/trading-bots.js, lib/arb-venues.js, lib/trading-paid.js).
// The candles here are made up for the test (secret-scan: ok; nothing on the site is): the pages only ever show the real data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOTS, sma, rsi, channel, backtest, candlesOf, decide, walkForward, gridOf, paramsOf } from '../void-live-deploy/trading-bots/kit/strategy.js';
import { buyWith, sellInto, cleanBook, scan, spread, dexBook } from '../void-live-deploy/trading-bots/kit/arb.js';
import { runOnce, readConfig } from '../void-live-deploy/trading-bots/kit/bot.mjs';
import { scanOnce } from '../void-live-deploy/trading-bots/kit/arb-scan.mjs';
import { settingsOf, linkOf, heldFrom, tradesCsv, zipOf, crc32, scanCsv } from '../void-live-deploy/lib/trading-bots.js';
import { quoteCall, quoteOut, readVenues } from '../void-live-deploy/lib/arb-venues.js';
import { btInput, arbInput, answer, backtestRoute } from '../void-live-deploy/lib/trading-paid.js';
import { PAID } from '../void-live-deploy/functions/api/x402/[service].js';
import { SERVICES } from '../void-live-deploy/lib/x402.js';
import { pages } from './trading-bots-pages.mjs';
import { DatabaseSync } from 'node:sqlite';
import { rowOf, record, summary } from '../void-live-deploy/lib/arb-history.js';
import { onRequestGet as arbitrageGet } from '../void-live-deploy/functions/api/arbitrage.js';

const day = (i) => new Date(Date.UTC(2018, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const rowsFrom = (closes) => closes.map((c, i) => [day(i), i ? closes[i - 1] : c, Math.max(c, i ? closes[i - 1] : c) * 1.001, Math.min(c, i ? closes[i - 1] : c) * 0.999, c, 1]);

test('indicators: sma, rsi, and a channel that never looks at its own day', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  assert.equal(rsi([1, 2, 3, 4, 5], 2)[4], 100);
  assert.deepEqual(channel([5, 1, 9, 2], 2, Math.max), [null, null, 5, 9]);
});

test('a backtest trades at the next open and charges fee and slippage both ways', () => {
  // flat at 100 for 250 days, then a steady rise: the trend bot buys once after its averages cross, at the next open
  const closes = [...Array(250).fill(100), ...Array.from({ length: 150 }, (_, i) => 100 + i)];
  const c = candlesOf(rowsFrom(closes)), r = backtest(c, 'trend-50-200', {}, { fee: 0.01, slippage: 0.001 });
  assert.equal(r.trades.length, 0); assert.ok(r.open, 'holding at the end');
  const k = c.findIndex((x) => x.d === r.open.in), tg = BOTS['trend-50-200'].targets(c, paramsOf('trend-50-200'));
  assert.equal(tg[k - 1], 1); assert.equal(tg[k - 2], 0, 'bought the day after the first signal, not on it');
  assert.ok(Math.abs(r.open.inPrice - c[k].o * 1.001) < 1e-9, 'at the next open plus slippage');
  const end = r.equity.at(-1)[1], want = (0.99 / (c[k].o * 1.001)) * c.at(-1).c;
  assert.ok(Math.abs(end - want) < 1e-9, 'the fee came off the buy');
  assert.ok(r.hold.totalReturn > r.stats.totalReturn, 'buy and hold over the same days beat a late entry here');
});

test('every bot runs, decide() never uses an unclosed day, and walk-forward picks on the past only', () => {
  let p = 100, s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); const closes = [];
  for (let i = 0; i < 2400; i++) { p *= Math.exp((rnd() - 0.495) * 0.06); closes.push(p); }
  const c = candlesOf(rowsFrom(closes));
  for (const id of Object.keys(BOTS)) {
    const r = backtest(c, id, {}); assert.ok(r && r.stats.maxDrawdown >= 0 && r.stats.maxDrawdown < 1, id);
    const last = c.at(-1), d = decide(c, id, {}, last.t + 864e5 - 1);
    assert.equal(d.day, c.at(-2).d, id + ': the day still open is not used');
    const wf = walkForward(c, id);
    assert.ok(wf.windows.length >= 2, id + ' has test years');
    for (const w of wf.windows) assert.ok(w.trainTo < w.testFrom, 'picked before the test year');
    assert.ok(gridOf(id).length > 3);
  }
  assert.equal(paramsOf('trend-50-200', { fast: 'x', slow: 9999 }).slow, 200, 'out of range falls back to the default');
});

test('the bot: paper mode keeps a pretend balance; live mode sells only what it bought', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verse-bot-'));
  const cfgFile = path.join(dir, 'config.json'); fs.writeFileSync(cfgFile, JSON.stringify({ bot: 'breakout-20-10', exchange: 'kraken', symbol: 'BTC/USD', budget: 100 }));
  const cfg = { ...readConfig(cfgFile), stateFile: path.join(dir, 'state.json'), paperFile: path.join(dir, 'paper.json') };
  assert.throws(() => { fs.writeFileSync(cfgFile, JSON.stringify({ bot: 'breakout-20-10', exchange: 'kraken', symbol: 'BTC/USD', budget: 100, secret: 'x' })); readConfig(cfgFile); }, /environment/);
  const up = Array.from({ length: 60 }, (_, i) => 100 + (i > 40 ? (i - 40) * 3 : 0)), now = Date.UTC(2018, 0, 1) + 61 * 864e5;
  const ohlcv = rowsFrom(up).map((r) => [Date.parse(r[0] + 'T00:00:00Z'), r[1], r[2], r[3], r[4], r[5]]);
  const orders = []; let btc = 0.5; // the owner already held 0.5 BTC before the bot
  const ex = { fetchOHLCV: async () => ohlcv, loadMarkets: async () => {}, amountToPrecision: (_, a) => a.toFixed(6), fetchTicker: async () => ({ ask: up.at(-1) }),
    fetchBalance: async () => ({ free: { USD: 1000, BTC: btc }, total: { USD: 1000, BTC: btc } }),
    createOrder: async (sym, type, side, amt) => { orders.push([side, amt]); btc += side === 'buy' ? amt : -amt; return { id: 'o' + orders.length }; } };
  const paper = await runOnce(ex, cfg, { now }); assert.equal(paper.action, 'buy (paper)'); assert.equal(orders.length, 0, 'paper places nothing');
  const live = await runOnce(ex, cfg, { live: true, now }); assert.equal(live.action, 'buy'); assert.ok(orders[0][1] * up.at(-1) <= 100, 'never more than the budget');
  const st = JSON.parse(fs.readFileSync(cfg.stateFile, 'utf8')); assert.ok(Math.abs(st.baseAmount - orders[0][1]) < 1e-9, 'it counts only what its order added');
  const down = [...up, ...Array.from({ length: 15 }, (_, i) => 150 - i * 6)], now2 = Date.UTC(2018, 0, 1) + 76 * 864e5;
  ohlcv.length = 0; ohlcv.push(...rowsFrom(down).map((r) => [Date.parse(r[0] + 'T00:00:00Z'), r[1], r[2], r[3], r[4], r[5]]));
  const sold = await runOnce(ex, cfg, { live: true, now: now2 }); assert.equal(sold.action, 'sell');
  assert.ok(Math.abs(btc - 0.5) < 1e-6, 'the owner\'s own 0.5 BTC is untouched');
});

test('arbitrage math walks the book and nets every cost', () => {
  assert.deepEqual(buyWith([[100, 1], [110, 1]], 155), { base: 1.5, spent: 155, filled: true, avg: 155 / 1.5 });
  assert.equal(sellInto([[120, 1], [100, 5]], 2).quote, 220);
  assert.equal(buyWith([[100, 1]], 500).filled, false, 'a thin book says so');
  const v = { a: { ...cleanBook({ asks: [['100', '10']], bids: [['99', '10']] }), fee: 0.001 }, b: { ...cleanBook({ asks: [['103', '10']], bids: [['102', '10']] }), fee: 0.001 } };
  const rows = scan(v, { size: 1000 }), best = rows[0];
  assert.equal(best.buy, 'a'); assert.equal(best.sell, 'b');
  assert.ok(Math.abs(best.net - (10 * 0.999 * 102 * 0.999 - 1000)) < 1e-9);
  assert.ok(scan(v, { size: 1000, transferUsd: 30 })[0].net < 0, 'a transfer cost can wipe it out');
  assert.equal(spread(v).high, 'b');
  const d = dexBook({ size: 1000, buyOut: 0.5, base: 0.5, sellOut: 990 }); assert.equal(d.asks[0][0], 2000); assert.equal(d.bids[0][0], 1980);
});

test('the Uniswap quoter call is encoded and read back', () => {
  const c = quoteCall('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', '0x4200000000000000000000000000000000000006', 1000000000n, 500);
  assert.equal(c.slice(0, 10), '0xc6a5026a'); assert.equal(c.length, 10 + 5 * 64);
  assert.ok(c.endsWith('0'.repeat(64))); assert.ok(c.includes('3b9aca00'));
  const out = quoteOut('0x' + (5n * 10n ** 17n).toString(16).padStart(64, '0') + '0'.repeat(128) + (90000).toString(16).padStart(64, '0'));
  assert.equal(out.out, 5n * 10n ** 17n); assert.equal(out.gas, 90000);
});

test('readVenues reads each book, names the ones that fail, and scanOnce works on any ccxt-like exchange', async () => {
  const f = async (url) => {
    if (url.includes('coinbase')) return Response.json({ bids: [['100', '5', 1]], asks: [['101', '5', 1]] });
    if (url.includes('kraken')) return Response.json({ error: [], result: { XXBTZUSD: { bids: [['102', '5', 1]], asks: [['103', '5', 1]] } } });
    if (url.includes('gemini')) return Response.json({ bids: [{ price: '100', amount: '5' }], asks: [{ price: '100.5', amount: '5' }] });
    return new Response('no', { status: 500 });
  };
  const r = await readVenues('BTC', { f });
  assert.deepEqual(Object.keys(r.venues).sort(), ['coinbase', 'gemini', 'kraken']); assert.equal(r.missing[0].venue, 'bitstamp');
  const book = (bid, ask) => ({ fetchOrderBook: async () => ({ bids: [[bid, 5]], asks: [[ask, 5]] }) });
  const s = await scanOnce({ x: book(100, 101), y: book(103, 104), z: { fetchOrderBook: async () => { throw new Error('down'); } } }, { symbol: 'BTC/USD', size: 1000, transferUsd: 0, fees: { x: 0.001, y: 0.001 } });
  assert.equal(s.rows[0].buy, 'x'); assert.match(s.missing[0], /^z/);
});

test('paid calls: inputs checked before payment, and work that fails is never charged', async () => {
  assert.equal(btInput({ bot: 'nope' }).ok, false); assert.equal(btInput({ bot: 'dip-rsi2', fee: 0.5 }).ok, false); assert.equal(btInput({ bot: 'dip-rsi2', from: '2020' }).ok, false);
  assert.equal(arbInput({ coin: 'DOGE' }).ok, false); assert.equal(arbInput({ coin: 'btc', size: 5 }).ok, false); assert.equal(arbInput({ coin: 'btc', venues: ['ftx'] }).ok, false);
  for (const k of ['backtest', 'arbitrage']) assert.equal(SERVICES[k].units, 50000, k + ' is 0.05 USDC');
  // sold through the wallet thread's one paid-call route: a bad body is refused before payment, and a failed run is not paid work
  assert.notEqual(PAID.backtest.check({}), true); assert.equal(PAID.backtest.check({ bot: 'dip-rsi2' }), true); assert.notEqual(PAID.arbitrage.check({ coin: 'DOGE' }), true);
  const noData = await backtestRoute.onRequestPost({ request: new Request('https://a-to-mind.com/api/x402/backtest', { method: 'POST', body: '{"bot":"dip-rsi2"}' }), env: { ASSETS: { fetch: async () => new Response('', { status: 404 }) } } });
  assert.equal(noData.status, 503); assert.equal(PAID.backtest.paidOk(noData.status, await noData.json()), false, 'nothing settled when the data is missing');
  assert.equal(PAID.arbitrage.paidOk(200, { rows: [] }), false, 'an empty scan is not paid work');
  const closes = Array.from({ length: 900 }, (_, i) => 100 + Math.sin(i / 20) * 10 + i / 10);
  const a = answer(btInput({ bot: 'trend-50-200' }).input, { rows: rowsFrom(closes), source: 'test', first: day(0), asOf: day(899) });
  assert.ok(a.equity.length > 500 && a.walkForward && /Past results/.test(a.note));
});

test('page helpers: settings from a link, the held-out window, CSV and a zip that unzips', () => {
  const s = settingsOf('?pair=ETH-USD&fee=0.25&slip=9&w=held');
  assert.deepEqual(s, { pair: 'ETH-USD', fee: 0.25, slip: 0.1, w: 'held' }); assert.equal(settingsOf(linkOf(s)).pair, 'ETH-USD');
  assert.equal(heldFrom('2026-11-05'), '2024-11-05');
  const r = backtest(candlesOf(rowsFrom(Array.from({ length: 500 }, (_, i) => 100 + Math.sin(i / 15) * 20))), 'breakout-20-10', {});
  assert.match(tradesCsv(r), /^bought,buy_price,sold,sell_price,return_pct\n/);
  assert.match(scanCsv({ rows: scan({ a: { asks: [[1, 9e9]], bids: [[1, 9e9]], fee: 0 }, b: { asks: [[1, 9e9]], bids: [[1, 9e9]], fee: 0 } }) }), /^buy,sell/);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const z = zipOf([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b); assert.equal(new DataView(z.buffer).getUint32(z.length - 22, true), 0x06054b50);
});

test('the written pages are current, carry the risk notice and declare their hand-off', () => {
  for (const [rel, html] of pages()) {
    const f = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'trading-bots', rel);
    assert.equal(fs.readFileSync(f, 'utf8'), html, rel + ' is stale: node tools/trading-bots-pages.mjs');
    assert.match(html, /<meta name="verse-handoff" content="in: [^"]+; out: [^"]+">/); assert.match(html, /never/i);
    assert.doesNotMatch(html, /best (ever|bot)|guarantee|profit(able)? every/i, rel + ' makes no claim the backtest does not show');
  }
});

// an in-memory stand-in for Cloudflare D1 (the same shape tools/x402-services.test.mjs uses)
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a); return r == null ? null : col ? r[col] : r; } });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
}
const scanBody = (at, rows, coin = 'BTC') => ({ coin, at, spread: { mids: { coinbase: 1, kraken: 1, gemini: 1 } }, rows });
const row = (buy, sell, net, filled = true) => ({ buy, sell, net, netPct: net / 1000, filled });

test('the scan record keeps one real row per fresh scan and sums it up honestly', async () => {
  assert.equal(rowOf({ coin: 'BTC', at: '2026-11-06T00:00:00Z', rows: [] }), null, 'an empty scan is not a row');
  const r = rowOf(scanBody('2026-11-06T00:00:00Z', [row('kraken', 'coinbase', 4.2, false), row('gemini', 'kraken', -3.1)]));
  assert.equal(r.best_buy, 'gemini', 'the best pair is the best one whose books could fill the trade'); assert.equal(r.cleared, 0); assert.equal(r.venues, 3);
  const db = d1(), t0 = Date.parse('2026-11-06T00:00:00Z');
  assert.equal(await record(db, scanBody(new Date(t0).toISOString(), [row('kraken', 'coinbase', -2), row('gemini', 'kraken', -5)]), t0), true);
  assert.equal(await record(db, scanBody(new Date(t0 + 5000).toISOString(), [row('kraken', 'coinbase', 9)]), t0), false, 'under 15 s after the last row: not written');
  assert.equal(await record(db, scanBody(new Date(t0 + 60000).toISOString(), [row('kraken', 'coinbase', 1.5), row('gemini', 'kraken', -1)]), t0), true);
  assert.equal(await record(db, scanBody(new Date(t0 + 1000).toISOString(), [row('kraken', 'coinbase', 1)], 'ETH'), t0), true, 'each coin has its own record');
  const s = await summary(db, 'BTC');
  assert.equal(s.scans, 2); assert.equal(s.cleared, 1); assert.equal(s.avgBestNet, -0.25); assert.deepEqual([s.best.buy, s.best.sell, s.best.net], ['kraken', 'coinbase', 1.5]);
  assert.equal(s.first, new Date(t0).toISOString()); assert.deepEqual(s.pairs.map((p) => [p.buy, p.sell, p.times, p.cleared]), [['kraken', 'coinbase', 2, 1]]);
  const empty = await summary(d1(), 'ETH'); assert.equal(empty.scans, 0); assert.equal(empty.best, null); assert.equal(empty.avgBestNet, null);
  // rows older than 180 days go when a new row is written
  await record(db, scanBody(new Date(t0 + 200 * 864e5).toISOString(), [row('kraken', 'coinbase', -1)]), t0 + 200 * 864e5);
  assert.equal((await summary(db, 'BTC')).scans, 1);
});

test('GET /api/arbitrage?history=1 answers the record, and 503 without a database', async () => {
  const db = d1(); await record(db, scanBody('2026-11-06T00:00:00Z', [row('kraken', 'coinbase', -2)]));
  const ok = await arbitrageGet({ request: new Request('https://a-to-mind.com/api/arbitrage?coin=btc&history=1'), env: { DB: db } });
  assert.equal(ok.status, 200); const j = await ok.json(); assert.equal(j.coin, 'BTC'); assert.equal(j.scans, 1); assert.match(j.note, /Nothing was traded/);
  assert.equal((await arbitrageGet({ request: new Request('https://a-to-mind.com/api/arbitrage?history=1'), env: {} })).status, 503);
});
