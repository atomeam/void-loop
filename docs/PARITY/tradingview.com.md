# tradingview.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tradingview.com (https://www.tradingview.com/)
- Verse: /markets/ (finance: tradingview.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "TradingView — Track All Markets"
- History: [docs/HISTORY/tradingview.com.md](../HISTORY/tradingview.com.md)

**Match: 38%**: 11 have, 0 partial, 5 missing, 13 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "essured by declines in major technology stocks, including Apple and Meta. Meanwhile, a pullback in oil prices" | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | its live page (2026-10-28): "no credit card needed Supercharged Supercharts Explore all features For every level of analysis Market summary" | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "every level of analysis Market summary S&P 500 SPX Major indices Nasdaq 100 NDX Japan 225 NI225 SSE Composite" | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | its live page (2026-10-28): "s, and investors are finally getting a closer look at the financial machinery behind its rapidly growing AI bu" | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "alm that a whole class of institutional portfolios held more equities than their own capital, simply because t" | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | its live page (2026-10-28): "alm that a whole class of institutional portfolios held more equities than their own capital, simply because t" | void-live-deploy/markets/index.html:166 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Compare several on one chart | Charts | have | studied by hand: tradingview.com offers this (https://www.tradingview.com/) | void-live-deploy/markets/index.html:136 `utton type="button" id="cmpGo">Compare</button><button type="button" id="cmpOff" hidden>St` |
| Market news | News | have | its live page (2026-10-28): "s IPO Calendar See all events US stocks news Keep reading Crypto Community trends EVAAUSDT.P EVAA / TetherUS P" | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| A stock screener | Data | have | its live page (2026-10-28): "mpliant More than a product Supercharts Screeners Stocks ETFs Bonds Crypto coins CEX pairs DEX pairs Pine Heat" | void-live-deploy/markets/index.html:104 `ket caps</a><a href="/markets/screener/">Screener</a></nav>` |
| Technical indicators and drawing | Charts | missing | its live page (2026-10-28): "SIRYY US interest rate See all economic indicators Featured IPOs Community ideas Editors&#x27; picks Editors&#" | no sign of it in the source of /markets/ |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "ccelerate the short squeeze SpaceX Epic Earnings - pushing BTC &gt; $83k, MSTR &gt; $145, SPCX &gt; $155 Massi" | no sign of it in the source of /markets/ |
| Price alerts | Personal | missing | its live page (2026-10-28): "; indicator by improving its visual and alerting capabilities. RedK i-Amp hooks to another indicator&#x27;s pl" | no sign of it in the source of /markets/ |
| Historical prices to download | Data | missing | its live page (2026-10-28): "Most technical analysis is built around historical reference points. Traders examine previous highs, previous" | no sign of it in the source of /markets/ |
| Discussion and ideas from other investors | Community | missing | its live page (2026-10-28): "ch Search Search Products Products menu Community Community menu Markets Markets menu Brokers Brokers menu Mor" | no sign of it in the source of /markets/ |
| Companies ranked by market value | Data | have | its live page (2026-10-28): "CAC 40 PX1 See all major indices Crypto market cap TOTAL Bitcoin dominance Bitcoin — Ethereum — Others — Bitco" | void-live-deploy/markets/index.html:104 `href="/markets/caps/">Crypto market caps</a><a href="/markets/screener/">Screener</a></na` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "r longer. This could put pressure on UK shares, particularly property companies and other interest-rate-sensit" | void-live-deploy/markets/index.html:130 `tton type="button" id="share">Share link</button>` |
| US Dollar index DXY | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US 10Y yield US10Y | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US annual inflation rate USIRYY | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Where is the final stop? | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| by KhaldHegazy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| EASYMARKETS:NDQUSD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| by easyMarkets | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IC:XAUUSD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| by Bella40 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| TRADENATION:UK100 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| by Trade Nation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| by CMC Markets | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
