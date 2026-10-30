# Google Photos: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Google Photos (https://photos.google.com/)
- Verse: /photos/ (photos, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Google Photos: Edit, Organize, Search, and Backup Your Photos"
- History: [docs/HISTORY/google-photos.md](../HISTORY/google-photos.md)

**Match: 35%**: 8 have, 0 partial, 4 missing, 11 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All your photos in one place | Library | have | its live page (2026-10-28): "Google Photos: Edit, Organize, Search, and Backup Your Photos Skip to main content Open nav menu Visit the Go" | void-live-deploy/photos/index.html:67 `les" role="group" aria-label="Your photos"></div>` |
| Back up photos from your phone | Library | missing | its live page (2026-10-28): "gle Photos: Edit, Organize, Search, and Backup Your Photos Skip to main content Open nav menu Visit the Google" | no sign of it in the source of /photos/ |
| Search photos by what is in them | Library | have | its live page (2026-10-28): "Google Photos: Edit, Organize, Search, and Backup Your Photos Skip to main content Open nav menu Visit the Go" | void-live-deploy/photos/app.js:22 `const lang = (new URLSearchParams(location.search).get('lang') // (navigator.language //` |
| Albums and sharing | Library | missing | its live page (2026-10-28): "thin the app. Documents are sorted into albums, like screenshots, receipts, notes, and more. A couple smiling" | no sign of it in the source of /photos/ |
| Memories and highlights | Library | missing | its live page (2026-10-28): "eo Video Play video Get more from every memory Video 15 GB of storage Show footnote 2 2 That’s 3x more than ma" | no sign of it in the source of /photos/ |
| Group photos by face | Library | missing | its live page (2026-10-28): "anguage set to English (United States), Face Groups turned on and location estimates enabled. true Easily sear" | no sign of it in the source of /photos/ |
| Crop, rotate, adjust and filters | Editing | have | its live page (2026-10-28): "Google Photos: Edit, Organize, Search, and Backup Your Photos Skip to main content Open nav menu Visit the Go" | void-live-deploy/photos/index.html:69 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Compress and convert images | Files | have | studied by hand: Google Photos offers this (https://photos.google.com/) | void-live-deploy/photos/index.html:65 `aps" style="min-height:7.5em">Compress and convert JPEG, PNG, WebP and AVIF with a quality` |
| Photos on a map | Library | have | its live page (2026-10-28): "d. true Easily search your memories for places Bengaluru User searching for photos taken in Bengaluru User sea" | void-live-deploy/photos/app.js:41 `y { bmp = await createImageBitmap(file); } catch (_) { bmp = null; }` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ally upload to the app. Download on the App Store Search made simple Search made simple true Easily search you" | void-live-deploy/photos/index.html:131 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| The site in other languages | Settings | have | its live page (2026-10-28): "Google products Privacy Terms Help Help Select language English (India) አማርኛ العربية বাংলা dansk Deutsch Ελλην" | void-live-deploy/photos/app.js:22 `ation.search).get('lang') // (navigator.language // 'en')).toLowerCase().startsWith('de')` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "ction: Organize Organize Go to section: Share Share Go to section: Safety Safety Download the Google Photos ap" | void-live-deploy/photos/index.html:64 `on" id="share" data-i="share">Share this tool</button></p>` |
| Overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get the app | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Create | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Organize | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Safety | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Create now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Go to slide 2 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Go to slide 4 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Shop now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Printing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Google products | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
