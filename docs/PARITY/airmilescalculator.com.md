# airmilescalculator.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: airmilescalculator.com (https://www.airmilescalculator.com/)
- Verse: /flights/distance/ (travel: airmilescalculator.com, tower gate 1 of 17)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/airmilescalculator.com.md](../HISTORY/airmilescalculator.com.md)

**Match: 67%**: 2 have, 0 partial, 0 missing, 1 unreviewed, of 3 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | every site of this kind offers it | void-live-deploy/flights/distance/index.html:63 `<h1>Flight distance calculator</h1>` |
| Distance and flight time | Data | have | studied by hand: airmilescalculator.com offers this (https://www.airmilescalculator.com/) | void-live-deploy/flights/distance/index.html:63 `<h1>Flight distance calculator</h1>` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.airmilescalculator.com/ | not compared yet |
