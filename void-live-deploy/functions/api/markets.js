// Crypto prices for Verse's markets card: the top coins (or a short list of CoinGecko ids) with 7-day sparklines, from
// CoinGecko's free public API (https://docs.coingecko.com/v3.0.1/reference/coins-markets, no key). Hostile read: GET only,
// ids are checked against a strict pattern, no model is called and nothing is written to KV; the answer is kept in the edge
// cache (caches.default) for two minutes, so CoinGecko is asked at most once per two minutes per list per data centre.
// Read-only market data: no wallets, no keys, no trades, no advice.
export const ID_RE = /^[a-z0-9-]{2,40}$/;
const DEFAULT_IDS = 'bitcoin,ethereum,solana,ripple,dogecoin,cardano,litecoin,binancecoin';
/** the ids to ask for: a clean comma list of at most 12, or the default. Pure. */
export function cleanIds(raw) {
  const ids = String(raw || '').toLowerCase().split(',').map((s) => s.trim()).filter((s) => ID_RE.test(s)).slice(0, 12);
  return ids.length ? [...new Set(ids)].join(',') : DEFAULT_IDS;
}
/** CoinGecko's row cut to what the card needs, sparkline thinned to at most 56 points. Pure. */
export function slim(row) {
  const sp = (row && row.sparkline_in_7d && row.sparkline_in_7d.price) || [];
  const step = Math.max(1, Math.ceil(sp.length / 56));
  return { id: row.id, symbol: String(row.symbol || '').toUpperCase(), name: row.name, image: row.image, price: row.current_price,
    change24h: row.price_change_percentage_24h, cap: row.market_cap, rank: row.market_cap_rank,
    spark: sp.filter((_, i) => i % step === 0).map((v) => +Number(v).toPrecision(6)), updated: row.last_updated };
}
export async function onRequestGet({ request }) {
  const url = new URL(request.url), ids = cleanIds(url.searchParams.get('ids'));
  const vs = /^(usd|eur|gbp|jpy)$/.test(url.searchParams.get('vs') || '') ? url.searchParams.get('vs') : 'usd';
  const key = new Request(url.origin + '/__markets/' + vs + '/' + ids);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let body, status = 200;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=' + vs + '&ids=' + ids + '&sparkline=true&price_change_percentage=24h', { headers: { accept: 'application/json', 'user-agent': 'Verse (a-to-mind.com)' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const rows = await r.json();
    body = { ok: true, vs, source: 'CoinGecko', at: new Date().toISOString(), coins: (Array.isArray(rows) ? rows : []).map(slim) };
  } catch (e) { body = { ok: false, vs, error: 'The price service did not answer.', why: String(e && e.message || e).slice(0, 60) }; status = 503; }
  // 503, not 502: Cloudflare swaps a Function's 502 for its own error page, and the card needs this JSON to fall back
  const res = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + (status === 200 ? 120 : 15) } });
  if (cache && status === 200) await cache.put(key, res.clone());
  return res;
}
