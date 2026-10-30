# google.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: google.com (https://www.google.com/finance/)
- Verse: /markets/ (finance: google.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Google Finance - Stock Market Prices, Real-time Quotes &amp; Business News"
- History: [docs/HISTORY/google.com.md](../HISTORY/google.com.md)

**Match: 61%**: 11 have, 1 partial, 3 missing, 4 unreviewed, of 19 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "Google Finance - Stock Market Prices, Real-time Quotes & Business News Google Finance Beta Finance Search for" | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | its live page (2026-10-28): "t Tool Type upload_file Upload File bar_chart Create portfolio Deep Search travel_explore Deep Search Ask AI a" | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "n in Lists Lists Select list arrow_drop_down Select list Select list menu Equity sectors New list playlist_add" | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | its live page (2026-10-28): "ness Show more keyboard_arrow_down Most active NVD GraniteShares 2x Short NVDA Daily ETF $4.01 +2.04% arrow_up" | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "list Expand Lists expand_content Expand Portfolios Create a portfolio add Create a portfolio Collapse portfoli" | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | its live page (2026-10-28): "list Expand Lists expand_content Expand Portfolios Create a portfolio add Create a portfolio Collapse portfoli" | void-live-deploy/markets/index.html:166 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Compare several on one chart | Charts | have | studied by hand: google.com offers this (https://www.google.com/finance/) | void-live-deploy/markets/index.html:136 `utton type="button" id="cmpGo">Compare</button><button type="button" id="cmpOff" hidden>St` |
| Market news | News | have | its live page (2026-10-28): "ket Prices, Real-time Quotes & Business News Google Finance Beta Finance Search for stocks, ETFs, and more sea" | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | its live page (2026-10-28): ".60 1,700.10 1,706.34 1,687.57 — — SIXM Financials SIXM Financials Financials SIXM +0.36% arrow_upward — 691.3" | void-live-deploy/markets/index.html:166 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "indexes lock in gains ahead of big tech earnings Expand keyboard_arrow_down Wall Street equities closed higher" | no sign of it in the source of /markets/ |
| Historical prices to download | Data | missing | its live page (2026-10-28): "spark Dive deeper with AI Bitcoin faces historically weak October as investors pare back exposure Expand keybo" | no sign of it in the source of /markets/ |
| Companies ranked by market value | Data | have | its live page (2026-10-28): "$15.00–$17.00 Est. deal size $150M Est. market cap $796.19M Oct 30 Aspen Neuroscience, Inc ASPE Filing range $" | void-live-deploy/markets/index.html:104 `href="/markets/caps/">Crypto market caps</a><a href="/markets/screener/">Screener</a></na` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Send feedback Send feedback Google apps Sign in Sign in Lists Lists Select list arrow_drop_down Select list Se" | void-live-deploy/markets/index.html:192 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Dark mode | Settings | missing | its live page (2026-10-28): "ngs Settings Theme Theme Device default Dark theme Light theme feedback Send feedback Send feedback Google app" | no sign of it in the source of /markets/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "tificial intelligence and semiconductor shares higher Expand keyboard_arrow_down Chipmaker and tech infrastruc" | void-live-deploy/markets/index.html:130 `tton type="button" id="share">Share link</button>` |
| Financial Markets Wall Street | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Disclaimer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Ask anything | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
