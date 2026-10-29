# aruljohn.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: aruljohn.com (https://aruljohn.com/airport-codes/)
- Verse: /flights/airports/ (travel: aruljohn.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Airport Code Lookup IATA ICAO 🛩️ Search for Airport Codes"
- History: [docs/HISTORY/aruljohn.com.md](../HISTORY/aruljohn.com.md)

**Match: 32%**: 6 have, 0 partial, 1 missing, 12 unreviewed, of 19 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | its live page (2026-10-28): "Airport Code Lookup IATA ICAO 🛩️ Search for Airport Codes Arul's Feed &#x1F354; aruljohn.com Home Blog Bible" | void-live-deploy/flights/airports/index.html:64 `4,000 airports with scheduled flights, kept on your device.</p>` |
| Prices from many airlines | Find | have | its live page (2026-10-28): "om Home Blog Bible Coupons &#x26FD; Gas Prices MAC Address lookup IP Address lookup Airport Code Database IATA" | void-live-deploy/flights/airports/index.html:70 `Airports, public domain); the fares and trips you keep stay in this browser, and the page` |
| Explore destinations on a map | Find | have | its live page (2026-10-28): "LNG LNM LNQ LNV LPN LSA LSJ LTF LWI MAG MAP MAS MBV MDM MDU MFO MGG MGP MHY MIS MJJ MKN MLQ MMV MNP MPF MPG MP" | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Filters: stops, airlines, times | Find | have | its live page (2026-10-28): "are three-letter codes commonly used by airlines and travel agents for ticketing and baggage handling. ICAO co" | void-live-deploy/lib/flights-ui.js:95 `bel for="pv-al">' + esc(t('An airline’s own site')) + '</label><select id="pv-al"><option` |
| Airport details and codes | Data | have | its live page (2026-10-28): "Airport Code Lookup IATA ICAO 🛩️ Search for Airport Codes Arul's Feed &#x1F354; aruljohn.com Home Blog Bible" | void-live-deploy/flights/airports/index.html:63 `<h1>Airport codes</h1>` |
| Go on to book | Book | have | its live page (2026-10-28): "aHD UHD Video Links on Einthusan My Facebook Marketplace Account Was Restored After a Year List of Ad Networks" | void-live-deploy/flights/airports/index.html:64 `y, a name or a country: for a booking, a boarding pass or a trip plan. Or type a three-let` |
| A public API | Developers | missing | its live page (2026-10-28): "4;&#127476; ACD ACL ACM ACR ADN ADZ AFI API APO APO ARF ARO ARQ AUC AXM AYA AYC AYG AYI AZT BAC BAQ BGA BHF BO" | no sign of it in the source of /flights/airports/ |
| aruljohn.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bible | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Coupons | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| MAC Address lookup | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IP Address lookup | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| IAD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Baltimore | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Japan | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manila | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| RJ00 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| India | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Heathrow | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
