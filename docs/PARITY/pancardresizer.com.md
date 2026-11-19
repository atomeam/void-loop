# pancardresizer.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: pancardresizer.com (https://pancardresizer.com/)
- Verse: /photos/?mode=resize (photo resizer, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "PAN Card Resizer - Photo, Signature and document Resizer, Converter and size compressor"
- History: [docs/HISTORY/pancardresizer.com.md](../HISTORY/pancardresizer.com.md)

**Match: 40%**: 2 have, 0 partial, 0 missing, 3 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Crop, rotate, adjust and filters | Editing | have | every site of this kind offers it | void-live-deploy/photos/index.html:74 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ne. Download free on Android. Get it on Google Play PAN Card Editor PAN Card Editor Custom Editor Custom Edito" | void-live-deploy/photos/index.html:136 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| PanCard Resizer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &times; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| pancardresizer.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
