# marketwatch.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: marketwatch.com (https://www.marketwatch.com/)
- Verse: /markets/ (finance: marketwatch.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "MarketWatch: Stock Market News - Financial News - MarketWatch"
- History: [docs/HISTORY/marketwatch.com.md](../HISTORY/marketwatch.com.md)

**Match: 40%**: 10 have, 1 partial, 2 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "MarketWatch: Stock Market News - Financial News - MarketWatch Skip to main content Explore Our Brands WSJ Bar" | void-live-deploy/markets/index.html:91 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:113 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "Z voters told us the midterms will boil down to affording life, not social issues 1 hour ago The cost of money" | void-live-deploy/markets/index.html:95 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:157 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "ing Personal Finance Retirement Economy Watchlist Toggle account settings menu close profile menu Account Sett" | void-live-deploy/markets/index.html:129 `="watch" aria-pressed="false">Add to watchlist</button>` |
| A portfolio with gains and losses | Personal | have | studied by hand: marketwatch.com offers this (https://www.marketwatch.com/) | void-live-deploy/markets/index.html:166 `financials, news, options or portfolios here, and nothing here trades. Not financial advi` |
| Compare several on one chart | Charts | have | its live page (2026-10-28): "ce of 2026 Car Insurance Rates by State Compare Car Insurance Quotes Best Car Warranty Companies Advertisement" | void-live-deploy/markets/index.html:136 `utton type="button" id="cmpGo">Compare</button><button type="button" id="cmpOff" hidden>St` |
| Market news | News | have | its live page (2026-10-28): "MarketWatch: Stock Market News - Financial News - MarketWatch Skip to main content Explore Our Brands WSJ Bar" | void-live-deploy/markets/index.html:147 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | studied by hand: marketwatch.com offers this (https://www.marketwatch.com/) | void-live-deploy/markets/index.html:166 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "Time Zone) ServiceNow’s stock slides as earnings miss clouds a raised AI outlook 3 minutes ago Caregivers are" | no sign of it in the source of /markets/ |
| Historical prices to download | Data | missing | its live page (2026-10-28): "y FACTSET and subject to terms of use . Historical and current end-of-day data provided by FACTSET . All quote" | no sign of it in the source of /markets/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "enu close profile menu Account Settings Log In Sign Up Open Site Search Site Search Enter a symbol or keyword" | void-live-deploy/markets/index.html:192 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "on LinkedIn Download MarketWatch on the App Store Get MarketWatch on Google Play Footer navigation Marketwatch" | void-live-deploy/markets/index.html:373 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| WSJ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Barron's | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| MarketWatch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IBD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| WSJ / Buy Side | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Investing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Personal Finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Retirement | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Economy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Clear | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Advanced Search | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Markets | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
