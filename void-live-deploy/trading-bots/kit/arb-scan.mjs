#!/usr/bin/env node
// Verse arbitrage scanner, run on your own computer: reads the order books of the exchanges you list (public data through ccxt, no key needed)
// and prints every buy-here-sell-there pair for your size, after both taker fees and your transfer cost (arb.js does the math, the same file
// Verse's page and paid scan use). It only reads and prints: it never places an order. MIT licence.
//
//   node arb-scan.mjs                         one scan with arb.example.json's settings (or arb.json if you made one)
//   node arb-scan.mjs --config arb.json --every 30    scan every 30 seconds
//
// Prices move in milliseconds and faster bots close real gaps first; a gap here is not money in hand. Past or current gaps do not predict future ones.
import fs from 'node:fs';
import path from 'node:path';
import { cleanBook, scan, spread } from './arb.js';

export function readArbConfig(file) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!c.symbol || !Array.isArray(c.exchanges) || c.exchanges.length < 2) throw new Error('config needs symbol (such as BTC/USD) and at least two exchanges (ccxt ids)');
  return { size: 1000, transferUsd: 0, fees: {}, ...c };
}

/** One scan over ccxt exchanges (or anything with fetchOrderBook). Exchanges that fail are listed in missing. */
export async function scanOnce(exchanges, cfg) {
  const venues = {}, missing = [];
  await Promise.all(Object.entries(exchanges).map(async ([id, ex]) => {
    try {
      const b = cleanBook(await ex.fetchOrderBook(cfg.symbol, 100));
      const fee = Number.isFinite(cfg.fees[id]) ? cfg.fees[id] : (ex.markets && ex.markets[cfg.symbol] && ex.markets[cfg.symbol].taker) || 0.01;
      if (b.asks.length && b.bids.length) venues[id] = { ...b, fee };
    } catch (e) { missing.push(id + ': ' + String(e.message || e).slice(0, 80)); }
  }));
  return { at: new Date().toISOString(), spread: spread(venues), rows: scan(venues, cfg), missing };
}

const money = (x) => (x >= 0 ? '+' : '-') + '$' + Math.abs(x).toFixed(2);
export function print(r, cfg) {
  console.log(r.at + '  ' + cfg.symbol + '  size $' + cfg.size + (cfg.transferUsd ? '  transfer $' + cfg.transferUsd : '') + (r.spread ? '  widest mid gap ' + (r.spread.gap * 100).toFixed(3) + '% (' + r.spread.low + ' to ' + r.spread.high + ')' : ''));
  for (const x of r.rows.slice(0, 8)) console.log('  buy ' + x.buy.padEnd(10) + ' sell ' + x.sell.padEnd(10) + ' net ' + money(x.net).padStart(10) + ' (' + (x.netPct * 100).toFixed(3) + '%)' + (x.filled ? '' : '  book too thin'));
  if (r.missing.length) console.log('  not read: ' + r.missing.join('; '));
}

async function main(argv) {
  const at = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const file = at('--config') || (fs.existsSync('arb.json') ? 'arb.json' : 'arb.example.json');
  const cfg = readArbConfig(path.resolve(file)), every = Number(at('--every')) || 0;
  const ccxt = (await import('ccxt')).default, exchanges = {};
  for (const id of cfg.exchanges) { if (!ccxt[id]) throw new Error('ccxt has no exchange called ' + id); exchanges[id] = new ccxt[id]({ enableRateLimit: true }); }
  await Promise.all(Object.values(exchanges).map((e) => e.loadMarkets().catch(() => null)));
  for (;;) { try { print(await scanOnce(exchanges, cfg), cfg); } catch (e) { console.log('error: ' + e.message); } if (!every) return; await new Promise((r) => setTimeout(r, Math.max(5, every) * 1000)); }
}

if (import.meta.url === 'file://' + path.resolve(process.argv[1] || '')) main(process.argv.slice(2)).catch((e) => { console.error('stopped:', e.message); process.exit(1); });
