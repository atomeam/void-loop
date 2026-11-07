// Verse trading bots: the strategies and the backtest, in one file. The same file runs in three places, so what you test is what you run:
//   - the backtest pages on https://a-to-mind.com/trading-bots/ (in your browser),
//   - the bot you download (bot.mjs imports this file to decide each day),
//   - Verse's paid backtest call for agents (POST /api/x402/backtest).
// No network, no keys, no orders here: pure functions over daily candles. MIT licence (see LICENSE next to this file).
//
// Timing, the same in the backtest and the bot: a decision is made from CLOSED daily candles only (the day that ended at 00:00 UTC),
// and the trade happens at the next day's open. The backtest charges a fee and slippage on every buy and every sell.
// Long or flat only: no shorting, no leverage, no borrowing.

/** Simple moving average of closes; null until there are n closes. */
export function sma(closes, n) {
  const out = new Array(closes.length).fill(null); let sum = 0;
  for (let i = 0; i < closes.length; i++) { sum += closes[i]; if (i >= n) sum -= closes[i - n]; if (i >= n - 1) out[i] = sum / n; }
  return out;
}
/** Wilder's RSI over n closes; null until it is defined. */
export function rsi(closes, n) {
  const out = new Array(closes.length).fill(null); let up = 0, down = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1], g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) { up += g / n; down += l / n; } else { up = (up * (n - 1) + g) / n; down = (down * (n - 1) + l) / n; }
    if (i >= n) out[i] = down === 0 ? 100 : 100 - 100 / (1 + up / down);
  }
  return out;
}
/** Highest high (or lowest low) of the n candles BEFORE i (i itself excluded); null until there are n. */
export function channel(values, n, pick) {
  const out = new Array(values.length).fill(null);
  for (let i = n; i < values.length; i++) { let v = values[i - n]; for (let k = i - n + 1; k < i; k++) v = pick(v, values[k]); out[i] = v; }
  return out;
}

const int = (lo, hi) => (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

// Each bot: its textbook parameters (fixed in advance, not fitted to the data shown), what each one may be set to, how many candles it needs
// before its first decision, and targets(candles, params): for every closed day, 1 = hold the coin from the next open, 0 = hold cash.
export const BOTS = {
  'trend-50-200': {
    name: 'Trend 50/200',
    idea: 'Holds the coin while its 50-day average is above its 200-day average, and holds cash otherwise.',
    rules: ['Buy at the next open when the 50-day average of closes is above the 200-day average.', 'Sell at the next open when it is not.'],
    params: { fast: 50, slow: 200 }, limits: { fast: int(2, 400), slow: int(3, 600) },
    grid: { fast: [20, 30, 50, 75, 100], slow: [100, 150, 200, 250] },
    warmup: (p) => Math.max(p.fast, p.slow),
    targets(c, p) {
      const close = c.map((x) => x.c), f = sma(close, p.fast), s = sma(close, p.slow);
      return close.map((_, i) => (f[i] !== null && s[i] !== null && p.fast < p.slow && f[i] > s[i] ? 1 : 0));
    },
  },
  'breakout-20-10': {
    name: 'Breakout 20/10',
    idea: 'Buys when the close breaks above the highest high of the last 20 days, and sells when it breaks below the lowest low of the last 10.',
    rules: ['Buy at the next open when a close is above the highest high of the 20 days before it.', 'Sell at the next open when a close is below the lowest low of the 10 days before it.'],
    params: { entry: 20, exit: 10 }, limits: { entry: int(2, 300), exit: int(2, 300) },
    grid: { entry: [10, 20, 40, 55], exit: [5, 10, 20] },
    warmup: (p) => Math.max(p.entry, p.exit),
    targets(c, p) {
      const hi = channel(c.map((x) => x.h), p.entry, Math.max), lo = channel(c.map((x) => x.l), p.exit, Math.min), out = []; let hold = 0;
      for (let i = 0; i < c.length; i++) {
        if (!hold && hi[i] !== null && c[i].c > hi[i]) hold = 1; else if (hold && lo[i] !== null && c[i].c < lo[i]) hold = 0;
        out.push(hold);
      }
      return out;
    },
  },
  'dip-rsi2': {
    name: 'Dip buyer RSI(2)',
    idea: 'In an uptrend (close above its 200-day average), buys a sharp short dip (2-day RSI under 10) and sells on the first close above the 5-day average.',
    rules: ['Buy at the next open when the close is above the 200-day average and the 2-day RSI is below 10.', 'Sell at the next open when the close is above the 5-day average.'],
    params: { rsi: 2, below: 10, trend: 200, exit: 5 }, limits: { rsi: int(2, 30), below: int(1, 50), trend: int(10, 400), exit: int(2, 50) },
    grid: { below: [5, 10, 20], trend: [100, 200], exit: [3, 5, 10] },
    warmup: (p) => Math.max(p.trend, p.exit, p.rsi + 1),
    targets(c, p) {
      const close = c.map((x) => x.c), r = rsi(close, p.rsi), t = sma(close, p.trend), e = sma(close, p.exit), out = []; let hold = 0;
      for (let i = 0; i < c.length; i++) {
        if (!hold && r[i] !== null && t[i] !== null && close[i] > t[i] && r[i] < p.below) hold = 1;
        else if (hold && e[i] !== null && close[i] > e[i]) hold = 0;
        out.push(hold);
      }
      return out;
    },
  },
};

/** The bot's parameters: its defaults, with any given value that is in range. Pure. */
export function paramsOf(id, given = {}) {
  const b = BOTS[id]; if (!b) throw new Error('no bot called ' + id);
  const p = {}; for (const k of Object.keys(b.params)) p[k] = b.limits[k](given[k], b.params[k]);
  return p;
}

/** Candles from the data files' rows: [YYYY-MM-DD, open, high, low, close, volume]. Sorted, one per day. Pure. */
export function candlesOf(rows) {
  return rows.map((r) => ({ t: Date.parse(r[0] + 'T00:00:00Z'), d: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4] }))
    .filter((x) => Number.isFinite(x.t) && x.o > 0 && x.c > 0).sort((a, b) => a.t - b.t);
}

/**
 * Run a bot over candles. opts: { fee, slippage } as fractions per trade (0.008 = 0.8%), { from, to } as YYYY-MM-DD (trading days kept),
 * and targets (precomputed) if you have them. Indicators always use the whole history before `from`, so the first day is not cold.
 * Equity starts at 1. Returns the equity per day, every trade, and the numbers. Pure.
 */
export function backtest(candles, id, params, opts = {}) {
  const b = BOTS[id], p = paramsOf(id, params), fee = opts.fee ?? 0.008, slip = opts.slippage ?? 0.001;
  const tg = opts.targets || b.targets(candles, p), warm = b.warmup(p);
  let first = Math.max(1, warm); while (first < candles.length && opts.from && candles[first].d < opts.from) first++;
  let last = candles.length - 1; while (last >= first && opts.to && candles[last].d > opts.to) last--;
  if (last - first < 1) return null;
  let cash = 1, units = 0, entry = null, peak = 1, maxDD = 0, inDays = 0;
  const equity = [], trades = [];
  for (let i = first; i <= last; i++) {
    const want = tg[i - 1], x = candles[i];
    if (want === 1 && units === 0) { const px = x.o * (1 + slip); units = (cash * (1 - fee)) / px; entry = { in: x.d, inPrice: px, cost: cash }; cash = 0; }
    else if (want === 0 && units > 0) { const px = x.o * (1 - slip); cash = units * px * (1 - fee); trades.push({ ...entry, out: x.d, outPrice: px, ret: cash / entry.cost - 1 }); units = 0; entry = null; }
    if (units > 0) inDays++;
    const eq = cash + units * x.c; equity.push([x.d, eq]);
    peak = Math.max(peak, eq); maxDD = Math.max(maxDD, 1 - eq / peak);
  }
  const open = entry ? { ...entry, out: null, outPrice: null, ret: (units * candles[last].c) / entry.cost - 1 } : null;
  // buy and hold over the same days, paying the same fee and slippage once to get in
  const hold0 = (1 - fee) / (candles[first].o * (1 + slip)); let hPeak = 1, hDD = 0;
  for (let i = first; i <= last; i++) { const e = hold0 * candles[i].c; hPeak = Math.max(hPeak, e); hDD = Math.max(hDD, 1 - e / hPeak); }
  const years = (candles[last].t - candles[first].t) / (365.25 * 86400000), end = equity[equity.length - 1][1], hEnd = hold0 * candles[last].c;
  const closed = trades.length, wins = trades.filter((t) => t.ret > 0).length;
  return {
    bot: id, params: p, fee, slippage: slip, from: candles[first].d, to: candles[last].d, days: last - first + 1, years,
    equity, trades, open,
    stats: {
      totalReturn: end - 1, cagr: years > 0 ? Math.pow(end, 1 / years) - 1 : null, maxDrawdown: maxDD, trades: closed + (open ? 1 : 0),
      closedTrades: closed, winRate: closed ? wins / closed : null, avgTrade: closed ? trades.reduce((s, t) => s + t.ret, 0) / closed : null,
      exposure: inDays / (last - first + 1),
    },
    hold: { totalReturn: hEnd - 1, cagr: years > 0 ? Math.pow(hEnd, 1 / years) - 1 : null, maxDrawdown: hDD },
  };
}

/** Today's decision for the bot: from closed candles only. { target: 0|1, day } where day is the last closed day it used. Pure. */
export function decide(candles, id, params, now = Date.now()) {
  const closed = candles.filter((x) => x.t + 86400000 <= now); // a candle whose day has not ended yet is never used
  const p = paramsOf(id, params);
  if (closed.length <= BOTS[id].warmup(p)) throw new Error('need more than ' + BOTS[id].warmup(p) + ' closed daily candles, got ' + closed.length);
  const tg = BOTS[id].targets(closed, p);
  return { target: tg[tg.length - 1], day: closed[closed.length - 1].d, params: p };
}

/** Every combination of a bot's grid, on top of its defaults. Pure. */
export function gridOf(id) {
  const b = BOTS[id]; let out = [{ ...b.params }];
  for (const [k, vals] of Object.entries(b.grid)) out = out.flatMap((p) => vals.map((v) => ({ ...p, [k]: v })));
  return out.filter((p) => !(id === 'trend-50-200' && p.fast >= p.slow));
}

/**
 * Walk-forward test: for each test year, pick the grid's best parameters on the `train` years before it (by return over the worst drawdown),
 * then run those parameters, untouched, on the test year. The test years joined together are the honest out-of-sample record. Pure.
 */
export function walkForward(candles, id, opts = {}) {
  const train = opts.trainYears ?? 3, fee = opts.fee ?? 0.008, slippage = opts.slippage ?? 0.001;
  const grid = gridOf(id).map((p) => ({ p, tg: BOTS[id].targets(candles, paramsOf(id, p)) }));
  const y0 = Number(candles[0].d.slice(0, 4)), y1 = Number(candles[candles.length - 1].d.slice(0, 4)), windows = []; let eq = 1;
  for (let y = y0 + train + 1; y <= y1; y++) {
    const tf = (y - train) + '-01-01', tt = (y - 1) + '-12-31', sf = y + '-01-01', st = y + '-12-31';
    let best = null;
    for (const g of grid) {
      const r = backtest(candles, id, g.p, { fee, slippage, from: tf, to: tt, targets: g.tg }); if (!r) continue;
      const score = r.stats.totalReturn / Math.max(r.stats.maxDrawdown, 0.05);
      if (!best || score > best.score) best = { score, p: r.params, tg: g.tg };
    }
    if (!best) continue;
    const t = backtest(candles, id, best.p, { fee, slippage, from: sf, to: st, targets: best.tg }); if (!t) continue;
    eq *= 1 + t.stats.totalReturn;
    windows.push({ trainFrom: tf, trainTo: tt, testFrom: t.from, testTo: t.to, params: best.p, test: t.stats, holdTest: t.hold });
  }
  return { bot: id, trainYears: train, fee, slippage, grid: grid.length, windows, outOfSample: { totalReturn: eq - 1, years: windows.length } };
}
