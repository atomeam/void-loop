# clock7.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: clock7.com (https://www.clock7.com/flight-calculator/)
- Verse: /flights/time/ (travel: clock7.com, tower gate 15 of 17)
- Live scan: 2026-10-28, HTTP 200, page title "Flight Duration Calculator &ndash; Flight Time Between Any Two Cities / Clock7"
- History: [docs/HISTORY/clock7.com.md](../HISTORY/clock7.com.md)

**Match: 35%**: 7 have, 0 partial, 1 missing, 12 unreviewed, of 20 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | its live page (2026-10-28): "Flight Duration Calculator &ndash; Flight Time Between Any Two Cities / Clock7 &#9992; Clock7 Flight Duration" | void-live-deploy/flights/time/index.html:63 `<h1>Flight time calculator</h1>` |
| A price calendar and graph | Find | missing | its live page (2026-10-28): "can arrive at 9 AM LA time on the same calendar day &mdash; it appears to arrive before it left. You didn&rsq" | no sign of it in the source of /flights/time/ |
| Explore destinations on a map | Find | have | its live page (2026-10-28): "routes which often look curved on flat maps but are actually the most direct path. The calculator uses this t" | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Track prices | Alerts | have | its live page (2026-10-28): "0; Timezone aware &#128197; Date change alert &#128203; Share link &#128747; Departure city / airport e.g. Dub" | void-live-deploy/lib/flights-ui.js:241 `PANELS.tracker = () => {` |
| Distance and flight time | Data | have | its live page (2026-10-28): "Flight Duration Calculator &ndash; Flight Time Between Any Two Cities / Clock7 &#9992; Clock7 Flight Duration" | void-live-deploy/flights/time/index.html:66 `with</span> <a href="/flights/distance/">Flight distance calculator</a> <a href="/time/">T` |
| Airport details and codes | Data | have | its live page (2026-10-28): "r you cross the date line. &#9992; 300+ airports &#9200; Accurate flight time &#127760; Timezone aware &#12819" | void-live-deploy/flights/time/index.html:64 `d out on your device from the airports’ positions and time zones.</p>` |
| Direct routes from an airport | Data | have | its live page (2026-10-28): "um Economy Business First Class Popular routes: DXB &#8594; LHR JFK &#8594; LHR LHR &#8594; DXB DXB &#8594; KH" | void-live-deploy/flights/time/index.html:64 `me difference and whether the route crosses the date line. Add a stop and the wait to see` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "e &#128197; Date change alert &#128203; Share link &#128747; Departure city / airport e.g. Dubai, London, New" | void-live-deploy/lib/flights-ui.js:283 `utton" id="i-link">' + esc(t('Copy a link to this trip')) + '</button> <button type="butto` |
| DXB &#8594; LHR | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| JFK &#8594; LHR | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| LHR &#8594; DXB | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| DXB &#8594; KHI | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| DXB &#8594; SIN | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| LHR &#8594; JFK | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| JFK &#8594; LAX | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| DXB &#8594; SYD | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| SIN &#8594; TYO | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CDG &#8594; JFK | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| LHR &#8594; SIN | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| KHI &#8594; LHR | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
