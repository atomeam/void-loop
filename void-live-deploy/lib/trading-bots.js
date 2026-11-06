// The /trading-bots/ pages: the hub (every bot on one page) and one page per bot (<body data-bot="id">). Everything is worked out in this browser
// from the real daily candles in /trading-bots/data/<PAIR>.json with the same strategy.js the downloadable bot runs. No server, no account.
// Nothing here trades: the bot trades only where its owner runs it. Tests: tools/trading-bots.test.mjs.
import { BOTS, backtest, candlesOf, walkForward, decide } from '../trading-bots/kit/strategy.js';

export const PAIRS = ['BTC-USD', 'ETH-USD'];
export const KIT = ['bot.mjs', 'strategy.js', 'arb-scan.mjs', 'arb.js', 'arb.example.json', 'package.json', 'config.example.json', 'README.md', 'LICENSE'];
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pct = (x, sign = true) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : (sign && x > 0 ? '+' : '') + (x * 100).toFixed(1) + '%');

/** The settings a link carries: pair, fee and slippage in percent, window (all | held). Pure. */
export function settingsOf(search) {
  const q = new URLSearchParams(search || ''), num = (k, d, hi) => { const v = Number(q.get(k)); return q.get(k) !== null && Number.isFinite(v) && v >= 0 && v <= hi ? v : d; };
  return { pair: PAIRS.includes(q.get('pair')) ? q.get('pair') : PAIRS[0], fee: num('fee', 0.8, 5), slip: num('slip', 0.1, 5), w: q.get('w') === 'held' ? 'held' : 'all' };
}
export const linkOf = (s) => '?pair=' + s.pair + '&fee=' + s.fee + '&slip=' + s.slip + '&w=' + s.w;
/** The held-out window: the last 24 months of the data. Pure. */
export const heldFrom = (asOf) => { const d = new Date(asOf + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 24); return d.toISOString().slice(0, 10); };

/** Trades as CSV. Pure. */
export function tradesCsv(r) {
  const rows = [['bought', 'buy_price', 'sold', 'sell_price', 'return_pct']];
  for (const t of [...r.trades, ...(r.open ? [r.open] : [])]) rows.push([t.in, t.inPrice.toFixed(2), t.out || 'still open', t.outPrice ? t.outPrice.toFixed(2) : '', (t.ret * 100).toFixed(2)]);
  return rows.map((r) => r.join(',')).join('\n') + '\n';
}

// ---- a zip of the kit, stored (no compression), so the whole bot downloads as one file ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** files: [{ name, data: Uint8Array }] → the bytes of a zip. Pure. */
export function zipOf(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode('verse-bot/' + f.name), crc = crc32(f.data), n = f.data.length;
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(name.length), ...u16(0)];
    parts.push(new Uint8Array(head), name, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + n;
  }
  const cSize = central.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cSize), ...u32(off), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let i = 0;
  for (const p of all) { out.set(p, i); i += p.length; }
  return out;
}

// ---- drawing ----
/** An SVG of equity (log scale) for the bot and buy-and-hold, and the bot's drawdown under it. Pure (returns markup). */
export function chartSvg(r, candles) {
  const W = 800, H = 240, D = 90, n = r.equity.length; if (n < 2) return '';
  const byDay = new Map(candles.map((c) => [c.d, c.c])), h0 = (1 - r.fee) / (candles.find((c) => c.d === r.from).o * (1 + r.slippage));
  const bot = r.equity.map((e) => e[1]), hold = r.equity.map((e) => h0 * byDay.get(e[0]));
  const lo = Math.log(Math.min(...bot, ...hold)), hi = Math.log(Math.max(...bot, ...hold)), span = hi - lo || 1;
  const x = (i) => ((i / (n - 1)) * W).toFixed(1), y = (v) => (H - 8 - ((Math.log(v) - lo) / span) * (H - 16)).toFixed(1);
  const line = (vs) => vs.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join('');
  let peak = 0; const dd = bot.map((v) => { peak = Math.max(peak, v); return 1 - v / peak; }), mdd = Math.max(...dd, 0.01);
  const area = 'M0 0' + dd.map((v, i) => 'L' + x(i) + ' ' + ((v / mdd) * (D - 6)).toFixed(1)).join('') + 'L' + W + ' 0Z';
  const one = y(1);
  return `<svg class="tb-chart" viewBox="0 0 ${W} ${H + D + 18}" role="img" aria-label="Growth of 1 dollar from ${r.from} to ${r.to}: the bot ends at ${bot[n - 1].toFixed(2)}, buy and hold at ${hold[n - 1].toFixed(2)}; the bot's worst drop was ${pct(r.stats.maxDrawdown, false)}">
<line x1="0" x2="${W}" y1="${one}" y2="${one}" class="tb-base"/><path d="${line(hold)}" class="tb-hold"/><path d="${line(bot)}" class="tb-bot"/>
<text x="4" y="14" class="tb-lab">${esc(r.from)}</text><text x="${W - 4}" y="14" class="tb-lab" text-anchor="end">${esc(r.to)} (log scale)</text>
<g transform="translate(0 ${H + 14})"><path d="${area}" class="tb-dd"/><text x="4" y="${D - 2}" class="tb-lab">drop from the bot's last high, worst ${pct(r.stats.maxDrawdown, false)}</text></g></svg>`;
}

const statRows = (r) => [
  ['Total return', pct(r.stats.totalReturn), pct(r.hold.totalReturn)],
  ['Per year (CAGR)', pct(r.stats.cagr), pct(r.hold.cagr)],
  ['Worst drop (max drawdown)', pct(-r.stats.maxDrawdown), pct(-r.hold.maxDrawdown)],
  ['Trades', String(r.stats.trades), '1'],
  ['Winning trades', r.stats.winRate === null ? 'n/a' : pct(r.stats.winRate, false) + ' of ' + r.stats.closedTrades, ''],
  ['Average trade', pct(r.stats.avgTrade), ''],
  ['Time holding the coin', pct(r.stats.exposure, false), '100%'],
];
export const statsTable = (r) => '<table class="tb-stats"><thead><tr><th></th><th>Bot</th><th>Buy and hold</th></tr></thead><tbody>' +
  statRows(r).map((x) => '<tr><th scope="row">' + x[0] + '</th><td>' + x[1] + '</td><td>' + x[2] + '</td></tr>').join('') + '</tbody></table>';

async function loadPair(pair) {
  const r = await fetch('/trading-bots/data/' + pair + '.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('no data');
  const j = await r.json(); return { ...j, candles: candlesOf(j.rows) };
}
const missing = (el, pair) => { el.innerHTML = '<p data-honest class="tb-note">The ' + esc(pair) + ' price history is not on the site yet: it is read from Coinbase Exchange once a day. Nothing is shown until it is real.</p>'; };

// ---- the hub ----
async function hub() {
  const s = settingsOf(location.search), box = $('#tb-cards');
  let data; try { data = await loadPair(s.pair); } catch (_) { return missing(box, s.pair); }
  const held = heldFrom(data.asOf);
  $('#tb-asof').textContent = data.pair + ' daily candles from ' + data.first + ' to ' + data.asOf + ', from ' + data.source + '. Fee ' + s.fee + '% and slippage ' + s.slip + '% on every buy and sell.';
  box.innerHTML = Object.entries(BOTS).map(([id, b]) => {
    const all = backtest(data.candles, id, {}, { fee: s.fee / 100, slippage: s.slip / 100 }), h = backtest(data.candles, id, {}, { fee: s.fee / 100, slippage: s.slip / 100, from: held });
    return `<article class="tb-card"><h3><a href="/trading-bots/${id}/${linkOf(s)}">${esc(b.name)}</a></h3><p>${esc(b.idea)}</p>
<table class="tb-mini"><thead><tr><th></th><th>Bot</th><th>Hold</th></tr></thead><tbody>
<tr><th scope="row">All ${all.years.toFixed(1)} years</th><td>${pct(all.stats.cagr)}/yr, worst ${pct(-all.stats.maxDrawdown)}</td><td>${pct(all.hold.cagr)}/yr, worst ${pct(-all.hold.maxDrawdown)}</td></tr>
<tr><th scope="row">Last 24 months</th><td>${pct(h.stats.totalReturn)}, worst ${pct(-h.stats.maxDrawdown)}</td><td>${pct(h.hold.totalReturn)}, worst ${pct(-h.hold.maxDrawdown)}</td></tr></tbody></table>
<p><a class="tb-btn" href="/trading-bots/${id}/${linkOf(s)}">Full backtest and setup</a></p></article>`;
  }).join('');
}

// ---- one bot ----
async function botPage(id) {
  const b = BOTS[id], s = settingsOf(location.search), out = $('#tb-result');
  const form = $('#tb-form');
  form.pair.value = s.pair; form.fee.value = s.fee; form.slip.value = s.slip; form.w.value = s.w;
  let data = null, last = null;
  const run = async () => {
    const cur = { pair: form.pair.value, fee: Number(form.fee.value), slip: Number(form.slip.value), w: form.w.value };
    if (!(cur.fee >= 0 && cur.fee <= 5 && cur.slip >= 0 && cur.slip <= 5)) { $('#tb-err').textContent = 'Fee and slippage are percents from 0 to 5.'; return; }
    $('#tb-err').textContent = '';
    history.replaceState(null, '', linkOf(cur));
    if (!data || data.pair !== cur.pair) { try { data = await loadPair(cur.pair); } catch (_) { data = null; last = null; return missing(out, cur.pair); } }
    const from = cur.w === 'held' ? heldFrom(data.asOf) : undefined;
    const r = backtest(data.candles, id, {}, { fee: cur.fee / 100, slippage: cur.slip / 100, from }); last = r;
    const today = decide(data.candles, id, {}, Date.parse(data.asOf + 'T00:00:00Z') + 2 * 86400000);
    const coin = cur.pair.split('-')[0];
    $('#tb-asof').textContent = cur.pair + ' daily candles from ' + data.first + ' to ' + data.asOf + ' (' + data.source + '). Parameters: ' + Object.entries(r.params).map(([k, v]) => k + ' ' + v).join(', ') + ', the textbook defaults, not fitted to this data.';
    out.innerHTML = `<p class="tb-signal">After the close of ${esc(today.day)}, the rule says: <b>${today.target ? 'hold ' + esc(coin) : 'hold cash'}</b>. That is the rule's output on real data, not advice.</p>
<h2>${esc(r.from)} to ${esc(r.to)} (${r.years.toFixed(1)} years)</h2>
<p class="tb-legend"><span class="k-bot">Bot</span> <span class="k-hold">Buy and hold</span>, $1 at the start</p>
${chartSvg(r, data.candles)}${statsTable(r)}`;
    const trades = [...(r.open ? [r.open] : []), ...r.trades.slice().reverse()];
    $('#tb-trades').innerHTML = '<thead><tr><th>Bought</th><th>Price</th><th>Sold</th><th>Price</th><th>Return</th></tr></thead><tbody>' + trades.slice(0, 60).map((t) => // void-review: ok: dates escaped, every other cell a number the backtest computed
      `<tr><td>${esc(t.in)}</td><td>${t.inPrice.toFixed(2)}</td><td>${esc(t.out || 'still holding')}</td><td>${t.outPrice ? t.outPrice.toFixed(2) : ''}</td><td class="${t.ret >= 0 ? 'up' : 'down'}">${pct(t.ret)}</td></tr>`).join('') + '</tbody>';
    $('#tb-trades-note').textContent = trades.length > 60 ? 'The newest 60 of ' + trades.length + ' trades; Export CSV has them all.' : trades.length + ' trades.';
    const wf = walkForward(data.candles, id, { fee: cur.fee / 100, slippage: cur.slip / 100 });
    $('#tb-wf').innerHTML = wf.windows.length ? /* void-review: ok: dates and settings escaped, the rest numbers */ '<thead><tr><th>Test year</th><th>Picked on the 3 years before</th><th>Bot that year</th><th>Hold that year</th></tr></thead><tbody>' +
      wf.windows.map((w) => `<tr><td>${esc(w.testFrom.slice(0, 4))}${w.testTo.slice(5) !== '12-31' ? ' (to ' + esc(w.testTo.slice(5)) + ')' : ''}</td><td>${esc(Object.entries(w.params).map(([k, v]) => k + ' ' + v).join(', '))}</td><td>${pct(w.test.totalReturn)}</td><td>${pct(w.holdTest.totalReturn)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><th scope="row">All test years joined</th><td></td><td>${pct(wf.outOfSample.totalReturn)}</td><td></td></tr></tfoot>` : '<tbody><tr><td>Not enough history for a walk-forward test yet.</td></tr></tbody>';
  };
  form.addEventListener('change', run); form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  $('#tb-csv').addEventListener('click', () => { if (!last) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tradesCsv(last)], { type: 'text/csv' })); a.download = id + '-' + form.pair.value + '-trades.csv'; a.click(); });
  $('#tb-share').addEventListener('click', async () => { const u = location.origin + location.pathname + location.search; try { await navigator.clipboard.writeText(u); $('#tb-shared').textContent = 'Link copied.'; } catch (_) { $('#tb-shared').textContent = u; } });
  await run();
}

// ---- the arbitrage scanner page ----
const money = (x) => (x >= 0 ? '+$' : '-$') + Math.abs(x).toFixed(2);
/** A scan's rows as CSV. Pure. */
export function scanCsv(r) {
  return 'buy,sell,size_usd,buy_avg,sell_avg,top_gap_pct,fees_usd,gas_usd,net_usd,net_pct,filled\n' + r.rows.map((x) => [x.buy, x.sell, x.size, x.buyAvg && x.buyAvg.toFixed(2), x.sellAvg && x.sellAvg.toFixed(2), (x.topGap * 100).toFixed(4), x.fees.toFixed(2), x.gasUsd.toFixed(2), x.net.toFixed(2), (x.netPct * 100).toFixed(4), x.filled].join(',')).join('\n') + '\n';
}
async function arbPage() {
  const form = $('#ar-form'), q = new URLSearchParams(location.search); form.coin.value = q.get('coin') === 'ETH' ? 'ETH' : 'BTC'; let last = null;
  const run = async () => {
    const coin = form.coin.value; history.replaceState(null, '', '?coin=' + coin); $('#ar-at').textContent = 'Reading the order books...';
    let r; try { const res = await fetch('/api/arbitrage?coin=' + coin); r = await res.json(); if (!res.ok) throw new Error(r.error || res.status); } catch (e) { last = null; $('#ar-at').textContent = 'The venues could not be read just now (' + String(e.message || e) + '). Nothing is shown until it is real.'; $('#ar-best').innerHTML = ''; $('#ar-rows').innerHTML = ''; return; }
    last = r; const b = r.rows[0];
    $('#ar-at').textContent = 'Read ' + new Date(r.at).toLocaleTimeString() + ', a $' + r.size + ' trade.' + (r.missing.length ? ' Not read: ' + r.missing.map((m) => m.venue).join(', ') + '.' : '');
    $('#ar-best').innerHTML = b ? '<p class="tb-signal">Best pair now: buy on <b>' + esc(b.buy) + '</b>, sell on <b>' + esc(b.sell) + '</b>: <b>' + money(b.net) + '</b> after every cost (' + pct(b.netPct) + '). ' + (b.net > 0 ? 'Before you act: it may be gone in a second, and you need coins and cash on both sides already.' : 'No pair clears its costs right now.') + '</p>' : '';
    $('#ar-rows').innerHTML = '<thead><tr><th>Buy on</th><th>Sell on</th><th>Gap at the top</th><th>Fees and gas</th><th>Net</th></tr></thead><tbody>' + r.rows.slice(0, 12).map((x) =>
      `<tr><td>${esc(x.buy)}</td><td>${esc(x.sell)}</td><td>${pct(x.topGap)}</td><td>$${(x.fees + x.gasUsd).toFixed(2)}</td><td class="${x.net >= 0 ? 'up' : 'down'}">${money(x.net)}${x.filled ? '' : ' (book too thin)'}</td></tr>`).join('') + '</tbody>';
    $('#ar-mids').textContent = r.spread ? 'Middle prices: ' + Object.entries(r.spread.mids).map(([k, v]) => k + ' $' + v.toFixed(2)).join(', ') + '. Widest gap ' + pct(r.spread.gap, false) + '.' : '';
    seen(coin);
  };
  const seen = async (coin) => { // the record of past scans (lib/arb-history.js): real rows only, and a plain line when there are none yet
    let h; try { const res = await fetch('/api/arbitrage?coin=' + coin + '&history=1'); h = await res.json(); if (!res.ok) throw new Error(h.error || res.status); } catch (e) { $('#ar-hist-at').textContent = 'The record could not be read just now (' + String(e.message || e) + ').'; $('#ar-hist').innerHTML = ''; return; }
    if (!h.scans) { $('#ar-hist-at').textContent = 'No ' + coin + ' scans are on record yet; this one is the first.'; $('#ar-hist').innerHTML = ''; return; }
    const day = (t) => new Date(t).toLocaleString();
    $('#ar-hist-at').textContent = h.scans + ' ' + coin + ' scans from ' + day(h.first) + ' to ' + day(h.last) + ': ' + h.cleared + ' had a pair that cleared every cost (' + pct(h.cleared / h.scans, false) + '). The best pair averaged ' + money(h.avgBestNet) + ' on $1,000.' + (h.best ? ' Best seen: buy on ' + h.best.buy + ', sell on ' + h.best.sell + ', ' + money(h.best.net) + ' at ' + day(h.best.at) + '.' : '');
    $('#ar-hist').innerHTML = '<thead><tr><th>Best pair</th><th>Times best</th><th>Cleared costs</th><th>Best net</th></tr></thead><tbody>' + h.pairs.map((x) =>
      `<tr><td>${esc(x.buy)} to ${esc(x.sell)}</td><td>${Number(x.times)}</td><td>${Number(x.cleared)}</td><td class="${x.best >= 0 ? 'up' : 'down'}">${money(Number(x.best))}</td></tr>`).join('') + '</tbody>';
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); }); form.addEventListener('change', run);
  $('#ar-csv').addEventListener('click', () => { if (!last) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([scanCsv(last)], { type: 'text/csv' })); a.download = 'arbitrage-' + last.coin + '-' + last.at.slice(0, 19).replace(/:/g, '') + '.csv'; a.click(); });
  $('#ar-share').addEventListener('click', async () => { const u = location.origin + location.pathname + '?coin=' + form.coin.value; try { await navigator.clipboard.writeText(u); $('#ar-shared').textContent = 'Link copied.'; } catch (_) { $('#ar-shared').textContent = u; } });
  await run();
}

async function kitButtons() {
  const z = $('#tb-zip'); if (z) z.addEventListener('click', async () => {
    z.disabled = true; z.textContent = 'Packing...';
    try {
      const files = await Promise.all(KIT.map(async (name) => { const r = await fetch('/trading-bots/kit/' + name); if (!r.ok) throw new Error(name); return { name, data: new Uint8Array(await r.arrayBuffer()) }; }));
      const cfg = files.find((f) => f.name === 'config.example.json'), bot = document.body.dataset.bot;
      if (bot && cfg) files.push({ name: 'config.json', data: new TextEncoder().encode(new TextDecoder().decode(cfg.data).replace('"trend-50-200"', JSON.stringify(bot))) });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zipOf(files)], { type: 'application/zip' })); a.download = 'verse-bot.zip'; a.click();
      z.textContent = 'Download the bot (.zip)';
    } catch (e) { z.textContent = 'Could not pack ' + e.message + '; use the file links'; }
    z.disabled = false;
  });
  const c = $('#tb-copy'); if (c) c.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#tb-curl').textContent); c.textContent = 'Copied'; } catch (_) { c.textContent = 'Select and copy'; } });
}

if (typeof document !== 'undefined' && document.body) {
  const id = document.body.dataset.bot;
  (document.body.dataset.page === 'arbitrage' ? arbPage() : id && BOTS[id] ? botPage(id) : hub()).catch((e) => console.error(e));
  kitButtons();
}
