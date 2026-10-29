# gcmap.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: gcmap.com (https://www.gcmap.com/)
- Verse: /flights/map/ (travel: gcmap.com, tower gate 1 of 16)
- Live scan: 2026-10-28, HTTP no answer
- History: [docs/HISTORY/gcmap.com.md](../HISTORY/gcmap.com.md)

**Match: 75%**: 3 have, 0 partial, 0 missing, 1 unreviewed, of 4 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | every site of this kind offers it | void-live-deploy/flights/map/index.html:67 `">Common asks</span><a href="/flights/map/?route=JFK-LHR-SIN">New York, London, Singapore<` |
| Explore destinations on a map | Find | have | studied by hand: gcmap.com offers this (https://www.gcmap.com/) | void-live-deploy/flights/map/index.html:63 `<h1>Great circle map</h1>` |
| Distance and flight time | Data | have | studied by hand: gcmap.com offers this (https://www.gcmap.com/) | void-live-deploy/flights/map/index.html:64 `f every leg on a map with the distance of each leg and the total. Kept on your device: not` |
| Its live pages could not be read (HTTP no answer), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.gcmap.com/ | not compared yet |
