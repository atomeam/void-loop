// Fixtures standing in for Stooq, Yahoo, CoinGecko and frankfurter.dev (the sources cannot be reached from the build machine): used by markets.test.mjs and the page walk-through
export const NOW = Date.UTC(2026, 9, 23, 21); // Friday 23 Oct 2026
export const DAYMS = 86400000;
// a fixture of daily rows ending on NOW's day: every close is 100 + the day number mod 40, except 2024-12-31 (the real close of 250.42 that the gate asks for) and the last two
export function csvFixture({ last = 188.5, prev = 180, hiDay = 230, loDay = 90 } = {}) {
  const lines = ['Date,Open,High,Low,Close,Volume']; const end = Date.UTC(2026, 9, 23);
  for (let t = end - 760 * DAYMS; t <= end; t += DAYMS) {
    const d = new Date(t), wd = d.getUTCDay(); if (wd === 0 || wd === 6) continue;
    const day = d.toISOString().slice(0, 10); let c = 100 + (Math.floor(t / DAYMS) % 40);
    if (day === '2024-12-31') c = 250.42; if (day === '2026-10-23') c = last; if (day === '2026-10-22') c = prev;
    let h = c + 1, l = c - 1; if (day === '2026-03-02') h = hiDay; if (day === '2026-02-02') l = loDay;
    lines.push([day, c - 0.5, h, l, c, 1000000 + (t / DAYMS) % 1000].join(','));
  }
  return lines.join('\n');
}
export const resp = (body, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
export const calls = [];
/** a fake network: routes by host; `down` hosts answer 500; `stooq` can be a key wall */
export function fake({ down = [], stooq = csvFixture(), yahoo, gecko, fx } = {}) {
  return async (url) => {
    calls.push(String(url)); const u = new URL(url);
    if (down.includes(u.host)) return resp('', false);
    if (u.host === 'stooq.com') return resp(stooq);
    if (u.host === 'query1.finance.yahoo.com') return yahoo ? resp(yahoo) : resp('', false);
    if (u.host === 'api.coingecko.com') {
      if (u.pathname.endsWith('/coins/markets') && u.searchParams.has('per_page')) { const names = ['Bitcoin', 'Ethereum', 'Tether', 'XRP', 'BNB', 'Solana', 'USD Coin', 'Dogecoin', 'TRON', 'Cardano']; const n = u.searchParams.has('ids') ? 30 : 50; return resp(Array.from({ length: n }, (_, i) => ({ id: 'coin-' + i, symbol: (['btc', 'eth', 'usdt', 'xrp', 'bnb', 'sol', 'usdc', 'doge', 'trx', 'ada'][i] || 'c' + i), name: names[i] || 'Coin ' + i, current_price: 70000 / (i + 1), market_cap: 1.4e12 / (i + 1), market_cap_rank: i + 1, total_volume: 3e10 / (i + 1), price_change_percentage_24h_in_currency: 2 - i * 0.1, price_change_percentage_7d_in_currency: 5 - i * 0.2, ath_change_percentage: -10 - i, sparkline_in_7d: { price: Array.from({ length: 168 }, (_, k) => 100 + ((k * (i + 3)) % 17)) } }))); }
      if (u.pathname.endsWith('/coins/markets')) return resp(gecko && gecko.markets || [{ id: 'bitcoin', name: 'Bitcoin', current_price: 70000, price_change_24h: 1400, high_24h: 71000, low_24h: 68000, total_volume: 3e10, market_cap: 1.4e12, market_cap_rank: 1 }]);
      const days = u.searchParams.get('days'); return resp({ prices: Array.from({ length: days === '365' ? 365 : 48 }, (_, i) => [NOW - (days === '365' ? 365 - i : (48 - i) / 24) * DAYMS, days === '365' ? 40000 + i * 80 : 69000 + i * 20]) });
    }
    if (u.host === 'api.frankfurter.dev') {
      if (/^\/v1\/\d{4}-\d{2}-\d{2}$/.test(u.pathname)) return resp({ date: '2024-12-30', rates: { [u.searchParams.get('symbols')]: 0.9652 } });
      return resp(fx || { rates: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [new Date(NOW - (300 - i) * DAYMS).toISOString().slice(0, 10), { [u.searchParams.get('symbols')]: 0.9 + i / 3000 }])) });
    }
    throw new Error('unexpected host ' + u.host);
  };
}

