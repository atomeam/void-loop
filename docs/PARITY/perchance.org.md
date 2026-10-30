# perchance.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: perchance.org (https://perchance.org/)
- Verse: /generators/ (random generators, tower gate 13 of 17)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/perchance.org.md](../HISTORY/perchance.org.md)

**Match: 75%**: 6 have, 0 partial, 0 missing, 2 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many generators (names, places, ideas) | Generators | have | every site of this kind offers it | void-live-deploy/generators/index.html:79 `<h1 id="title">Random generators</h1>` |
| Generate again with one press | Generators | have | every site of this kind offers it | void-live-deploy/generators/index.html:89 `button" class="go" id="regen">Regenerate</button>` |
| Keep favourites | Generators | have | studied by hand: perchance.org offers this (https://perchance.org/) | void-live-deploy/generators/index.html:98 `<h2 id="favH">Kept</h2>` |
| Make your own generator | Making | have | studied by hand: perchance.org offers this (https://perchance.org/) | void-live-deploy/generators/index.html:103 `<summary id="ownH">Make your own generator</summary>` |
| Generators made by other people | Making | have | studied by hand: perchance.org offers this (https://perchance.org/) | void-live-deploy/generators/index.html:111 `<h2 id="hubH">People's generators</h2>` |
| Image generators | Generators | have | studied by hand: perchance.org offers this (https://perchance.org/) | void-live-deploy/generators/index.html:113 `publish your own</a><a href="/image/" id="hubImage" style="font-size:14px;color:inherit;di` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://perchance.org/ | not compared yet |
