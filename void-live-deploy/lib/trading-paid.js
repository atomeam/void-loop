// The trading bots' two paid calls, run by Verse's one paid-call route (functions/api/x402/[service].js, the wallet thread's flow: inputs checked
// before any payment, the payment verified, the work run, and only work that is done settled). Each is a route object { onRequestPost } that
// [service].js calls like a free route; it answers 200 with the work, or another status when the work could not be done (nothing is charged).
// Read only: these compute on public data; nothing is traded, and no key, wallet or money is asked for or held.
import { BOTS, backtest, candlesOf, walkForward, paramsOf } from '../trading-bots/kit/strategy.js';
import { readVenues, COINS, VENUES } from './arb-venues.js';
import { scan, spread } from '../trading-bots/kit/arb.js';

const J = (b, s = 200) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store' } });
const bodyOf = async (request) => { try { return JSON.parse(await request.text()); } catch (_) { return null; } };

// ---- POST /api/x402/backtest: a bot backtested on the site's own daily candles (/trading-bots/data/<PAIR>.json) ----
export const PAIRS = ['BTC-USD', 'ETH-USD'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** The call's inputs, checked: { ok, input } or { ok: false, error }. Pure. */
export function btInput(b) {
  if (!b || typeof b !== 'object') return { ok: false, error: 'send JSON: { bot, pair?, params?, fee?, slippage?, from?, to? }' };
  if (!BOTS[b.bot]) return { ok: false, error: 'bot must be one of ' + Object.keys(BOTS).join(', ') };
  const pair = b.pair || 'BTC-USD'; if (!PAIRS.includes(pair)) return { ok: false, error: 'pair must be one of ' + PAIRS.join(', ') };
  const frac = (v, d) => (v === undefined ? d : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 0.05 ? Number(v) : NaN);
  const fee = frac(b.fee, 0.008), slippage = frac(b.slippage, 0.001);
  if (Number.isNaN(fee) || Number.isNaN(slippage)) return { ok: false, error: 'fee and slippage are fractions from 0 to 0.05 (0.008 = 0.8%)' };
  for (const k of ['from', 'to']) if (b[k] !== undefined && !DAY_RE.test(String(b[k]))) return { ok: false, error: k + ' is YYYY-MM-DD' };
  return { ok: true, input: { bot: b.bot, pair, params: paramsOf(b.bot, b.params && typeof b.params === 'object' ? b.params : {}), fee, slippage, from: b.from, to: b.to } };
}

/** The paid answer for checked input over candles. Pure. */
export function answer(i, data) {
  const c = candlesOf(data.rows), r = backtest(c, i.bot, i.params, { fee: i.fee, slippage: i.slippage, from: i.from, to: i.to });
  if (!r) return null;
  return { bot: i.bot, name: BOTS[i.bot].name, pair: i.pair, data: { source: data.source, first: data.first, asOf: data.asOf }, params: r.params, fee: r.fee, slippage: r.slippage,
    from: r.from, to: r.to, stats: r.stats, hold: r.hold, trades: r.trades, open: r.open, equity: r.equity,
    walkForward: walkForward(c, i.bot, { fee: i.fee, slippage: i.slippage }),
    note: 'A backtest on past daily prices. Past results do not predict future results. Decided on the daily close, traded at the next open, long or cash.' };
}

export const backtestRoute = {
  async onRequestPost({ request, env }) {
    const i = btInput(await bodyOf(request)); if (!i.ok) return J({ error: i.error }, 400);
    let r = null; try { r = await env.ASSETS.fetch(new Request(new URL('/trading-bots/data/' + i.input.pair + '.json', request.url))); } catch (_) {}
    if (!r || !r.ok) return J({ error: 'the ' + i.input.pair + ' price history is not on the site yet' }, 503);
    const out = answer(i.input, await r.json());
    return out ? J(out) : J({ error: 'no trading days in that window' }, 400);
  },
};

// ---- POST /api/x402/arbitrage: BTC or ETH price gaps across exchanges and Uniswap v3 on Base, read now, after every cost ----
/** The call's inputs, checked. Pure. */
export function arbInput(b) {
  if (!b || typeof b !== 'object') return { ok: false, error: 'send JSON: { coin, size?, fees?, transferUsd?, venues? }' };
  const coin = String(b.coin || '').toUpperCase(); if (!COINS[coin]) return { ok: false, error: 'coin must be one of ' + Object.keys(COINS).join(', ') };
  const size = b.size === undefined ? 1000 : Number(b.size); if (!(size >= 10 && size <= 250000)) return { ok: false, error: 'size is dollars from 10 to 250000' };
  const transferUsd = b.transferUsd === undefined ? 0 : Number(b.transferUsd); if (!(transferUsd >= 0 && transferUsd <= 10000)) return { ok: false, error: 'transferUsd is dollars from 0 to 10000' };
  const fees = {}; if (b.fees && typeof b.fees === 'object') for (const [k, v] of Object.entries(b.fees)) { if (!VENUES.includes(k) || !(Number(v) >= 0 && Number(v) < 0.05)) return { ok: false, error: 'fees: { venue: fraction under 0.05 } for ' + VENUES.join(', ') }; fees[k] = Number(v); }
  let only = null; if (b.venues !== undefined) { if (!Array.isArray(b.venues) || b.venues.some((v) => !VENUES.includes(v))) return { ok: false, error: 'venues is a list of ' + VENUES.join(', ') }; only = b.venues; }
  return { ok: true, input: { coin, size, transferUsd, fees, only } };
}

export async function scanNow(i, f = fetch) {
  const r = await readVenues(i.coin, { size: i.size, fees: i.fees, only: i.only, f });
  if (Object.keys(r.venues).length < 2) return { ok: false, status: 503, error: 'fewer than two venues answered just now', missing: r.missing };
  const fees = Object.fromEntries(Object.entries(r.venues).map(([k, v]) => [k, v.fee]));
  return { ok: true, body: { coin: i.coin, size: i.size, transferUsd: i.transferUsd, at: r.at, fees, gasUsd: r.venues.uniswap ? r.venues.uniswap.gasUsd : undefined, uniswapPools: r.venues.uniswap ? r.venues.uniswap.pools : undefined,
    spread: spread(r.venues), rows: scan(r.venues, { size: i.size, transferUsd: i.transferUsd }), missing: r.missing,
    note: 'Prices read now from public order books; they move in milliseconds and faster bots close real gaps first. Net is after both taker fees, DEX gas and your transfer cost. USDC is counted as one dollar. Nothing was traded.' } };
}

export const arbitrageRoute = {
  async onRequestPost({ request }) {
    const i = arbInput(await bodyOf(request)); if (!i.ok) return J({ error: i.error }, 400);
    const r = await scanNow(i.input);
    return r.ok ? J(r.body) : J({ error: r.error, missing: r.missing }, r.status || 503);
  },
};
