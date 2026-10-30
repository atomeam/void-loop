# Yahoo Finance: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Yahoo Finance (https://finance.yahoo.com/)
- Verse: /markets/ (finance, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP no answer
- History: [docs/HISTORY/yahoo-finance.md](../HISTORY/yahoo-finance.md)

**Match: 63%**: 10 have, 0 partial, 4 missing, 2 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | every site of this kind offers it | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | every site of this kind offers it | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | void-live-deploy/markets/index.html:166 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Compare several on one chart | Charts | have | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | void-live-deploy/markets/index.html:136 `utton type="button" id="cmpGo">Compare</button><button type="button" id="cmpOff" hidden>St` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | void-live-deploy/markets/index.html:166 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| A stock screener | Data | have | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | void-live-deploy/markets/index.html:104 `ket caps</a><a href="/markets/screener/">Screener</a></nav>` |
| Earnings and economic calendars | Data | missing | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | no sign of it in the source of /markets/ |
| Price alerts | Personal | missing | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | no sign of it in the source of /markets/ |
| Historical prices to download | Data | missing | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | no sign of it in the source of /markets/ |
| Discussion and ideas from other investors | Community | missing | studied by hand: Yahoo Finance offers this (https://finance.yahoo.com/) | no sign of it in the source of /markets/ |
| Its live pages could not be read (HTTP no answer), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://finance.yahoo.com/ | not compared yet |
