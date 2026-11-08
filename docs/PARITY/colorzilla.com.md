# colorzilla.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: colorzilla.com (https://www.colorzilla.com/gradient-editor/)
- Verse: /color/gradient/ (gradient, tower gate 13 of 15); /color/gradient/ (colorzilla, tower gate 14 of 17)
- Live scan: 2026-10-28, HTTP 200, page title "ColorZilla - Eyedropper, Color Picker, Gradient Generator and more"
- History: [docs/HISTORY/colorzilla.com.md](../HISTORY/colorzilla.com.md)

**Match: 44%**: 4 have, 0 partial, 0 missing, 5 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All about a colour: codes and conversions | Colour | have | every site of this kind offers it | void-live-deploy/color/gradient/index.html:94 `/ rgba</option><option value="hsl">hsl / hsla</option></select><label><input type="checkbo` |
| Shades, tints and harmonies | Colour | have | every site of this kind offers it | void-live-deploy/lib/colour.js:131 `export function tintsAndShades(rgb, n = 9) {` |
| A colour picker | Colour | have | every site of this kind offers it | void-live-deploy/lib/colour.js:174 `if (/^(?:colou?r\s+(?:picker/codes?/chart/tool/palette\s+generator/schemes?)/hex\s+colou` |
| Palettes | Colour | have | every site of this kind offers it | void-live-deploy/color/gradient/index.html:107 `ort { mountRelated, along, setPalette } from '/lib/toolkit.js';` |
| ColorZilla | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ColorZilla for Firefox and Chrome | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ColorZilla for Chrome and Firefox | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Ultimate Gradient Generator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| iosart labs llc | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
