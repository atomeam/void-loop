# finviz.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: finviz.com (https://finviz.com/)
- Verse: /markets/screener/?near=100&sort=pct (finance: finviz.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Finviz - Stock Screener"
- History: [docs/HISTORY/finviz.com.md](../HISTORY/finviz.com.md)

**Match: 13%**: 3 have, 1 partial, 11 missing, 13 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | missing | its live page (2026-10-28): "Finviz - Stock Screener Elite members get real-time data, technical charting, alerts, and no ads - starting a" | no sign of it in the source of /markets/screener/ |
| Price charts with ranges | Charts | missing | its live page (2026-10-28): "e members get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try Elite for Fr" | no sign of it in the source of /markets/screener/ |
| Indices, currencies and crypto | Markets | missing | its live page (2026-10-28): "harts News Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicate" | no sign of it in the source of /markets/screener/ |
| Top gainers and losers | Markets | missing | its live page (2026-10-28): "LBI logo U ULBI 15.61 145.44% 2.50M Top Gainers AIOK logo A AIOK 28.14 109.69% 23.91M Top Gainers FTFT logo F" | no sign of it in the source of /markets/screener/ |
| A watchlist | Personal | missing | its live page (2026-10-28): "ews Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Scree" | no sign of it in the source of /markets/screener/ |
| A portfolio with gains and losses | Personal | missing | its live page (2026-10-28): "Insider Futures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Screeners for S" | no sign of it in the source of /markets/screener/ |
| Market news | News | missing | its live page (2026-10-28): "r Screener ETF Screener ETF Maps Charts News Groups Insider Futures Forex Crypto Watchlist Portfolio Calendar" | no sign of it in the source of /markets/screener/ |
| A stock screener | Data | have | its live page (2026-10-28): "Finviz - Stock Screener Elite members get real-time data, technical charting, alerts, and no ads - starting a" | void-live-deploy/markets/screener/index.html:52 `<h1>Screener</h1>` |
| Technical indicators and drawing | Charts | missing | its live page (2026-10-28): "eener Elite members get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try El" | no sign of it in the source of /markets/screener/ |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "utures Forex Crypto Watchlist Portfolio Calendar Pricing Help New Upgrade: Dedicated Screeners for Stocks & ET" | no sign of it in the source of /markets/screener/ |
| Price alerts | Personal | missing | its live page (2026-10-28): "get real-time data, technical charting, alerts, and no ads - starting at $24.96/mo. Try Elite for Free Close S" | no sign of it in the source of /markets/screener/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "mpany or profile Toggle Light/Dark mode Login Sign up free Home Stock Screener Screener ETF Screener ETF Maps" | void-live-deploy/markets/screener/index.html:78 `{ try { const v = JSON.parse(localStorage.getItem(KEY) // '{}'); return Array.isArray(v.l` |
| Dark mode | Settings | missing | its live page (2026-10-28): "ticker, company or profile Toggle Light/Dark mode Login Sign up free Home Stock Screener Screener ETF Screener" | no sign of it in the source of /markets/screener/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "ing Relationship Date Transaction Cost #Shares Value($) LOB Seward Gregory W General Counsel Oct 26 Sale 35.31" | void-live-deploy/markets/screener/index.html:67 `tton type="button" id="share">Share link</button></div>` |
| A public API | Developers | have | its live page (2026-10-28): "filters, ETF insights, seamless exports/API, and an ad-free experience—all in one powerful platform. Start You" | void-live-deploy/markets/screener/index.html:95 `let j; try { j = await (await fetch('/api/markets?scan=1')).json(); if (!j.ok) { await new` |
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
