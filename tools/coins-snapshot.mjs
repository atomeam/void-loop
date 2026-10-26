#!/usr/bin/env node
// A dated snapshot of the coin tables, committed daily by .github/workflows/coins-snapshot.yml as void-live-deploy/data/coins.json: the top 50 coins by market cap
// (/markets/caps/) and the 30 coins of the screener's universe (/markets/screener/), from CoinGecko's free public API, fetched once from a runner. The pages draw this
// first, labelled as a snapshot of its day and never as live, then replace it with live data when /api/markets answers. A fetch that fails or comes back short leaves
// the file as it was (exit 1, the workflow only warns). Pure part: buildSnapshot. Tests: tools/coins-snapshot.test.mjs.
import fs from 'node:fs';
import { capsRows, COINS } from '../void-live-deploy/lib/markets.js';

const OUT = new URL('../void-live-deploy/data/coins.json', import.meta.url);
const BASE = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=true&price_change_percentage=24h,7d&';
export const SCAN_IDS = Object.values(COINS).map((c) => c[0]);
/** the file's content from the two answers, or null when either is short (fewer than 30 of the top 50, fewer than 20 of the 30). Pure. */
export function buildSnapshot(top, scan, now = Date.now()) {
  const caps = capsRows(top), coins = capsRows(scan);
  if (caps.length < 30 || coins.length < 20) return null;
  return { ok: true, at: new Date(now).toISOString(), day: new Date(now).toISOString().slice(0, 10), source: 'CoinGecko (free public API), fetched by a daily GitHub workflow', caps: caps.slice(0, 50), scan: coins };
}
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Verse (a-to-mind.com)' } }); if (r.ok) return await r.json(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  throw new Error('CoinGecko did not answer: ' + url.slice(0, 80));
}
if (import.meta.url === 'file://' + process.argv[1]) {
  try {
    const top = await get(BASE + 'order=market_cap_desc&per_page=50&page=1'); await new Promise((r) => setTimeout(r, 2500));
    const scan = await get(BASE + 'per_page=50&ids=' + SCAN_IDS.join(','));
    const snap = buildSnapshot(top, scan); if (!snap) throw new Error('the answers were short');
    fs.writeFileSync(OUT, JSON.stringify(snap) + '\n'); console.log('wrote data/coins.json:', snap.caps.length, 'coins,', snap.scan.length, 'in the screener universe,', snap.day);
  } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
}
