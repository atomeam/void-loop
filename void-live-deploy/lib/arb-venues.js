// The venues Verse's arbitrage scan reads (trading-bots/kit/arb.js does the math): four exchanges' public order books and Uniswap v3 on Base.
// Read only: public market data, no key, no account, nothing traded. Each venue is asked once per scan, with a short timeout; one that does
// not answer is left out of that scan and named in `missing`.
//
// Taker fees are each venue's entry-tier spot taker fee as published when this was written (read 2026-11-06); a caller can send their own:
//   coinbase 0.60%  (Coinbase Advanced $0-10K tier, as reported by datawallet.com/crypto/coinbase-fees; Coinbase shows its own table only signed in)
//   kraken   0.80%  (kraken.com/pro/fees, Tier 1 spot taker)
//   bitstamp 0.40%  (tradingview.com/broker/Bitstamp, lowest tier taker)
//   gemini   1.20%  (gemini.com/activetrader-fee-schedule, lowest tier taker)
//   uniswap  the pool's own fee is inside its quote; gas is priced from the network's gas price and the quoter's gas estimate.
import { cleanBook, dexBook } from '../trading-bots/kit/arb.js';

export const COINS = { BTC: { coinbase: 'BTC-USD', kraken: 'XBTUSD', bitstamp: 'btcusd', gemini: 'btcusd' }, ETH: { coinbase: 'ETH-USD', kraken: 'ETHUSD', bitstamp: 'ethusd', gemini: 'ethusd', uniswap: true } };
export const FEES = { coinbase: 0.006, kraken: 0.008, bitstamp: 0.004, gemini: 0.012, uniswap: 0 };
export const VENUES = Object.keys(FEES);
const UA = 'Verse arbitrage scan (a-to-mind.com)';
const get = async (f, url) => { const r = await f(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }); if (!r.ok) throw new Error(url.split('/')[2] + ' ' + r.status); return r.json(); };

export const BOOK = {
  coinbase: async (f, s) => cleanBook(await get(f, 'https://api.exchange.coinbase.com/products/' + s + '/book?level=2')),
  kraken: async (f, s) => { const j = await get(f, 'https://api.kraken.com/0/public/Depth?pair=' + s + '&count=100'); if (j.error && j.error.length) throw new Error('kraken ' + j.error[0]); return cleanBook(Object.values(j.result || {})[0] || {}); },
  bitstamp: async (f, s) => cleanBook(await get(f, 'https://www.bitstamp.net/api/v2/order_book/' + s + '/')),
  gemini: async (f, s) => { const j = await get(f, 'https://api.gemini.com/v1/book/' + s + '?limit_bids=100&limit_asks=100'); const lv = (xs) => (xs || []).map((x) => [x.price, x.amount]); return cleanBook({ asks: lv(j.asks), bids: lv(j.bids) }); },
};

// Uniswap v3 on Base (developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments): QuoterV2 and WETH; USDC is Circle's on Base.
export const BASE_RPC = 'https://mainnet.base.org';
export const QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', WETH = '0x4200000000000000000000000000000000000006', USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const POOL_FEES = [500, 3000]; // the 0.05% and 0.30% WETH/USDC pools
const word = (hex) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
/** The calldata for QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, 0)): selector keccak256("quoteExactInputSingle((address,address,uint256,uint24,uint160))")[0..4] = c6a5026a. Pure. */
export const quoteCall = (tokenIn, tokenOut, amountIn, fee) => '0xc6a5026a' + word(tokenIn) + word(tokenOut) + word(BigInt(amountIn).toString(16)) + word(fee.toString(16)) + word('0');
/** amountOut and gasEstimate from the quoter's answer. Pure. */
export const quoteOut = (hex) => { const h = String(hex).replace(/^0x/, ''); if (h.length < 256) throw new Error('short quote'); return { out: BigInt('0x' + h.slice(0, 64)), gas: Number(BigInt('0x' + h.slice(192, 256))) }; };
const rpc = async (f, method, params) => { const r = await f(BASE_RPC, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }); const j = await r.json(); if (j.error) throw new Error('base rpc ' + (j.error.message || 'error')); return j.result; };
const call = (f, data) => rpc(f, 'eth_call', [{ to: QUOTER, data }, 'latest']);

/** Uniswap's best pool for buying ETH with `size` USDC and for selling `size / mid` ETH, with the swap's gas in dollars. USDC is counted as one dollar. */
export async function uniswap(f, size, mid) {
  const usdcIn = BigInt(Math.round(size * 1e6)), base = size / mid, wethIn = BigInt(Math.round(base * 1e18));
  const [gasPrice, ...qs] = await Promise.all([rpc(f, 'eth_gasPrice', []), ...POOL_FEES.map((fee) => call(f, quoteCall(USDC, WETH, usdcIn, fee)).then(quoteOut).catch(() => null)), ...POOL_FEES.map((fee) => call(f, quoteCall(WETH, USDC, wethIn, fee)).then(quoteOut).catch(() => null))]);
  const buys = qs.slice(0, POOL_FEES.length), sells = qs.slice(POOL_FEES.length);
  const bi = buys.reduce((m, q, i) => (q && (m < 0 || q.out > buys[m].out) ? i : m), -1), si = sells.reduce((m, q, i) => (q && (m < 0 || q.out > sells[m].out) ? i : m), -1);
  if (bi < 0 || si < 0) throw new Error('uniswap gave no quote');
  const ethUsd = mid, gwei = Number(BigInt(gasPrice)) / 1e9;
  // gas per swap: the quoter's estimate plus about 50,000 for the transaction itself; Base's small L1 data fee is not counted
  const gasUsd = ((Math.max(buys[bi].gas, sells[si].gas) + 50000) * gwei * 1e-9) * ethUsd;
  return { ...dexBook({ size, buyOut: Number(buys[bi].out) / 1e18, base, sellOut: Number(sells[si].out) / 1e6 }), gasUsd, pools: { buy: POOL_FEES[bi], sell: POOL_FEES[si] } };
}

/** Every venue's book for a coin, read now. { venues: { name: { asks, bids, fee, gasUsd? } }, missing: [{ venue, why }], at }. */
export async function readVenues(coin, { size = 1000, fees = {}, only = null, f = fetch } = {}) {
  const map = COINS[coin]; if (!map) throw new Error('coin must be one of ' + Object.keys(COINS).join(', '));
  const want = VENUES.filter((v) => map[v] && (!only || only.includes(v))), venues = {}, missing = [];
  const fee = (v) => (Number.isFinite(fees[v]) && fees[v] >= 0 && fees[v] < 0.05 ? fees[v] : FEES[v]);
  await Promise.all(want.filter((v) => v !== 'uniswap').map(async (v) => { try { const b = await BOOK[v](f, map[v]); if (b.asks.length && b.bids.length) venues[v] = { ...b, fee: fee(v) }; else missing.push({ venue: v, why: 'empty book' }); } catch (e) { missing.push({ venue: v, why: String(e.message || e).slice(0, 80) }); } }));
  if (want.includes('uniswap')) {
    const mids = Object.values(venues).map((v) => (v.asks[0][0] + v.bids[0][0]) / 2).sort((a, b) => a - b);
    if (!mids.length) missing.push({ venue: 'uniswap', why: 'no exchange price to size the quote' });
    else { try { venues.uniswap = { ...(await uniswap(f, size, mids[Math.floor(mids.length / 2)])), fee: 0 }; } catch (e) { missing.push({ venue: 'uniswap', why: String(e.message || e).slice(0, 80) }); } }
  }
  return { coin, venues, missing, at: new Date().toISOString() };
}
