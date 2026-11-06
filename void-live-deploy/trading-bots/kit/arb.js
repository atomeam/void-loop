// Verse arbitrage scanner: the math, in one file. It runs on https://a-to-mind.com/trading-bots/arbitrage/, in Verse's paid scan for agents
// (POST /api/x402/arbitrage) and in arb-scan.mjs, which you run yourself. Pure functions: no network, no keys, no orders. MIT licence.
//
// What it answers: if you bought `size` dollars of a coin on venue A and sold that coin on venue B right now, at the prices in their order
// books (walking down the book, not just the top price), after both venues' taker fees, gas on a DEX leg and any transfer cost you set,
// how many dollars would you end with? Most of the time the answer is fewer than you started with. A gap that survives every cost is rare
// and short-lived: books move, other bots are faster, and moving coins between venues takes time unless you already hold both sides.

/** Spend `quote` dollars into asks [[price, size], ...] (lowest first). { base, spent, filled, avg }. Pure. */
export function buyWith(asks, quote) {
  let left = quote, base = 0;
  for (const [p, s] of asks) { if (left <= 0) break; const cost = p * s; if (cost >= left) { base += left / p; left = 0; } else { base += s; left -= cost; } }
  const spent = quote - left; return { base, spent, filled: left <= 1e-9, avg: base > 0 ? spent / base : null };
}
/** Sell `base` coins into bids [[price, size], ...] (highest first). { quote, sold, filled, avg }. Pure. */
export function sellInto(bids, base) {
  let left = base, quote = 0;
  for (const [p, s] of bids) { if (left <= 0) break; const q = Math.min(s, left); quote += q * p; left -= q; }
  const sold = base - left; return { quote, sold, filled: left <= 1e-12, avg: sold > 0 ? quote / sold : null };
}
/** A book cleaned: numbers only, asks low to high, bids high to low. Pure. */
export function cleanBook(b) {
  const lv = (xs) => (xs || []).map((x) => [Number(x[0]), Number(x[1])]).filter(([p, s]) => p > 0 && s > 0);
  return { asks: lv(b.asks).sort((a, c) => a[0] - c[0]), bids: lv(b.bids).sort((a, c) => c[0] - a[0]) };
}

/**
 * Every venue pair, best first. venues: { name: { asks, bids, fee (taker, fraction), gasUsd? (a DEX leg's gas in dollars), at? } }.
 * opts: { size (dollars, default 1000), transferUsd (dollars to move the coin from A to B; 0 = you already hold coins on B) }.
 * Each row: buy venue, sell venue, prices paid and got, the gross gap at the top of the books, and the net dollars after every cost. Pure.
 */
export function scan(venues, opts = {}) {
  const size = opts.size ?? 1000, transfer = opts.transferUsd ?? 0, names = Object.keys(venues), rows = [];
  for (const a of names) for (const b of names) {
    if (a === b) continue;
    const A = venues[a], B = venues[b]; if (!A.asks.length || !B.bids.length) continue;
    const buy = buyWith(A.asks, size), got = buy.base * (1 - A.fee), sell = sellInto(B.bids, got);
    const out = sell.quote * (1 - B.fee) - (A.gasUsd || 0) - (B.gasUsd || 0) - transfer;
    rows.push({ buy: a, sell: b, size, filled: buy.filled && sell.filled, buyAvg: buy.avg, sellAvg: sell.avg,
      topGap: B.bids[0][0] / A.asks[0][0] - 1, fees: size * A.fee + sell.quote * B.fee, gasUsd: (A.gasUsd || 0) + (B.gasUsd || 0), transferUsd: transfer,
      net: out - size, netPct: (out - size) / size });
  }
  return rows.sort((x, y) => y.net - x.net);
}

/** The middle price of each venue, and how far apart the dearest and cheapest are. Pure. */
export function spread(venues) {
  const mids = Object.entries(venues).filter(([, v]) => v.asks.length && v.bids.length).map(([k, v]) => [k, (v.asks[0][0] + v.bids[0][0]) / 2]);
  if (!mids.length) return null;
  const lo = mids.reduce((m, x) => (x[1] < m[1] ? x : m)), hi = mids.reduce((m, x) => (x[1] > m[1] ? x : m));
  return { mids: Object.fromEntries(mids), low: lo[0], high: hi[0], gap: hi[1] / lo[1] - 1 };
}

/** A DEX quote for one size, made into a one-level book so scan() can use it: buyOut = coins for `size` dollars, sellOut = dollars for `base` coins. Pure. */
export function dexBook({ size, buyOut, base, sellOut }) {
  return { asks: buyOut > 0 ? [[size / buyOut, buyOut]] : [], bids: sellOut > 0 ? [[sellOut / base, base]] : [] };
}
