// The /markets/ page's pure half (shared by the page and functions/api/markets.js): which symbol a person meant, the closed lists a stranger can pick from,
// the sources' rows read into one shape, and every number the quote card shows worked out from daily rows. No network, no clock but the one passed in.
// Data may be delayed; this is read-only market data: no trading, no accounts, no advice.

export const RANGES = Object.freeze(['1d', '5d', '1m', '6m', 'ytd', '1y', '5y', 'max']);
export const RANGE_LABEL = Object.freeze({ '1d': '1D', '5d': '5D', '1m': '1M', '6m': '6M', ytd: 'YTD', '1y': '1Y', '5y': '5Y', max: 'Max' });
const DAY = 86400000;

// CoinGecko ids (a closed list: a stranger cannot pick any other id) by the tickers people type
export const COINS = Object.freeze({
  BTC: ['bitcoin', 'Bitcoin'], ETH: ['ethereum', 'Ethereum'], SOL: ['solana', 'Solana'], XRP: ['ripple', 'XRP'], DOGE: ['dogecoin', 'Dogecoin'], ADA: ['cardano', 'Cardano'],
  LTC: ['litecoin', 'Litecoin'], BNB: ['binancecoin', 'BNB'], AVAX: ['avalanche-2', 'Avalanche'], DOT: ['polkadot', 'Polkadot'], LINK: ['chainlink', 'Chainlink'], TRX: ['tron', 'TRON'],
  TON: ['the-open-network', 'Toncoin'], XLM: ['stellar', 'Stellar'], BCH: ['bitcoin-cash', 'Bitcoin Cash'], ATOM: ['cosmos', 'Cosmos'], XMR: ['monero', 'Monero'], ETC: ['ethereum-classic', 'Ethereum Classic'],
  SHIB: ['shiba-inu', 'Shiba Inu'], UNI: ['uniswap', 'Uniswap'], NEAR: ['near', 'NEAR Protocol'], APT: ['aptos', 'Aptos'], ARB: ['arbitrum', 'Arbitrum'], OP: ['optimism', 'Optimism'],
  FIL: ['filecoin', 'Filecoin'], AAVE: ['aave', 'Aave'], ALGO: ['algorand', 'Algorand'], HBAR: ['hedera-hashgraph', 'Hedera'], USDT: ['tether', 'Tether'], USDC: ['usd-coin', 'USD Coin'],
});
// ECB reference currencies (frankfurter.dev): a closed list
export const CURRENCIES = Object.freeze(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'CNY', 'HKD', 'SGD', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR', 'ILS', 'IDR', 'MYR', 'PHP', 'THB', 'ISK']);
// indices: [shown symbol, name, Stooq symbol, Yahoo symbol, aliases]
export const INDICES = Object.freeze([
  ['SPX', 'S&P 500', '^spx', '^GSPC', ['s&p 500', 's&p', 'sp500', 'sp 500', 'spx', '^gspc', '^spx', 'gspc']],
  ['DJI', 'Dow Jones Industrial Average', '^dji', '^DJI', ['dow jones', 'dow', 'djia', 'dji', '^dji']],
  ['NDX', 'Nasdaq 100', '^ndx', '^NDX', ['nasdaq 100', 'ndx', '^ndx']],
  ['IXIC', 'Nasdaq Composite', '^ndq', '^IXIC', ['nasdaq', 'nasdaq composite', 'ixic', '^ixic']],
  ['UKX', 'FTSE 100', '^ukx', '^FTSE', ['ftse 100', 'ftse', 'ukx', '^ftse']],
  ['DAX', 'DAX', '^dax', '^GDAXI', ['dax', '^gdaxi', 'gdaxi']],
  ['NKX', 'Nikkei 225', '^nkx', '^N225', ['nikkei', 'nikkei 225', 'nkx', '^n225']],
  ['HSI', 'Hang Seng', '^hsi', '^HSI', ['hang seng', 'hsi', '^hsi']],
]);
// well-known names people type instead of a ticker: [ticker, name, aliases]
export const NAMES = Object.freeze([
  ['AAPL', 'Apple', ['apple']], ['MSFT', 'Microsoft', ['microsoft']], ['GOOGL', 'Alphabet (Google)', ['google', 'alphabet']], ['AMZN', 'Amazon', ['amazon']], ['NVDA', 'NVIDIA', ['nvidia']],
  ['META', 'Meta Platforms', ['meta', 'facebook']], ['TSLA', 'Tesla', ['tesla']], ['BRK-B', 'Berkshire Hathaway', ['berkshire', 'berkshire hathaway']], ['JPM', 'JPMorgan Chase', ['jpmorgan', 'jp morgan']],
  ['V', 'Visa', ['visa']], ['MA', 'Mastercard', ['mastercard']], ['WMT', 'Walmart', ['walmart']], ['KO', 'Coca-Cola', ['coca cola', 'coca-cola', 'coke']], ['PEP', 'PepsiCo', ['pepsi', 'pepsico']],
  ['DIS', 'Disney', ['disney']], ['NFLX', 'Netflix', ['netflix']], ['AMD', 'AMD', ['amd']], ['INTC', 'Intel', ['intel']], ['ORCL', 'Oracle', ['oracle']], ['ADBE', 'Adobe', ['adobe']],
  ['CRM', 'Salesforce', ['salesforce']], ['NKE', 'Nike', ['nike']], ['MCD', "McDonald's", ['mcdonalds', "mcdonald's"]], ['SBUX', 'Starbucks', ['starbucks']], ['BA', 'Boeing', ['boeing']],
  ['XOM', 'Exxon Mobil', ['exxon', 'exxon mobil']], ['CVX', 'Chevron', ['chevron']], ['PFE', 'Pfizer', ['pfizer']], ['JNJ', 'Johnson & Johnson', ['johnson & johnson', 'j&j']], ['UNH', 'UnitedHealth', ['unitedhealth']],
  ['HD', 'Home Depot', ['home depot']], ['COST', 'Costco', ['costco']], ['PYPL', 'PayPal', ['paypal']], ['UBER', 'Uber', ['uber']], ['ABNB', 'Airbnb', ['airbnb']], ['COIN', 'Coinbase', ['coinbase']],
  ['GME', 'GameStop', ['gamestop']], ['PLTR', 'Palantir', ['palantir']], ['SHOP', 'Shopify', ['shopify']], ['SPOT', 'Spotify', ['spotify']], ['T', 'AT&T', ['at&t']], ['VZ', 'Verizon', ['verizon']],
  ['BAC', 'Bank of America', ['bank of america']], ['GS', 'Goldman Sachs', ['goldman sachs', 'goldman']], ['IBM', 'IBM', ['ibm']], ['CSCO', 'Cisco', ['cisco']], ['QCOM', 'Qualcomm', ['qualcomm']],
  ['SPY', 'SPDR S&P 500 ETF', ['spy']], ['QQQ', 'Invesco QQQ (Nasdaq 100 ETF)', ['qqq']], ['VOO', 'Vanguard S&P 500 ETF', ['voo']], ['VTI', 'Vanguard Total Stock Market ETF', ['vti']],
  ['IWM', 'iShares Russell 2000 ETF', ['iwm']], ['GLD', 'SPDR Gold Shares', ['gld', 'gold etf']], ['TLT', 'iShares 20+ Year Treasury ETF', ['tlt']], ['VT', 'Vanguard Total World ETF', ['vt']],
]);
// exchanges beyond the US: typed suffix -> [Stooq suffix, Yahoo suffix, currency]
const SUFFIX = Object.freeze({ l: ['uk', '.L', 'GBX'], de: ['de', '.DE', 'EUR'], t: ['jp', '.T', 'JPY'] });

function stock(sym, name, suf) {
  return { kind: 'stock', sym: suf ? sym + '.' + suf[1].slice(1) : sym, name, stooq: sym.toLowerCase() + '.' + (suf ? suf[0] : 'us'), yahoo: sym + (suf ? suf[1] : ''), currency: suf ? suf[2] : 'USD' };
}
const coin = (sym) => ({ kind: 'crypto', sym, name: COINS[sym][1], coin: COINS[sym][0], yahoo: sym + '-USD', currency: 'USD' });

/** What a typed symbol or name means: { kind: 'stock'|'index'|'crypto'|'fx', sym (shown), name, stooq, yahoo, coin, from, to, currency } or null. Pure.
 *  Everything that leaves the server is built from these closed lists or a ticker of letters, so nobody picks a host, a path or a header. */
export function resolve(input) {
  const t = String(input == null ? '' : input).replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase(); if (!t) return null;
  for (const [sym, name, stooq, yahoo, al] of INDICES) if (al.includes(t)) return { kind: 'index', sym, name, stooq, yahoo, currency: 'pts' };
  const base = t.replace(/[-/ ]?usdt?$/, ''), up = base.toUpperCase();
  if (base !== t && COINS[up]) return coin(up);
  if (COINS[t.toUpperCase()]) return coin(t.toUpperCase());
  for (const [sym, v] of Object.entries(COINS)) if (t === v[0] || t === v[1].toLowerCase()) return coin(sym);
  const fx = t.match(/^([a-z]{3})[\s/-]?([a-z]{3})(?:=x)?$/);
  if (fx) { const a = fx[1].toUpperCase(), b = fx[2].toUpperCase(); if (a !== b && CURRENCIES.includes(a) && CURRENCIES.includes(b)) return { kind: 'fx', sym: a + '/' + b, name: a + ' to ' + b, from: a, to: b, yahoo: a + b + '=X', currency: b }; }
  for (const [sym, name, al] of NAMES) if (t === sym.toLowerCase() || al.includes(t)) return stock(sym, name);
  if (t.length >= 4) { const hit = NAMES.find(([, , al]) => al.some((a) => a.startsWith(t))); if (hit) return stock(hit[0], hit[1]); }
  const sm = t.match(/^([a-z]{1,5}(?:-[a-z])?)(?:\.([a-z]{1,2}))?$/);
  if (!sm) return null;
  const suf = sm[2] ? SUFFIX[sm[2]] : null; if (sm[2] && !suf) return null;
  return stock(sm[1].toUpperCase(), '', suf);
}

const num = (x) => (Number.isFinite(x) ? x : null);
/** Rows (t in ms UTC; o h l c v) from Stooq's daily CSV ("Date,Open,High,Low,Close,Volume"); [] when it is not that (an error page, "No data", a key wall). Pure. */
export function parseStooqDaily(csv) {
  const lines = String(csv || '').trim().split(/\r?\n/); if (!lines.length || !/^date,open,high,low,close/i.test(lines[0])) return [];
  const out = [];
  for (const l of lines.slice(1)) {
    const p = l.split(','), t = Date.parse(p[0] + 'T00:00:00Z'), c = parseFloat(p[4]); if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    const n = (x) => num(parseFloat(x));
    out.push({ t, o: n(p[1]), h: n(p[2]), l: n(p[3]), c, v: n(p[5]) });
  }
  return out.sort((a, b) => a.t - b.t);
}
/** Rows and meta from Yahoo's chart JSON (the unofficial endpoint, the fallback): { rows, meta } or null. Pure. */
export function parseYahoo(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0]; if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {}, rows = [], at = (k, i) => num(q[k] && q[k][i]);
  r.timestamp.forEach((ts, i) => { const c = at('close', i); if (c != null) rows.push({ t: ts * 1000, o: at('open', i), h: at('high', i), l: at('low', i), c, v: at('volume', i) }); });
  const m = r.meta || {};
  return { rows, meta: { currency: m.currency || null, name: m.longName || m.shortName || null, price: num(m.regularMarketPrice), prev: null, /* never chartPreviousClose: on a one-year chart it is the close a YEAR ago (a 13% 'day move' on the strip, 2026-10-26); the day's move comes from the last two daily rows */ hi52: num(m.fiftyTwoWeekHigh), lo52: num(m.fiftyTwoWeekLow), dayHigh: num(m.regularMarketDayHigh), dayLow: num(m.regularMarketDayLow), volume: num(m.regularMarketVolume) } };
}

/** Where a range starts, given the last row's time. Pure. */
export function rangeStart(range, lastT) {
  const d = new Date(lastT);
  switch (range) {
    case '1d': return lastT - DAY; case '5d': return lastT - 5 * DAY; case '1m': return lastT - 31 * DAY; case '6m': return lastT - 183 * DAY;
    case 'ytd': return Date.UTC(d.getUTCFullYear(), 0, 1); case '1y': return lastT - 366 * DAY; case '5y': return lastT - 5 * 366 * DAY; default: return 0;
  }
}
/** At most `n` points of a series, evenly spread, the first and the last kept. Pure. */
export function thin(points, n = 240) {
  if (points.length <= n) return points.slice();
  const out = []; for (let i = 0; i < n; i++) out.push(points[Math.round(i * (points.length - 1) / (n - 1))]); return out;
}
/** The last row on or before a day (YYYY-MM-DD): { date, close } or null. Pure. */
export function closeOn(rows, day) {
  const end = Date.parse(String(day) + 'T00:00:00Z'); if (!Number.isFinite(end)) return null;
  let hit = null; for (const r of rows) { if (r.t <= end + DAY - 1) hit = r; else break; }
  return hit ? { date: new Date(hit.t).toISOString().slice(0, 10), close: hit.c } : null;
}
/** The quote card from rows (oldest first) and the range asked: price, the move from the previous close, the day's range, the 52 weeks, volume, the chart.
 *  `meta` fills what rows cannot (Yahoo's own day range and 52 weeks). `daily` false: rows are intraday, so the previous close must come from meta. Pure. */
export function summarize(rows, range, meta = {}, daily = true) {
  if (!rows || !rows.length) return null;
  const last = rows[rows.length - 1], prevRow = daily && rows.length > 1 ? rows[rows.length - 2] : null;
  const price = meta.price != null ? meta.price : last.c, prev = meta.prev != null ? meta.prev : prevRow ? prevRow.c : daily ? null : rows[0].c;
  const yr = rows.filter((r) => r.t > last.t - 366 * DAY), spans = daily && yr.length > 1 && last.t - yr[0].t > 330 * DAY; // 52 weeks only when a year of rows is really there
  const from = rangeStart(range, last.t), shown = rows.filter((r) => r.t >= from), pts = thin((shown.length > 1 ? shown : rows.slice(-2)).map((r) => [r.t, +r.c.toPrecision(7)]));
  // for the reports: the average volume of the 30 sessions before the last, and the usual daily move (the standard deviation of the last 60 daily percent changes)
  const vols = rows.slice(-31, -1).map((r) => r.v).filter((v) => v != null && v > 0), avgVol = daily && vols.length >= 10 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const rets = []; if (daily) for (let i = Math.max(1, rows.length - 60); i < rows.length; i++) if (rows[i - 1].c) rets.push((rows[i].c / rows[i - 1].c - 1) * 100);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1), sd = rets.length >= 30 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) : null;
  return {
    avgVol, sd, price, prev, change: prev != null ? price - prev : null, pct: prev ? (price - prev) / prev * 100 : null,
    open: last.o, dayHigh: meta.dayHigh != null ? meta.dayHigh : last.h, dayLow: meta.dayLow != null ? meta.dayLow : last.l, volume: meta.volume != null ? meta.volume : last.v,
    hi52: meta.hi52 != null ? meta.hi52 : spans ? Math.max(...yr.map((r) => (r.h != null ? r.h : r.c))) : null, lo52: meta.lo52 != null ? meta.lo52 : spans ? Math.min(...yr.map((r) => (r.l != null ? r.l : r.c))) : null,
    asOf: last.t, points: pts,
    rangeChange: pts.length > 1 ? pts[pts.length - 1][1] - pts[0][1] : null, rangePct: pts.length > 1 && pts[0][1] ? (pts[pts.length - 1][1] - pts[0][1]) / pts[0][1] * 100 : null,
  };
}

/** CoinGecko's market_chart ({ prices: [[ms, price]] }) as rows. Pure. */
export const rowsFromPrices = (j) => ((j && j.prices) || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => ({ t: p[0], o: null, h: null, l: null, c: p[1], v: null }));
/** frankfurter's time series ({ rates: { 'YYYY-MM-DD': { EUR: 0.9 } } }) for one target as rows. Pure. */
export const rowsFromFx = (j, to) => Object.entries((j && j.rates) || {}).filter(([, v]) => v && Number.isFinite(v[to])).map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z'), o: null, h: null, l: null, c: v[to], v: null })).sort((a, b) => a.t - b.t);

/** A price for the screen: grouped, with the decimals a price of that size needs. Pure. */
export function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '–'; const a = Math.abs(v);
  return v.toLocaleString('en-US', { minimumFractionDigits: a >= 1 ? 2 : 0, maximumFractionDigits: a >= 1 ? 2 : a >= 0.01 ? 4 : 6 });
}
/** A big number short: 1.23T, 4.5B, 6.7M, 8.9K. Pure. */
export function fmtBig(v) { if (v == null || !Number.isFinite(v)) return '–'; const a = Math.abs(v); for (const [n, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= n) return +(v / n).toFixed(2) + s; return String(Math.round(v)); }
/** A signed change and percent: "+1.23 (+0.45%)". Pure. */
export function fmtMove(change, pct) { if (change == null || pct == null) return '–'; const s = change >= 0 ? '+' : '−'; return s + fmtPrice(Math.abs(change)) + ' (' + s + Math.abs(pct).toFixed(2) + '%)'; }
/** A day as people read it: "31 Dec 2024". Pure. */
export function fmtDay(ms) { const d = new Date(ms); return d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

/** The chart as an SVG path in a w by h box, plus the x of each point (for the hover readout). Pure. */
export function chartPath(points, w = 600, h = 220, pad = 4) {
  const v = (points || []).filter((p) => Array.isArray(p) && Number.isFinite(p[1])); if (v.length < 2) return { d: '', xy: [] };
  const t0 = v[0][0], ts = v[v.length - 1][0] - t0 || 1, lo = Math.min(...v.map((p) => p[1])), hi = Math.max(...v.map((p) => p[1])), sp = hi - lo || 1;
  const xy = v.map((p) => [pad + (p[0] - t0) / ts * (w - 2 * pad), h - pad - (p[1] - lo) / sp * (h - 2 * pad)]);
  return { d: xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), xy, lo, hi };
}
/** Two series on one chart as percent change from each one's first point. Pure. */
export function comparePaths(a, b, w = 600, h = 220, pad = 4) {
  const norm = (pts) => { const v = pts.filter((p) => Number.isFinite(p[1])); return v.map((p) => [p[0], (p[1] / v[0][1] - 1) * 100]); };
  const A = norm(a || []), B = norm(b || []); if (A.length < 2 || B.length < 2) return null;
  const all = A.concat(B), lo = Math.min(...all.map((p) => p[1])), hi = Math.max(...all.map((p) => p[1])), sp = hi - lo || 1;
  const t0 = Math.min(A[0][0], B[0][0]), ts = Math.max(A[A.length - 1][0], B[B.length - 1][0]) - t0 || 1;
  const path = (P) => P.map((p, i) => (i ? 'L' : 'M') + (pad + (p[0] - t0) / ts * (w - 2 * pad)).toFixed(1) + ' ' + (h - pad - (p[1] - lo) / sp * (h - 2 * pad)).toFixed(1)).join(' ');
  return { a: path(A), b: path(B), endA: A[A.length - 1][1], endB: B[B.length - 1][1] };
}
/** The watchlist as it is kept and as it travels in a link: shown symbols only, at most 20. Pure. */
export function cleanList(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw || '').split(','), out = [];
  for (const s of arr) { const r = resolve(s); if (r && !out.includes(r.sym)) out.push(r.sym); if (out.length >= 20) break; }
  return out;
}

// ---- the crypto market-cap table and the small-universe screener (/markets/caps/, /markets/screener/)
/** at most 40 values of a series, for a small chart. Pure. */
export const sparkOf = (v) => (Array.isArray(v) && v.length > 1 ? thin(v.filter(Number.isFinite), 40).map((x) => +x.toPrecision(5)) : []);
/** an SVG path for a series in a w by h box. Pure. */
export function sparkD(v, w = 80, h = 24) { const a = (v || []).filter(Number.isFinite); if (a.length < 2) return ''; const lo = Math.min(...a), sp = Math.max(...a) - lo || 1; return a.map((x, i) => (i ? 'L' : 'M') + (i * w / (a.length - 1)).toFixed(1) + ' ' + (h - 1 - (x - lo) / sp * (h - 2)).toFixed(1)).join(' '); }
/** CoinGecko's markets rows cut to the table: rank, name, price, 24 hour and 7 day moves, market cap, volume, and the distance below the all-time high. Pure. */
export function capsRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r.id && Number.isFinite(r.current_price)).map((r) => ({ rank: r.market_cap_rank, id: r.id, sym: String(r.symbol || '').toUpperCase(), name: r.name, price: r.current_price, pct24: num(r.price_change_percentage_24h_in_currency != null ? r.price_change_percentage_24h_in_currency : r.price_change_percentage_24h), pct7: num(r.price_change_percentage_7d_in_currency), cap: num(r.market_cap), vol: num(r.total_volume), athPct: num(r.ath_change_percentage), spark: sparkOf(r.sparkline_in_7d && r.sparkline_in_7d.price) }));
}
/** The screener's rows: shares and indices from their quotes (the move, the distance below the 52-week high, volume against the 30-day average), coins from CoinGecko
 *  (the 24 hour move, the distance below the all-time high, no volume ratio). `from` is 'stocks', 'indices' or 'coins'. Pure. */
export function scanRows(quotes, coins) {
  const out = [];
  for (const q of quotes || []) if (q && q.ok && q.pct != null) out.push({ sym: q.sym, name: q.name, group: q.kind === 'index' ? 'indices' : 'stocks', price: q.price, pct: q.pct, below: q.hi52 ? Math.max(0, (1 - q.price / q.hi52) * 100) : null, basis: '52-week high', volX: q.avgVol && q.volume ? q.volume / q.avgVol : null, spark: sparkOf((q.points || []).map((p) => p[1])) });
  for (const c of coins || []) if (c.pct24 != null) out.push({ sym: c.sym, name: c.name, group: 'coins', price: c.price, pct: c.pct24, below: c.athPct != null ? Math.abs(c.athPct) : null, basis: 'all-time high', volX: null, spark: c.spark || [] });
  return out;
}
/** Filter and sort rows: { group: 'all'|'stocks'|'indices'|'coins', minPct, maxPct (the move, signed), nearHigh (within this many percent of the high), minVolX, sort: 'pct'|'-pct'|'below'|'volX'|'sym' }. Pure. */
export function screen(rows, f = {}) {
  const n = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const g = ['stocks', 'indices', 'coins'].includes(f.group) ? f.group : 'all', lo = n(f.minPct), hi = n(f.maxPct), near = n(f.nearHigh), vx = n(f.minVolX);
  const keep = rows.filter((r) => (g === 'all' || r.group === g) && (lo == null || r.pct >= lo) && (hi == null || r.pct <= hi) && (near == null || (r.below != null && r.below <= near)) && (vx == null || (r.volX != null && r.volX >= vx)));
  const key = { pct: (r) => -r.pct, '-pct': (r) => r.pct, below: (r) => (r.below == null ? 1e9 : r.below), volX: (r) => (r.volX == null ? 1e9 : -r.volX) }[f.sort];
  return key ? keep.sort((a, b) => key(a) - key(b)) : keep.sort((a, b) => (a.sym < b.sym ? -1 : 1));
}
