// node tools/trading-bots-data.mjs [--full]: the daily candles the trading-bot backtests run on (void-live-deploy/trading-bots/data/<PAIR>.json),
// read from Coinbase Exchange's public market data (https://api.exchange.coinbase.com/products/<PAIR>/candles, no key, 300 candles a call),
// closed days only (a day that has not ended at 00:00 UTC is never written). Adds the new days to what is there (--full reads it all again).
// Run by .github/workflows/trading-bots-data.yml once a day, because this repo's own boxes cannot reach the exchange. Nothing is invented:
// a pair that does not answer is left as it was, and the step says so.
import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), dir = path.join(here, '..', 'void-live-deploy', 'trading-bots', 'data');
export const PAIRS = { 'BTC-USD': '2015-07-20', 'ETH-USD': '2016-05-18' };
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Coinbase rows [time, low, high, open, close, volume] to ours [YYYY-MM-DD, open, high, low, close, volume], closed days only. Pure. */
export function rowsOf(cb, now = Date.now()) {
  return cb.filter((r) => Array.isArray(r) && r.length >= 6 && r[0] * 1000 + DAY <= now)
    .map((r) => [iso(r[0] * 1000), r[3], r[2], r[1], r[4], Math.round(r[5] * 1000) / 1000]);
}
/** Old and new rows joined, one per day (the newer read wins), sorted. Pure. */
export function merge(old, add) { const m = new Map(old.map((r) => [r[0], r])); for (const r of add) m.set(r[0], r); return [...m.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)); }

async function pair(p, full) {
  const file = path.join(dir, p + '.json');
  let have = []; try { have = full ? [] : JSON.parse(fs.readFileSync(file, 'utf8')).rows || []; } catch (_) {}
  const now = Date.now(), today = Math.floor(now / DAY) * DAY;
  let from = have.length ? Date.parse(have[have.length - 1][0] + 'T00:00:00Z') - 3 * DAY : Date.parse(PAIRS[p] + 'T00:00:00Z');
  const add = [];
  while (from < today) {
    const to = Math.min(from + 299 * DAY, today);
    const u = `https://api.exchange.coinbase.com/products/${p}/candles?granularity=86400&start=${new Date(from).toISOString()}&end=${new Date(to).toISOString()}`;
    let r, tries = 0;
    for (;;) { r = await fetch(u, { headers: { 'user-agent': 'Verse backtest data (a-to-mind.com)', accept: 'application/json' } }); if (r.ok || ++tries > 3) break; await sleep(1500 * tries); } // void-review: ok: paged HTTP with retry, not a query
    if (!r.ok) throw new Error(p + ': Coinbase answered ' + r.status);
    add.push(...rowsOf(await r.json(), now));
    from = to + DAY; await sleep(350); // under the public limit
  }
  const rows = merge(have, add);
  if (rows.length < 400) throw new Error(p + ': only ' + rows.length + ' days came back');
  const out = { pair: p, source: 'Coinbase Exchange public market data (daily candles, UTC days)', sourceUrl: 'https://api.exchange.coinbase.com/products/' + p + '/candles',
    asOf: rows[rows.length - 1][0], first: rows[0][0], columns: ['day', 'open', 'high', 'low', 'close', 'volume'], rows };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out).replace(/\],\[/g, '],\n['));
  console.log(p + ': ' + rows.length + ' days, ' + out.first + ' to ' + out.asOf + ' (' + add.length + ' read now)');
}

if (import.meta.url === 'file://' + path.resolve(process.argv[1] || '')) {
  const full = process.argv.includes('--full'); let failed = 0;
  for (const p of Object.keys(PAIRS)) { try { await pair(p, full); } catch (e) { failed++; console.log('::warning title=' + p + ' not refreshed::' + e.message); } }
  process.exit(failed === Object.keys(PAIRS).length ? 1 : 0);
}
