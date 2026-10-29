# barchart.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: barchart.com (https://www.barchart.com/)
- Verse: /markets/ (finance: barchart.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 202
- History: [docs/HISTORY/barchart.com.md](../HISTORY/barchart.com.md)

**Match: 70%**: 7 have, 0 partial, 2 missing, 1 unreviewed, of 10 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | every site of this kind offers it | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | every site of this kind offers it | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| A stock screener | Data | have | studied by hand: barchart.com offers this (https://www.barchart.com/) | void-live-deploy/markets/index.html:104 `ket caps</a><a href="/markets/screener/">Screener</a></nav>` |
| Technical indicators and drawing | Charts | missing | studied by hand: barchart.com offers this (https://www.barchart.com/) | no sign of it in the source of /markets/ |
| Earnings and economic calendars | Data | missing | studied by hand: barchart.com offers this (https://www.barchart.com/) | no sign of it in the source of /markets/ |
