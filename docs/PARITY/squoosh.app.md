# squoosh.app: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: squoosh.app (https://squoosh.app/)
- Verse: /photos/squoosh/ (photos: squoosh.app, tower gate 11 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Squoosh"
- History: [docs/HISTORY/squoosh.app.md](../HISTORY/squoosh.app.md)

**Match: 60%**: 3 have, 0 partial, 0 missing, 2 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All your photos in one place | Library | have | its live page (2026-10-28): "rop OR Paste Or try one of these: Large photo 2.8MB Artwork 2.9MB Device screen 1.6MB SVG icon 13KB Small Smal" | void-live-deploy/photos/squoosh/index.html:64 `les" role="group" aria-label="Your photos"></div>` |
| Crop, rotate, adjust and filters | Editing | have | every site of this kind offers it | void-live-deploy/photos/squoosh/index.html:66 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Many images at once | Files | have | its live page (2026-10-28): "ettings for even smaller files. grid of multiple shrunk images displaying various options Secure Worried about" | void-live-deploy/photos/squoosh/index.html:117 `lass="go" hidden data-i="zip">Download all as a zip</button><button type="button" id="stri` |
| Source on Github | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| reload | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
