# flightconnections.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: flightconnections.com (https://www.flightconnections.com/)
- Verse: /flights/routes/ (travel: flightconnections.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 202
- History: [docs/HISTORY/flightconnections.com.md](../HISTORY/flightconnections.com.md)

**Match: 100%**: 5 have, 0 partial, 0 missing, 0 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | every site of this kind offers it | void-live-deploy/flights/routes/index.html:64 `"intro">Pick an airport and a flight time and see which airports a flight of that length c` |
| Explore destinations on a map | Find | have | studied by hand: flightconnections.com offers this (https://www.flightconnections.com/) | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Filters: stops, airlines, times | Find | have | studied by hand: flightconnections.com offers this (https://www.flightconnections.com/) | void-live-deploy/flights/routes/index.html:64 `, not a timetable: whether an airline flies a route nonstop is shown by the providers. Eac` |
| Airport details and codes | Data | have | studied by hand: flightconnections.com offers this (https://www.flightconnections.com/) | void-live-deploy/flights/routes/index.html:64 `<p class="intro">Pick an airport and a flight time and see which airports a flight of th` |
| Direct routes from an airport | Data | have | studied by hand: flightconnections.com offers this (https://www.flightconnections.com/) | void-live-deploy/flights/routes/index.html:64 `e: whether an airline flies a route nonstop is shown by the providers. Each result opens t` |
