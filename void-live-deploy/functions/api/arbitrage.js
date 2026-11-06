// GET /api/arbitrage?coin=BTC|ETH: the free view behind /trading-bots/arbitrage/: every venue pair for a $1,000 trade at the entry-tier fees,
// read now (lib/arb-venues.js, trading-bots/kit/arb.js). Agents with their own size, fees, venues or transfer cost use the paid
// POST /api/x402/arbitrage. Nothing here trades.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (docs/RULES.md): an open, read-only GET. The caller picks only the coin, from a closed
// list of two. One miss asks five fixed public hosts (Coinbase Exchange, Kraken, Bitstamp, Gemini, Base's public RPC) once each, with a 4 s timeout;
// the answer is kept at the edge for 20 seconds, so a flood costs those hosts one call each per 20 s per coin. No key, no write, no database.
import { scanNow } from '../../lib/trading-paid.js';

export async function onRequestGet({ request, waitUntil }) {
  const coin = (new URL(request.url).searchParams.get('coin') || 'BTC').toUpperCase() === 'ETH' ? 'ETH' : 'BTC';
  const key = new Request(new URL('/api/arbitrage?coin=' + coin, request.url).toString()), cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const r = await scanNow({ coin, size: 1000, transferUsd: 0, fees: {}, only: null });
  const res = Response.json(r.ok ? r.body : { error: r.error, missing: r.missing }, { status: r.ok ? 200 : 503, headers: { 'cache-control': r.ok ? 'public, max-age=20' : 'no-store', 'access-control-allow-origin': '*' } });
  if (cache && r.ok) { const p = cache.put(key, res.clone()); if (waitUntil) waitUntil(p); else await p; }
  return res;
}
