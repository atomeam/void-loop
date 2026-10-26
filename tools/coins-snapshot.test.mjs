// The coin snapshot's shape (tools/coins-snapshot.mjs) and how the two coin pages read it: built from CoinGecko-shaped rows (fixtures, no network), refused when short,
// and the pages draw it labelled as a snapshot, never as live.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildSnapshot, SCAN_IDS } from './coins-snapshot.mjs';
import { scanRows } from '../void-live-deploy/lib/markets.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, symbol: 'c' + i, name: 'Coin ' + i, current_price: 100 - i, market_cap: 1e9 - i, market_cap_rank: i + 1, total_volume: 1e7, price_change_percentage_24h_in_currency: 1, price_change_percentage_7d_in_currency: 2, ath_change_percentage: -5, sparkline_in_7d: { price: Array.from({ length: 168 }, (_, k) => 10 + (k % 7)) } }));
test('the snapshot: dated, sourced, the top 50 and the screener coins; short answers are refused', () => {
  const s = buildSnapshot(rows(50), rows(30), Date.UTC(2026, 9, 26, 5, 41)); assert.equal(s.ok, true); assert.equal(s.day, '2026-10-26'); assert.match(s.source, /CoinGecko/); assert.equal(s.caps.length, 50); assert.equal(s.scan.length, 30); assert.equal(s.caps[0].rank, 1); assert.ok(s.caps[0].spark.length <= 40);
  assert.equal(buildSnapshot(rows(10), rows(30)), null, 'the top list came back short'); assert.equal(buildSnapshot(rows(50), rows(5)), null, 'the screener list came back short'); assert.equal(buildSnapshot([], []), null);
  assert.ok(JSON.stringify(s).length < 120000, 'small: ' + JSON.stringify(s).length); assert.equal(SCAN_IDS.length, 30);
  assert.equal(scanRows([], s.scan).length, 30, 'the screener reads its coin rows from the snapshot');
});
test('the committed file is a valid snapshot or the honest placeholder; the pages read it, say it is a snapshot, and never call it live', () => {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'data', 'coins.json'), 'utf8')); assert.ok(j.ok === false || (j.ok && j.caps.length >= 30 && /^\d{4}-\d{2}-\d{2}$/.test(j.day)));
  for (const pg of ['caps', 'screener']) { const h = fs.readFileSync(path.join(root, 'markets', pg, 'index.html'), 'utf8'); assert.match(h, /\/data\/coins\.json/, pg); assert.match(h, /[Ss]napshot of/, pg + ' labels it'); assert.match(h, /not live/, pg + ' says plainly that the snapshot is not live'); assert.match(h, /id="share">Share link</, pg + ' has a visible share control'); assert.match(h, /og:image" content="https:\/\/a-to-mind\.com\/og\/markets\.png/, pg); }
  const sc = fs.readFileSync(path.join(root, 'markets', 'screener', 'index.html'), 'utf8'); assert.match(sc, /!all\.some\(\(r\) => r\.group === 'coins'\)/, 'a live answer without coins keeps the snapshot coins');
  const wf = fs.readFileSync(path.join(root, '..', '.github', 'workflows', 'coins-snapshot.yml'), 'utf8'); assert.match(wf, /cron:/); assert.match(wf, /workflow_dispatch/); assert.match(wf, /contents: write/); assert.doesNotMatch(wf, /secrets\./);
});
