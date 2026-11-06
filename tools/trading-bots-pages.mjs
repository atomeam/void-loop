// node tools/trading-bots-pages.mjs [--check]: writes the /trading-bots/ hub and one page per bot from BOTS in trading-bots/kit/strategy.js,
// so a bot added there gets its page. --check fails when a written page differs from what this would write (tools/trading-bots.test.mjs).
import fs from 'node:fs'; import path from 'node:path';
import { BOTS } from '../void-live-deploy/trading-bots/kit/strategy.js';
const here = path.dirname(new URL(import.meta.url).pathname), dir = path.join(here, '..', 'void-live-deploy', 'trading-bots');
const SITE = 'https://a-to-mind.com';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RISK = `<section class="glass risk" aria-label="Risk"><p><b>Risk:</b> every number here is a backtest on past prices. Past results do not predict future results, these rules have long losing stretches, and you can lose money. This is software you run yourself, not financial advice. Verse never sees your exchange key, never holds your money and never places a trade.</p></section>`;

const SETUP = (id) => `<section class="glass" id="setup"><h2>Run it on your own account</h2>
<ol>
<li>Install Node.js 18 or newer.</li>
<li>Download the bot: <button type="button" id="tb-zip">Download the bot (.zip)</button>${id ? ' (its config already says <code>' + esc(id) + '</code>)' : ''}, or in a terminal:
<pre id="tb-curl">mkdir verse-bot &amp;&amp; cd verse-bot
curl -fsSLO "${SITE}/trading-bots/kit/{bot.mjs,strategy.js,arb-scan.mjs,arb.js,arb.example.json,package.json,config.example.json,README.md,LICENSE}"
npm install &amp;&amp; cp config.example.json config.json</pre><button type="button" id="tb-copy">Copy the commands</button></li>
<li>In <code>config.json</code> set <code>bot</code>${id ? ' (<code>' + esc(id) + '</code>)' : ''}, your <code>exchange</code> (a ccxt id such as <code>kraken</code> or <code>coinbase</code>), the <code>symbol</code> (such as <code>BTC/USD</code>) and <code>budget</code>, the most it may ever spend on one buy.</li>
<li>Paper mode first, no key and no trades: <code>node bot.mjs</code>. It prints the day's decision and keeps a pretend balance.</li>
<li>Live when you are ready: make an exchange API key with <b>trade permission only, never withdrawal</b>, put it in <code>EXCHANGE_API_KEY</code> and <code>EXCHANGE_API_SECRET</code>, set <code>VERSE_BOT_LIVE=yes</code> and run <code>node bot.mjs --live --loop</code> on a computer that stays on.</li>
</ol>
<p class="muted">The files: <a href="/trading-bots/kit/bot.mjs">bot.mjs</a>, <a href="/trading-bots/kit/strategy.js">strategy.js</a> (the same file this page runs), <a href="/trading-bots/kit/arb-scan.mjs">arb-scan.mjs</a> and <a href="/trading-bots/kit/arb.js">arb.js</a> (the read-only arbitrage scanner), <a href="/trading-bots/kit/package.json">package.json</a>, <a href="/trading-bots/kit/config.example.json">config.example.json</a>, <a href="/trading-bots/kit/README.md">README.md</a>, <a href="/trading-bots/kit/LICENSE">LICENSE</a> (MIT). Spot only, long or cash, no leverage; it only sells coins it bought itself.</p></section>`;

const AGENTS = `<section class="glass"><h2>For agents</h2><p class="muted">The same backtest as JSON, any bot, pair, parameters, fee and window, with every trade and the walk-forward test: <code>POST ${SITE}/api/x402/backtest</code>, paid per call in USDC on Base over <a href="https://docs.x402.org">x402</a>. A call without payment answers 402 with what to pay. Catalog: <a href="/api/x402">/api/x402</a>.</p></section>`;

function head({ title, desc, url, name }) {
  const ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebApplication', name, url, description: desc, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'Verse', url: SITE + '/' } }] };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="verse-handoff" content="in: none; out: table, code">
<meta name="theme-color" content="#050505">
<title>${esc(title)} · Verse</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Verse">
<meta property="og:title" content="${esc(title)} · Verse">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/trading-bots/tb.css">
<link rel="modulepreload" href="/trading-bots/kit/strategy.js">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script src="/visit.js" defer></script>
</head>`;
}

export function hubHtml() {
  const desc = 'Trading bots you run on your own exchange account: three daily long-or-cash strategies with real backtests on BTC and ETH since 2015, fees and slippage included, worst drop and a held-out period. Free, MIT, paper mode first.';
  return head({ title: 'Trading bots with real backtests', desc, url: SITE + '/trading-bots/', name: 'Verse trading bots' }) + `
<body>
<main>
<nav class="crumbs"><a href="/">Verse</a> / Trading bots</nav>
<h1>Trading bots with real backtests</h1>
<p class="lead">Three plain daily rules you run on your own exchange account. Each is tested here, in your browser, on real daily prices with a fee and slippage on every trade, next to simply buying and holding. The rules use textbook settings chosen before the test, not fitted to it.</p>
${RISK}
<section class="glass"><h2>The bots</h2><p class="tb-note" id="tb-asof">Reading the price history...</p><div id="tb-cards"></div>
<p class="muted">Change the pair: <a href="?pair=BTC-USD">BTC-USD</a> · <a href="?pair=ETH-USD">ETH-USD</a>. Live quotes for any coin are on <a href="/markets/">Markets</a>. Price gaps between exchanges, after every fee: <a href="/trading-bots/arbitrage/">Arbitrage scanner</a>.</p></section>
${SETUP('')}
${AGENTS}
<footer>Backtests run in this page with <a href="/trading-bots/kit/strategy.js">strategy.js</a> on daily candles read once a day from Coinbase Exchange's public market data (kept as JSON in /trading-bots/data/). Nothing is sent anywhere.</footer>
</main>
<script type="module" src="/lib/trading-bots.js"></script>
</body>
</html>
`;
}

export function botHtml(id) {
  const b = BOTS[id], url = SITE + '/trading-bots/' + id + '/';
  const desc = b.name + ' trading bot: ' + b.idea + ' Real backtest on BTC and ETH daily prices with fees, slippage, worst drop, every trade and a walk-forward test. Free bot you run yourself.';
  return head({ title: b.name + ' trading bot: backtest and setup', desc, url, name: 'Verse ' + b.name + ' bot' }) + `
<body data-bot="${esc(id)}">
<main>
<nav class="crumbs"><a href="/">Verse</a> / <a href="/trading-bots/">Trading bots</a> / ${esc(b.name)}</nav>
<h1>${esc(b.name)}</h1>
<p class="lead">${esc(b.idea)}</p>
<ul>${b.rules.map((r) => '<li>' + esc(r) + '</li>').join('')}<li>Decided on the daily close (00:00 UTC), traded at the next open. Long or cash only.</li></ul>
${RISK}
<section class="glass"><h2>Backtest</h2>
<form class="tb-form" id="tb-form">
<label>Pair <select name="pair"><option>BTC-USD</option><option>ETH-USD</option></select></label>
<label>Fee per trade, % <input name="fee" type="number" min="0" max="5" step="0.01" inputmode="decimal"></label>
<label>Slippage per trade, % <input name="slip" type="number" min="0" max="5" step="0.01" inputmode="decimal"></label>
<label>Period <select name="w"><option value="all">All history</option><option value="held">Last 24 months only</option></select></label>
<button type="submit">Run</button>
</form><p class="tb-err" id="tb-err" role="alert"></p>
<p class="tb-note" id="tb-asof">Reading the price history...</p>
<div id="tb-result" aria-live="polite"></div>
<div class="row"><button type="button" id="tb-csv">Export trades (CSV)</button><button type="button" id="tb-share">Share this backtest</button><span class="muted" id="tb-shared"></span></div>
</section>
<section class="glass"><h2>Walk-forward test</h2><p class="muted">The honest check: each year, the settings that did best over the three years before it (from a small grid) are picked, then run untouched on that year. Those years were never seen when the settings were picked.</p><div class="tb-scroll"><table id="tb-wf"></table></div></section>
<section class="glass"><h2>Every trade</h2><p class="muted" id="tb-trades-note"></p><div class="tb-scroll"><table id="tb-trades"></table></div></section>
${SETUP(id)}
${AGENTS}
<footer>Worked out in this page with <a href="/trading-bots/kit/strategy.js">strategy.js</a>, the same file the bot runs, on daily candles from Coinbase Exchange's public market data. Other bots: ${Object.keys(BOTS).filter((k) => k !== id).map((k) => '<a href="/trading-bots/' + k + '/">' + esc(BOTS[k].name) + '</a>').join(', ')}. Quotes: <a href="/markets/">Markets</a>.</footer>
</main>
<script type="module" src="/lib/trading-bots.js"></script>
</body>
</html>
`;
}

export function arbHtml() {
  const desc = 'Live crypto arbitrage scanner: BTC and ETH price gaps across Coinbase, Kraken, Bitstamp, Gemini and Uniswap on Base, from real order books, with the net dollars after both taker fees and DEX gas. Read only; a free scanner you can run yourself.';
  return head({ title: 'Crypto arbitrage scanner: net of fees', desc, url: SITE + '/trading-bots/arbitrage/', name: 'Verse arbitrage scanner' }) + `
<body data-page="arbitrage">
<main>
<nav class="crumbs"><a href="/">Verse</a> / <a href="/trading-bots/">Trading bots</a> / Arbitrage scanner</nav>
<h1>Arbitrage scanner, net of every fee</h1>
<p class="lead">Buy a coin where it is cheap and sell it where it is dear: this reads each venue's order book right now and works out, for a $1,000 trade, what you would end with after both taker fees and the gas on a Uniswap leg. Most of the time the honest answer is less than you started with.</p>
<section class="glass risk" aria-label="Risk"><p><b>Risk:</b> prices move in milliseconds and faster bots close real gaps first, so a gap shown here is not money in hand. Selling on one venue what you bought on another needs coins and cash already on both, or a transfer that takes time and costs a fee. Verse only reads public prices: it never trades and never holds money or keys.</p></section>
<section class="glass"><h2>Right now</h2>
<form class="tb-form" id="ar-form"><label>Coin <select name="coin"><option>BTC</option><option>ETH</option></select></label><button type="submit">Scan again</button></form>
<p class="tb-note" id="ar-at" aria-live="polite">Reading the order books...</p>
<div id="ar-best"></div>
<div class="tb-scroll"><table id="ar-rows"></table></div>
<p class="muted" id="ar-mids"></p>
<div class="row"><button type="button" id="ar-csv">Export this scan (CSV)</button><button type="button" id="ar-share">Share this scan</button><span class="muted" id="ar-shared"></span></div>
<p class="muted">Taker fees are each venue's entry tier as published (Coinbase 0.60%, Kraken 0.80%, Bitstamp 0.40%, Gemini 1.20%, read 2026-11-06); Uniswap's pool fee is inside its quote and gas is priced from Base's gas price. USDC is counted as one dollar.</p></section>
<section class="glass"><h2>Run it yourself</h2><p class="muted">The same math, on any exchanges ccxt supports, with your own size and fees, from your own computer. Read only: it never places an order.</p>
<pre id="tb-curl">mkdir verse-bot &amp;&amp; cd verse-bot
curl -fsSLO "${SITE}/trading-bots/kit/{bot.mjs,strategy.js,arb-scan.mjs,arb.js,arb.example.json,package.json,config.example.json,README.md,LICENSE}"
npm install &amp;&amp; node arb-scan.mjs --every 30</pre><div class="row"><button type="button" id="tb-copy">Copy the commands</button><button type="button" id="tb-zip">Download the kit (.zip)</button></div></section>
<section class="glass"><h2>For agents</h2><p class="muted">Your own size (up to $250,000), fees, venues and transfer cost, every pair with average fill prices: <code>POST ${SITE}/api/x402/arbitrage</code> with <code>{"coin":"ETH","size":5000}</code>, paid per call in USDC on Base over <a href="https://docs.x402.org">x402</a>. A call without payment answers 402 with what to pay. Free view: <a href="/api/arbitrage?coin=BTC">/api/arbitrage</a>.</p></section>
<footer>Order books from the venues' public market data, read by <a href="/lib/arb-venues.js">lib/arb-venues.js</a>; the math is <a href="/trading-bots/kit/arb.js">arb.js</a>. Backtested trading bots: <a href="/trading-bots/">Trading bots</a>. Quotes: <a href="/markets/">Markets</a>.</footer>
</main>
<script type="module" src="/lib/trading-bots.js"></script>
</body>
</html>
`;
}

export function pages() { return [['index.html', hubHtml()], ['arbitrage/index.html', arbHtml()], ...Object.keys(BOTS).map((id) => [id + '/index.html', botHtml(id)])]; }

if (import.meta.url === 'file://' + path.resolve(process.argv[1] || '')) {
  const check = process.argv.includes('--check'); let bad = 0;
  for (const [rel, html] of pages()) {
    const f = path.join(dir, rel);
    if (check) { let cur = ''; try { cur = fs.readFileSync(f, 'utf8'); } catch (_) {} if (cur !== html) { bad++; console.log('stale: trading-bots/' + rel); } continue; }
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); console.log('wrote trading-bots/' + rel);
  }
  if (bad) { console.log('run: node tools/trading-bots-pages.mjs'); process.exit(1); }
}
