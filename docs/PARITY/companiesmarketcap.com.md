# companiesmarketcap.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: companiesmarketcap.com (https://companiesmarketcap.com/)
- Verse: /markets/?mode=caps (finance: companiesmarketcap.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Companies ranked by Market Cap - CompaniesMarketCap.com"
- History: [docs/HISTORY/companiesmarketcap.com.md](../HISTORY/companiesmarketcap.com.md)

**Match: 38%**: 9 have, 1 partial, 2 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | have | its live page (2026-10-28): "iated in any way with CoinMarketCap.com Stock prices are delayed, the delay can range from a few minutes to se" | void-live-deploy/markets/index.html:93 `e="submit" class="go" id="go">Get quote</button><span class="note" id="fnote" role="status` |
| Price charts with ranges | Charts | have | every site of this kind offers it | void-live-deploy/markets/index.html:115 `ta-r="5y" aria-pressed="false">5Y</button><button type="button" data-r="max" aria-pressed=` |
| Indices, currencies and crypto | Markets | have | its live page (2026-10-28): "ll ETFs 🏛️ Bond ETFs ％ Dividend ETFs ₿ Bitcoin ETFs ♢ Ethereum ETFs 🪙 Crypto Currency ETFs 🥇 Gold ETFs & ET" | void-live-deploy/markets/index.html:97 `<div id="strip" aria-label="Indices, crypto and currencies">` |
| Top gainers and losers | Markets | have | every site of this kind offers it | void-live-deploy/markets/index.html:159 `<h2 id="mvH">Top movers</h2>` |
| A watchlist | Personal | have | its live page (2026-10-28): "igence ETFs favorite icon favorite icon Watchlist favorite icon favorite icon Account Largest Companies by Mar" | void-live-deploy/markets/index.html:131 `="watch" aria-pressed="false">Add to watchlist</button>` |
| Market news | News | have | every site of this kind offers it | void-live-deploy/markets/index.html:149 `"repWrap" aria-pressed="true">Market wrap</button><button type="button" id="repWhy" aria-p` |
| Financial statements | Data | have | its live page (2026-10-28): "ulate their market value and know their financials. Next 100❯ What is the market capitalization of a company?" | void-live-deploy/markets/index.html:168 `is down. There are no company financials, news, options or portfolios here, and nothing he` |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "d icon download icon Rank by Market Cap Earnings Revenue Employees P/E ratio Dividend % Market Cap gain Market" | no sign of it in the source of /markets/ |
| Companies ranked by market value | Data | have | its live page (2026-10-28): "Companies ranked by Market Cap - CompaniesMarketCap.com Companies: 11,396 total market cap: $151.685 T Sign I" | void-live-deploy/markets/index.html:106 `="/markets/?mode=caps">Crypto market caps</a><a href="/markets/?mode=screener">Screener</a` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "es: 11,396 total market cap: $151.685 T Sign In 🇺🇸 EN English 🇩🇪 Deutsch 🇫🇷 Français $ USD € EUR 🇪🇺 ₹" | void-live-deploy/markets/index.html:194 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Dark mode | Settings | missing | its live page (2026-10-28): "ZD 🇳🇿 $ HKD 🇭🇰 $ SGD 🇸🇬 change to dark mode change to light mode Toggle navigation Company name, ticker." | no sign of it in the source of /markets/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "be easily calculated by multiplying the share price with the amount of outstanding shares. DISCLAIMER Companie" | void-live-deploy/markets/index.html:132 `tton type="button" id="share">Share link</button>` |
| $151.685 T | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇺🇸 EN English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇩🇪 Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇫🇷 Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| $ USD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| € EUR 🇪🇺 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ₹ INR 🇮🇳 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| £ GBP 🇬🇧 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| $ CAD 🇨🇦 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| $ AUD 🇦🇺 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| $ NZD 🇳🇿 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| $ HKD 🇭🇰 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
