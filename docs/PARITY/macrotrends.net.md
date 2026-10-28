# macrotrends.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: macrotrends.net (https://www.macrotrends.net/)
- Verse: /markets/ (finance: macrotrends.net, tower gate 12 of 12, gate passed)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/macrotrends.net.md](../HISTORY/macrotrends.net.md)

**Match: 70%**: 7 have, 0 partial, 1 missing, 2 unreviewed, of 10 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | every site of this kind offers it | void-live-deploy/markets/index.html:89 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:111 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:93 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:155 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | every site of this kind offers it | void-live-deploy/markets/index.html:127 `="watch" aria-pressed="false">Add to watchlist</button>` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/index.html:145 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | studied by hand: macrotrends.net offers this (https://www.macrotrends.net/) | void-live-deploy/markets/index.html:164 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| Historical prices to download | Data | missing | studied by hand: macrotrends.net offers this (https://www.macrotrends.net/) | no sign of it in the source of /markets/ |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.macrotrends.net/ | not compared yet |
