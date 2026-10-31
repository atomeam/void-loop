# Google Flights: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Google Flights (https://www.google.com/travel/flights)
- Verse: /flights/ (travel, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Find Cheap Flights Worldwide &amp; Book Your Ticket - Google Flights"
- History: [docs/HISTORY/google-flights.md](../HISTORY/google-flights.md)

**Match: 46%**: 11 have, 0 partial, 1 missing, 12 unreviewed, of 24 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | its live page (2026-10-28): "Find Cheap Flights Worldwide & Book Your Ticket - Google Flights Google Flights Main menu Go back Close Googl" | void-live-deploy/flights/index.html:63 `<h1>Flights</h1>` |
| Prices from many airlines | Find | have | its live page (2026-10-28): "Find Cheap Flights Worldwide & Book Your Ticket - Google Flights Google Flights Main menu Go back Close Googl" | void-live-deploy/flights/index.html:64 `out on your device. Keep the fares you see, with the lowest and a target, and your trip w` |
| A price calendar and graph | Find | missing | its live page (2026-10-28): "ckets Find the cheapest days to fly The Date grid and Price graph make it easy to find the best flight deals K" | no sign of it in the source of /flights/ |
| Explore destinations on a map | Find | have | its live page (2026-10-28): "to main content Accessibility feedback Explore Flights Hotels Vacation rentals Change appearance Change appea" | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Track prices | Alerts | have | its live page (2026-10-28): "ation rentals Flight Deals Flight Deals Tracked flight prices Tracked flight prices Tracked hotel prices Track" | void-live-deploy/flights/app.js:3 `ontrols","providers","facts","tracker","trip"],"controls":["airports","trip","dates","pax"` |
| Filters: stops, airlines, times | Find | have | its live page (2026-10-28): "Useful tools to help you find the best airline tickets Find the cheapest days to fly The Date grid and Price" | void-live-deploy/lib/flights-ui.js:95 `bel for="pv-al">' + esc(t('An airline’s own site')) + '</label><select id="pv-al"><option` |
| Emissions for each flight | Data | have | studied by hand: Google Flights offers this (https://www.google.com/travel/flights) | void-live-deploy/flights/index.html:64 `ght time, time difference and CO2 worked out on your device. Keep the fares you see, with` |
| Airport details and codes | Data | have | its live page (2026-10-28): "ove Where else? Origin, Select multiple airports Select multiple airports Done Done Press the plus key to swit" | void-live-deploy/flights/index.html:64 `ntro">Plan a flight: pick the airports and dates, open the same search on Google Flights,` |
| Direct routes from an airport | Data | have | its live page (2026-10-28): "o book yet? Observe price changes for a route or flight and get notified when prices drop. Explore the best fl" | void-live-deploy/lib/flights-ui.js:114 `const s = pane('Route facts', 'facts'); s.insertAdjacentHTML('beforeend', '<div id="fa-o` |
| Plan a trip with several stops | Plan | have | its live page (2026-10-28): "lights Flight Change ticket type. Round trip Select your ticket type. Round trip One way Multi-city 1 passenge" | void-live-deploy/flights/index.html:64 `lowest and a target, and your trip with its layovers. Verse has no live fares: the prices` |
| Go on to book | Book | have | its live page (2026-10-28): "Find Cheap Flights Worldwide & Book Your Ticket - Google Flights Google Flights Main menu Go back Close Googl" | void-live-deploy/lib/flights-ui.js:284 `ass="note">' + esc(t('Paste a booking confirmation and the flights are read out of it, or` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "ppearance Change appearance Google apps Sign in Sign in Google Navigation drawer Explore Explore Selected Tab:" | void-live-deploy/lib/flights-ui.js:78 `const sync = () => { for (const i of r.querySelectorAll('input')) i.checked = (i.value` |
| Accessibility feedback | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Done | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cancel | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Reset | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tampa | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chicago | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Dallas | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Atlanta | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Join user studies | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Help Center | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Google Vuelos - Estados Unidos (es) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Google 机票 - 美国 (zh) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
