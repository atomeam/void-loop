# exifeditor.io: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: exifeditor.io (https://exifeditor.io/)
- Verse: /photos/exifeditor/ (photos: exifeditor.io, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Free Online EXIF Viewer &amp; Editor / Edit Photo Metadata Privately"
- History: [docs/HISTORY/exifeditor.io.md](../HISTORY/exifeditor.io.md)

**Match: 57%**: 4 have, 0 partial, 0 missing, 3 unreviewed, of 7 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All your photos in one place | Library | have | its live page (2026-10-28): "Free Online EXIF Viewer & Editor / Edit Photo Metadata Privately Skip to main content Go to EXIFEditor.io home" | void-live-deploy/photos/exifeditor/index.html:64 `les" role="group" aria-label="Your photos"></div>` |
| Crop, rotate, adjust and filters | Editing | have | its live page (2026-10-28): "Free Online EXIF Viewer & Editor / Edit Photo Metadata Privately Skip to main content Go to EXIFEditor.io hom" | void-live-deploy/photos/exifeditor/index.html:66 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Read, edit and strip photo metadata | Privacy | have | its live page (2026-10-28): "Free Online EXIF Viewer & Editor / Edit Photo Metadata Privately Skip to main content Go to EXIFEditor.io hom" | void-live-deploy/photos/exifeditor/index.html:66 `essed="false" data-i="t_info">EXIF and privacy</button>` |
| Photos on a map | Library | have | its live page (2026-10-28): "ings Show/Hide Tiles info Info Row tune Map Slider tag Metadata hub Graph lightbulb Tips Row integration_instr" | void-live-deploy/photos/app.js:43 `y { bmp = await createImageBitmap(file); } catch (_) { bmp = null; }` |
| settings | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Private Details | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Guides | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
