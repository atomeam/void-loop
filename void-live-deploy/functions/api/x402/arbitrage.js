// POST /api/x402/arbitrage: BTC or ETH price gaps across exchanges and Uniswap v3 on Base, read now (lib/arb-venues.js) and worked out after
// every cost (trading-bots/kit/arb.js), paid per call over x402 (lib/x402-call.js). Read only: public market data; nothing is traded.
// The inputs are checked before any payment; when fewer than two venues answer, nothing is charged.
import { paidCall } from '../../../lib/x402-call.js';
import { readVenues, COINS, VENUES } from '../../../lib/arb-venues.js';
import { scan, spread } from '../../../trading-bots/kit/arb.js';

/** The call's inputs, checked. Pure. */
export function inputOf(b) {
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

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const i = inputOf(b); if (!i.ok) return Response.json({ error: i.error }, { status: 400 });
  return paidCall({ request, env, name: 'arbitrage', run: () => scanNow(i.input) });
}
