# finviz.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: finviz.com (https://finviz.com/)
- Verse: /markets/?mode=screener&near=100&sort=pct (finance: finviz.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Finviz - Stock Screener"
- History: [docs/HISTORY/finviz.com.md](../HISTORY/finviz.com.md)

**Match: 38%**: 10 have, 1 partial, 4 missing, 13 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "Finviz - Stock Screener Elite members get real-time data, technical charting, alerts, and no ads - starting a" | void-live-deploy/markets/index.html:93 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | its live page (2026-10-28): "e members get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try Elite for Fr" | void-live-deploy/markets/index.html:115 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "harts News Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicate" | void-live-deploy/markets/index.html:97 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | its live page (2026-10-28): "LBI logo U ULBI 15.61 145.44% 2.50M Top Gainers AIOK logo A AIOK 28.14 109.69% 23.91M Top Gainers FTFT logo F" | void-live-deploy/markets/index.html:159 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "ews Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Scree" | void-live-deploy/markets/index.html:131 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | its live page (2026-10-28): "Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Screeners for S" | void-live-deploy/markets/index.html:168 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Market news | News | have | its live page (2026-10-28): "r Screener ETF Screener ETF Maps Charts News Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar" | void-live-deploy/markets/index.html:149 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| A stock screener | Data | have | its live page (2026-10-28): "Finviz - Stock Screener Elite members get real-time data, technical charting, alerts, and no ads - starting a" | void-live-deploy/markets/index.html:106 `ps</a><a href="/markets/?mode=screener">Screener</a></nav>` |
| Technical indicators and drawing | Charts | missing | its live page (2026-10-28): "eener Elite members get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try El" | no sign of it in the source of /markets/ |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "utures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Screeners for Stocks & ET" | no sign of it in the source of /markets/ |
| Price alerts | Personal | missing | its live page (2026-10-28): "get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try Elite for Free Close S" | no sign of it in the source of /markets/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "mpany or profile Toggle Light/Dark mode Login Sign up free Home Stock Screener Screener ETF Screener ETF Maps" | void-live-deploy/markets/index.html:194 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Dark mode | Settings | missing | its live page (2026-10-28): "ticker, company or profile Toggle Light/Dark mode Login Sign up free Home Stock Screener Screener ETF Screener" | no sign of it in the source of /markets/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "ing Relationship Date Transaction Cost #Shares Value($) LOB Seward Gregory W General Counsel Oct 26 Sale 35.31" | void-live-deploy/markets/index.html:132 `tton type="button" id="share">Share link</button>` |
| A public API | Developers | have | its live page (2026-10-28): "filters, ETF insights, seamless exports/API, and an ad-free experience—all in one powerful platform. Start You" | void-live-deploy/markets/index.html:205 `l) => { try { const r = await fetch('/api/markets?' + query, { signal }); return await r.j` |
| Sign up free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Maps | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Groups | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Insider | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Futures | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Forex | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ULBI | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| AIOK | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FTFT | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| BOOM | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDC | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
