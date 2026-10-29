# companiesmarketcap.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: companiesmarketcap.com (https://companiesmarketcap.com/)
- Verse: /markets/caps/ (finance: companiesmarketcap.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Companies ranked by Market Cap - CompaniesMarketCap.com"
- History: [docs/HISTORY/companiesmarketcap.com.md](../HISTORY/companiesmarketcap.com.md)

**Match: 10%**: 2 have, 1 partial, 9 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| A quote page for any stock | Quotes | missing | its live page (2026-10-28): "iated in any way with CoinMarketCap.com Stock prices are delayed, the delay can range from a few minutes to se" | no sign of it in the source of /markets/caps/ |
| Price charts with ranges | Charts | missing | every site of this kind offers it | no sign of it in the source of /markets/caps/ |
| Indices, currencies and crypto | Markets | missing | its live page (2026-10-28): "ll ETFs 🏛️ Bond ETFs ％ Dividend ETFs ₿ Bitcoin ETFs ♢ Ethereum ETFs 🪙 Crypto Currency ETFs 🥇 Gold ETFs & ET" | no sign of it in the source of /markets/caps/ |
| Top gainers and losers | Markets | missing | every site of this kind offers it | no sign of it in the source of /markets/caps/ |
| A watchlist | Personal | missing | its live page (2026-10-28): "igence ETFs favorite icon favorite icon Watchlist favorite icon favorite icon Account Largest Companies by Mar" | no sign of it in the source of /markets/caps/ |
| Market news | News | missing | every site of this kind offers it | no sign of it in the source of /markets/caps/ |
| Financial statements | Data | missing | its live page (2026-10-28): "ulate their market value and know their financials. Next 100❯ What is the market capitalization of a company?" | no sign of it in the source of /markets/caps/ |
| Earnings and economic calendars | Data | missing | its live page (2026-10-28): "d icon download icon Rank by Market Cap Earnings Revenue Employees P/E ratio Dividend % Market Cap gain Market" | no sign of it in the source of /markets/caps/ |
| Companies ranked by market value | Data | have | its live page (2026-10-28): "Companies ranked by Market Cap - CompaniesMarketCap.com Companies: 11,396 total market cap: $151.685 T Sign I" | void-live-deploy/markets/caps/index.html:50 `<h1>Crypto market caps</h1>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "es: 11,396 total market cap: $151.685 T Sign In 🇺🇸 EN English 🇩🇪 Deutsch 🇫🇷 Français $ USD € EUR 🇪🇺 ₹" | void-live-deploy/markets/caps/index.html:66 `{ try { const v = JSON.parse(localStorage.getItem(KEY) // '{}'); return Array.isArray(v.l` |
| Dark mode | Settings | missing | its live page (2026-10-28): "ZD 🇳🇿 $ HKD 🇭🇰 $ SGD 🇸🇬 change to dark mode change to light mode Toggle navigation Company name, ticker." | no sign of it in the source of /markets/caps/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "be easily calculated by multiplying the share price with the amount of outstanding shares. DISCLAIMER Companie" | void-live-deploy/markets/caps/index.html:56 `tton type="button" id="share">Share link</button></div>` |
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
