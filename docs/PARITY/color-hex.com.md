# color-hex.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: color-hex.com (https://www.color-hex.com/color/ff5733)
- Verse: /color/?c=ff5733 (colour, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/color-hex.com.md](../HISTORY/color-hex.com.md)

**Match: 80%**: 4 have, 0 partial, 0 missing, 1 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All about a colour: codes and conversions | Colour | have | every site of this kind offers it | void-live-deploy/color/index.html:72 `ia-label="A colour: hex, rgb, hsl or a name" placeholder="#ff5733, rgb(255 87 51), tomato"` |
| Shades, tints and harmonies | Colour | have | every site of this kind offers it | void-live-deploy/color/index.html:70 `<h1>Colour codes, shades and schemes</h1>` |
| A colour picker | Colour | have | every site of this kind offers it | void-live-deploy/color/index.html:72 `" autofocus><input id="wheel" type="color" aria-label="Pick a colour" value="#6d4aff"></di` |
| Palettes | Colour | have | every site of this kind offers it | void-live-deploy/color/index.html:73 `#palh" data-for="brand">Brand palette</a> <a href="?c=00a19a&amp;for=print#modt" data-for=` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.color-hex.com/color/ff5733 | not compared yet |
