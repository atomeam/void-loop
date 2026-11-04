# getconverter.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: getconverter.org (https://getconverter.org/)
- Verse: /markets/currency-converter/?s=SPX&r=5y&on=2024-12-31 (finance: getconverter.org, tower gate 12 of 15)
- Live scan: not scanned yet
- History: [docs/HISTORY/getconverter.org.md](../HISTORY/getconverter.org.md)

**Match: 75%**: 6 have, 0 partial, 0 missing, 2 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:84 `device, compare two symbols, top movers. No ads, no account.</p>` |
| A watchlist | Personal | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/currency-converter/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Its live pages could not be read, so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://getconverter.org/ | not compared yet |
