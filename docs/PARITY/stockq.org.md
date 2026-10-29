# stockq.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: stockq.org (https://www.stockq.org/)
- Verse: /markets/ (finance: stockq.org, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "StockQ 國際股市指數"
- History: [docs/HISTORY/stockq.org.md](../HISTORY/stockq.org.md)

**Match: 30%**: 6 have, 0 partial, 1 missing, 13 unreviewed, of 20 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "StockQ 國際股市指數 StockQ 首頁 StockQ 主要導覽 全球股市指數 首頁 市場動態 市場動態 歷史股價 歷史股價 基金淨值 基金淨值 基金分類 基金分類 全球經濟數據 經濟數據 股市走勢比較 股市比較" | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "28 美洲股市指數行情 股市 指數 漲跌 比例 當地 道瓊工業 % 10/28 S&P 500 % 10/28 NASDAQ % 10/28 NASDAQ 100 % 10/28 NYSE尖牙 % 15:54 費城半導體" | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | every site of this kind offers it | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Technical indicators and drawing | Charts | missing | studied by hand: stockq.org offers this (https://www.stockq.org/) | no sign of it in the source of /markets/ |
| ETF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CCC債券指數 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ICE高收益債券指數 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ICE高收益100債券 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ICE美國高收益債券 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ICE歐洲高收益債券 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ICE全球高收益債券 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| JP新興政府債券指數 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 上海A股 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 上海B股 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 深圳A股 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 深圳B股 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
