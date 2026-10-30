# heycolor.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: heycolor.com (https://heycolor.com/)
- Verse: /paint/ (paint, tower gate 16 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Hey Color: Paint by Number Art"
- History: [docs/HISTORY/heycolor.com.md](../HISTORY/heycolor.com.md)

**Match: 60%**: 3 have, 0 partial, 1 missing, 1 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Colour palettes | Colour | have | every site of this kind offers it | void-live-deploy/paint/index.html:128 `<h2>Colour palette</h2>` |
| Generate palettes | Colour | missing | every site of this kind offers it | no sign of it in the source of /paint/ |
| Hex, RGB and HSL codes | Colour | have | every site of this kind offers it | void-live-deploy/paint/app.js:15 `const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseI` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Free Available on you favorite platform Google Play App Store 10000+ amazing pics are waiting for you Follow a" | void-live-deploy/visit.js:16 `var w = navigator.serviceWorker; if (w && w.controller) return;` |
| Play Free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
