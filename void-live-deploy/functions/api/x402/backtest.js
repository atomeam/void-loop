// POST /api/x402/backtest: a Verse trading bot backtested on the site's own daily candles (/trading-bots/data/<PAIR>.json), paid per call over
// x402 (lib/x402-call.js, the same flow as the code review). Read only: it computes; nothing is traded, no key is asked for or held.
// The inputs are checked before any payment, so a bad call never costs anything.
import { paidCall, probeHandlers } from '../../../lib/x402-call.js';
import { BOTS, backtest, candlesOf, walkForward, paramsOf } from '../../../trading-bots/kit/strategy.js';

export const PAIRS = ['BTC-USD', 'ETH-USD'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** The call's inputs, checked: { ok, input } or { ok: false, error }. Pure. */
export function inputOf(b) {
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

const probe = probeHandlers('backtest');
export const onRequestGet = probe.get;
export const onRequestHead = probe.head;

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const i = inputOf(b); if (!i.ok) return Response.json({ error: i.error }, { status: 400 });
  return paidCall({ request, env, name: 'backtest', run: async () => {
    const r = await env.ASSETS.fetch(new Request(new URL('/trading-bots/data/' + i.input.pair + '.json', request.url)));
    if (!r.ok) return { ok: false, status: 503, error: 'the ' + i.input.pair + ' price history is not on the site yet' };
    const body = answer(i.input, await r.json());
    return body ? { ok: true, body } : { ok: false, status: 400, error: 'no trading days in that window' };
  } });
}
