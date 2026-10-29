# exif.tools: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: exif.tools (https://exif.tools/)
- Verse: /photos/exif/ (photos: exif.tools, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "EXIF &amp; File Metadata Viewer — Photos, PDFs &amp; More / exif.tools"
- History: [docs/HISTORY/exif.tools.md](../HISTORY/exif.tools.md)

**Match: 46%**: 11 have, 0 partial, 1 missing, 12 unreviewed, of 24 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All your photos in one place | Library | have | its live page (2026-10-28): "EXIF & File Metadata Viewer — Photos, PDFs & More / exif.tools Machine-readable site description exif.tools h" | void-live-deploy/photos/exif/index.html:69 `les" role="group" aria-label="Your photos"></div>` |
| Search photos by what is in them | Library | have | its live page (2026-10-28): "r file. Filter metadata tags and values Search tags or values… No file loaded yet. Technical file details & ch" | void-live-deploy/photos/app.js:21 `const lang = (new URLSearchParams(location.search).get('lang') // (navigator.language //` |
| Crop, rotate, adjust and filters | Editing | have | its live page (2026-10-28): "final image is authentic or free of AI edits. Verify Content Credentials externally ↗ Check image authenticit" | void-live-deploy/photos/exif/index.html:71 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Compress and convert images | Files | have | its live page (2026-10-28): "w&quot;,&quot;m0303&quot;:&quot;Preview converter could not start.&quot;,&quot;m0304&quot;:&quot;PDF page 1&qu" | void-live-deploy/photos/exif/index.html:67 `aps" style="min-height:7.5em">Compress and convert JPEG, PNG, WebP and AVIF with a quality` |
| Read, edit and strip photo metadata | Privacy | have | its live page (2026-10-28): "EXIF & File Metadata Viewer — Photos, PDFs & More / exif.tools Machine-readable site description exif.tools h" | void-live-deploy/photos/exif/index.html:71 `essed="false" data-i="t_info">EXIF and privacy</button>` |
| Add text | Editing | have | its live page (2026-10-28): "show headers. Raw JSON data A LITTLE CONTEXT What’s hiding in your file? Metadata is information saved inside" | void-live-deploy/photos/exif/index.html:103 `ion class="panel" id="p-text" aria-label="Text" hidden>` |
| Remove the background | Editing | missing | its live page (2026-10-28): "l, file identification, image recovery, background removal, image tools, and PDF tools with offline-ready brow" | no sign of it in the source of /photos/exif/ |
| Photos on a map | Library | have | its live page (2026-10-28): "e the shot. 02 / LOCATION Put it on the map Find the place behind the photo when GPS details are saved. 03 / F" | void-live-deploy/photos/app.js:40 `y { bmp = await createImageBitmap(file); } catch (_) { bmp = null; }` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "review Open in OpenStreetMap ↗ ORIGIN & SIGNING INFORMATION What the file says about its origin These are reco" | void-live-deploy/photos/app.js:37 `it) { it.hist.push(snap(it)); sync(); }` |
| Works offline | Apps | have | its live page (2026-10-28): "your Home Screen or app launcher, with offline access after the first load.&quot;,&quot;m0288&quot;:&quot;Add" | void-live-deploy/photos/exif/index.html:67 `hing is uploaded and it works offline.</p>` |
| The site in other languages | Settings | have | its live page (2026-10-28): "erseLanguage&quot;:&quot;en&quot;,&quot;hreflang&quot;:&quot;en&quot;,&quot;path&quot;:&quot;/&quot;,&quot;cat" | void-live-deploy/photos/app.js:21 `ation.search).get('lang') // (navigator.language // 'en')).toLowerCase().startsWith('de')` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "hoosing to attach it on another service shares it with that service. THERE’S MORE TO DISCOVER Go beyond the ba" | void-live-deploy/photos/exif/index.html:66 `on" id="share" data-i="share">Share this tool</button></p>` |
| file(1) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bahasa Indonesia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Español | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Português | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italiano | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Nederlands | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Polski | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Türkçe | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tiếng Việt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Čeština | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
