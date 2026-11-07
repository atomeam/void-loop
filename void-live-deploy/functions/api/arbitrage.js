// GET /api/arbitrage?coin=BTC|ETH: the free view behind /trading-bots/arbitrage/: every venue pair for a $1,000 trade at the entry-tier fees,
// read now (lib/arb-venues.js, trading-bots/kit/arb.js). Agents with their own size, fees, venues or transfer cost use the paid
// POST /api/x402/arbitrage. Nothing here trades.
// GET /api/arbitrage?coin=BTC|ETH&history=1: what the free scan has seen over time (lib/arb-history.js): each fresh scan is one row.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (docs/RULES.md): an open, read-only GET. The caller picks only the coin, from a closed
// list of two. One miss asks five fixed public hosts (Coinbase Exchange, Kraken, Bitstamp, Gemini, Base's public RPC) once each, with a 4 s timeout;
// the answer is kept at the edge for 20 seconds, so a flood costs those hosts one call each per 20 s per coin. No key. The one write is the
// scan's own row in void_arb_scans, after the answer is sent, at most one per coin per 15 s (lib/arb-history.js says why that is bounded);
// ?history=1 is 3 indexed reads, kept at the edge for 60 seconds.
import { scanNow } from '../../lib/trading-paid.js';
import { record, summary } from '../../lib/arb-history.js';

export async function onRequestGet({ request, env, waitUntil }) {
  const q = new URL(request.url).searchParams, coin = (q.get('coin') || 'BTC').toUpperCase() === 'ETH' ? 'ETH' : 'BTC', hist = q.get('history') === '1';
  const key = new Request(new URL('/api/arbitrage?coin=' + coin + (hist ? '&history=1' : ''), request.url).toString()), cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const later = (p) => { if (waitUntil) waitUntil(p); else return p; };
  if (hist) {
    if (!env || !env.DB) return Response.json({ error: 'the scan history is not available just now' }, { status: 503, headers: { 'cache-control': 'no-store' } });
    let s; try { s = await summary(env.DB, coin); } catch (_) { return Response.json({ error: 'the scan history could not be read just now' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
    const res = Response.json(s, { headers: { 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*' } });
    if (cache) await later(cache.put(key, res.clone()));
    return res;
  }
  const r = await scanNow({ coin, size: 1000, transferUsd: 0, fees: {}, only: null });
  if (r.ok && env && env.DB) await later(record(env.DB, r.body).catch((e) => console.log('[arbitrage] scan not recorded: ' + String(e && e.message || e).slice(0, 200))));
  const res = Response.json(r.ok ? r.body : { error: r.error, missing: r.missing }, { status: r.ok ? 200 : 503, headers: { 'cache-control': r.ok ? 'public, max-age=20' : 'no-store', 'access-control-allow-origin': '*' } });
  if (cache && r.ok) await later(cache.put(key, res.clone()));
  return res;
}
