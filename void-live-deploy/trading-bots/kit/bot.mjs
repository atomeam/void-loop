#!/usr/bin/env node
// Verse trading bot: runs one of the strategies in strategy.js on YOUR exchange account, from YOUR computer, with YOUR API key.
// Verse never sees your key, never holds your money and never places a trade: this program does, only where you run it.
//
//   node bot.mjs                 paper mode (the default): reads public prices, says what it would do, keeps a pretend balance. No key needed.
//   node bot.mjs --live          real orders. Needs VERSE_BOT_LIVE=yes and your key in EXCHANGE_API_KEY / EXCHANGE_API_SECRET.
//   node bot.mjs --loop          stays running and decides once a day, a few minutes after the daily candle closes (00:00 UTC).
//   node bot.mjs --config my.json
//
// Safety built in: spot only, long or cash, no leverage, no shorting, no withdrawals. It never spends more than `budget` (in the quote
// currency, e.g. USD) and it only ever sells the coins IT bought (kept in its state file), never coins you already held.
// MIT licence. Past results do not predict future results; you can lose money. Read README.md before --live.
import fs from 'node:fs';
import path from 'node:path';
import { BOTS, candlesOf, decide, paramsOf } from './strategy.js';

const DAY = 86400000;
const log = (...a) => console.log(new Date().toISOString(), ...a);

export function readConfig(file) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!BOTS[c.bot]) throw new Error('config.bot must be one of: ' + Object.keys(BOTS).join(', '));
  if (!c.exchange || !c.symbol) throw new Error('config needs exchange (a ccxt id such as kraken or coinbase) and symbol (such as BTC/USD)');
  if (!(Number(c.budget) > 0)) throw new Error('config.budget must be a number above 0: the most the bot may ever spend, in the quote currency');
  for (const k of ['apiKey', 'secret', 'password', 'privateKey']) if (k in c) throw new Error('do not put ' + k + ' in the config file; set EXCHANGE_API_KEY / EXCHANGE_API_SECRET / EXCHANGE_API_PASSWORD in the environment');
  return { stateFile: 'state.json', paperFile: 'paper.json', minOrderQuote: 10, ...c, budget: Number(c.budget), params: paramsOf(c.bot, c.params || {}) };
}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };
const writeJson = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };

/** Daily candles from the exchange, as strategy.js wants them. */
export async function dailyCandles(ex, symbol, need) {
  const since = Date.now() - (need + 5) * DAY;
  const rows = await ex.fetchOHLCV(symbol, '1d', since, need + 5);
  return candlesOf(rows.map((r) => [new Date(r[0]).toISOString().slice(0, 10), r[1], r[2], r[3], r[4], r[5]]));
}

/** One decision, and in live mode the one order it needs. Returns what happened. `ex` is a ccxt exchange (or anything with the same calls). */
export async function runOnce(ex, cfg, { live = false, now = Date.now() } = {}) {
  const b = BOTS[cfg.bot], need = b.warmup(cfg.params) + 30;
  const candles = await dailyCandles(ex, cfg.symbol, need);
  const d = decide(candles, cfg.bot, cfg.params, now);
  const [base, quote] = cfg.symbol.split('/');
  const price = candles.filter((x) => x.t + DAY <= now).at(-1).c;
  const stateFile = live ? cfg.stateFile : cfg.paperFile;
  const st = readJson(stateFile, live ? { holding: false, baseAmount: 0, spent: 0, history: [] } : { holding: false, baseAmount: 0, cash: cfg.budget, history: [] });
  const out = { mode: live ? 'live' : 'paper', bot: cfg.bot, symbol: cfg.symbol, day: d.day, target: d.target, holding: st.holding, action: 'none', price };

  if (d.target === 1 && !st.holding) {
    if (!live) { st.baseAmount = (st.cash * (1 - 0.008)) / price; st.cash = 0; st.holding = true; out.action = 'buy (paper)'; }
    else {
      await ex.loadMarkets();
      const bal = await ex.fetchBalance(), freeQuote = Number((bal.free || {})[quote] || 0), spend = Math.min(cfg.budget, freeQuote);
      if (spend < cfg.minOrderQuote) { out.action = 'skip: only ' + freeQuote + ' ' + quote + ' free, less than minOrderQuote'; }
      else {
        const t = await ex.fetchTicker(cfg.symbol), ask = Number(t.ask || t.last), amount = Number(ex.amountToPrecision(cfg.symbol, (spend * 0.99) / ask));
        const before = Number((bal.total || {})[base] || 0);
        const order = await ex.createOrder(cfg.symbol, 'market', 'buy', amount);
        await new Promise((r) => setTimeout(r, 3000));
        const after = Number(((await ex.fetchBalance()).total || {})[base] || 0);
        st.baseAmount = Math.max(0, after - before); st.spent = spend; st.holding = st.baseAmount > 0; // only what this order added is the bot's
        out.action = 'buy'; out.order = order && order.id; out.amount = st.baseAmount;
      }
    }
  } else if (d.target === 0 && st.holding) {
    if (!live) { st.cash = st.baseAmount * price * (1 - 0.008); st.baseAmount = 0; st.holding = false; out.action = 'sell (paper)'; }
    else {
      await ex.loadMarkets();
      const bal = await ex.fetchBalance(), freeBase = Number((bal.free || {})[base] || 0);
      const amount = Number(ex.amountToPrecision(cfg.symbol, Math.min(st.baseAmount, freeBase)));
      if (!(amount > 0)) { out.action = 'skip: none of the bot\'s ' + base + ' is free to sell'; }
      else { const order = await ex.createOrder(cfg.symbol, 'market', 'sell', amount); st.baseAmount = 0; st.holding = false; out.action = 'sell'; out.order = order && order.id; out.amount = amount; }
    }
  }
  if (!live) out.paperValue = st.cash + st.baseAmount * price;
  st.history = [...(st.history || []), { at: new Date(now).toISOString(), day: d.day, target: d.target, action: out.action }].slice(-400);
  writeJson(stateFile, st);
  return out;
}

async function main(argv) {
  const has = (k) => argv.includes(k), at = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const cfg = readConfig(path.resolve(at('--config') || 'config.json'));
  const live = has('--live');
  if (live && process.env.VERSE_BOT_LIVE !== 'yes') throw new Error('--live places real orders. Set VERSE_BOT_LIVE=yes to confirm you mean it.');
  if (live && !(process.env.EXCHANGE_API_KEY && process.env.EXCHANGE_API_SECRET)) throw new Error('--live needs EXCHANGE_API_KEY and EXCHANGE_API_SECRET in the environment (trade permission only; never withdrawal)');
  const ccxt = (await import('ccxt')).default;
  if (!ccxt[cfg.exchange]) throw new Error('ccxt has no exchange called ' + cfg.exchange);
  const ex = new ccxt[cfg.exchange]({ enableRateLimit: true, ...(live ? { apiKey: process.env.EXCHANGE_API_KEY, secret: process.env.EXCHANGE_API_SECRET, password: process.env.EXCHANGE_API_PASSWORD || undefined } : {}) });
  const once = async () => { try { log(JSON.stringify(await runOnce(ex, cfg, { live }))); } catch (e) { log('error:', e && e.message || e); } };
  log((live ? 'LIVE' : 'paper') + ' mode: ' + BOTS[cfg.bot].name + ' on ' + cfg.symbol + ' at ' + cfg.exchange + ', budget ' + cfg.budget);
  await once();
  if (!has('--loop')) return;
  for (;;) { // the next 00:05 UTC, after the daily candle has closed
    const n = Date.now(), next = Math.floor(n / DAY) * DAY + DAY + 5 * 60000;
    await new Promise((r) => setTimeout(r, next - n)); await once();
  }
}

if (import.meta.url === 'file://' + path.resolve(process.argv[1] || '')) main(process.argv.slice(2)).catch((e) => { console.error('stopped:', e.message); process.exit(1); });
