# stockanalysis.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: stockanalysis.com (https://stockanalysis.com/)
- Verse: /markets/ (finance: stockanalysis.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "StockAnalysis.com - Free Online Stock Information for Investors"
- History: [docs/HISTORY/stockanalysis.com.md](../HISTORY/stockanalysis.com.md)

**Match: 42%**: 12 have, 1 partial, 4 missing, 13 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "StockAnalysis.com - Free Online Stock Information for Investors Skip to main content Open Menu Close Menu Hom" | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | its live page (2026-10-28): "e Companies Private Companies Technical Chart Technical Chart Fundamental Chart Fundamental Chart Market Mover" | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "In Help Stock Indexes - After-hours SPY S&P500 -0.13% QQQ Nasdaq 100 -0.45% DIA Dow Jones 0.07% IWM Russell 20" | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | its live page (2026-10-28): "damental Chart Fundamental Chart Market Movers Market Movers Expand Market Movers menu Top Gainers Top Gainers" | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "og In Sign Up Main navigation Home Home Watchlist Watchlist Stocks Stocks Expand Stocks menu Stock Screener St" | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | its live page (2026-10-28): "price targets and forecasts Watchlists, portfolios and custom price alerts Get Started Now NVDA · NVIDIA Corpo" | void-live-deploy/markets/index.html:166 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Compare several on one chart | Charts | have | studied by hand: stockanalysis.com offers this (https://stockanalysis.com/) | void-live-deploy/markets/index.html:136 `utton type="button" id="cmpGo">Compare</button><button type="button" id="cmpOff" hidden>St` |
| Market news | News | have | its live page (2026-10-28): "ckups IPO Statistics IPO Statistics IPO News IPO News IPO Screener IPO Screener ETFs ETFs Expand ETFs menu ETF" | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | its live page (2026-10-28): "ocks and funds. See stock prices, news, financials, forecasts, charts and more. Search for stocks, funds, and" | void-live-deploy/markets/index.html:166 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| A stock screener | Data | have | its live page (2026-10-28): "Stocks Stocks Expand Stocks menu Stock Screener Stock Screener Stock Exchanges Stock Exchanges By Country By" | void-live-deploy/markets/index.html:104 `ket caps</a><a href="/markets/screener/">Screener</a></nav>` |
| Technical indicators and drawing | Charts | missing | its live page (2026-10-28): "ing Private Companies Private Companies Technical Chart Technical Chart Fundamental Chart Fundamental Chart Ma" | no sign of it in the source of /markets/ |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "Country Comparison Tool Comparison Tool Earnings Calendar Earnings Calendar Earnings Calls Earnings Calls New" | no sign of it in the source of /markets/ |
| Price alerts | Personal | missing | its live page (2026-10-28): "Watchlists, portfolios and custom price alerts Get Started Now NVDA · NVIDIA Corporation $182.70 +2.31% Analys" | no sign of it in the source of /markets/ |
| Discussion and ideas from other investors | Community | missing | its live page (2026-10-28): "hange FTNT Fortinet $135.70 -22.05% CYH Community Health Systems $2.20 -17.29% NOW ServiceNow $125.25 -16.57%" | no sign of it in the source of /markets/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Search for stocks, funds, and more Help Log In Sign Up Main navigation Home Home Watchlist Watchlist Stocks St" | void-live-deploy/markets/index.html:192 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "bile Apps Now Available Download on the App Store 4.9 7.3K Get it on Google Play 4.9 8.2K Search for a stock t" | void-live-deploy/markets/index.html:373 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "3 revenue; announces non-voting Class C shares Meta reports $64.6B in Q3 revenue; announces non-voting Class C" | void-live-deploy/markets/index.html:130 `tton type="button" id="share">Share link</button>` |
| By Country | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Comparison Tool | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| By Industry | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Corporate Actions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recent IPOs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IPO Lockups | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IPO Statistics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| New Launches | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ETF Providers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Premarket | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| After Hours | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Market Heatmap | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
