# tinypng.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tinypng.com (https://tinypng.com/)
- Verse: /photos/tinypng/ (photos: tinypng.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "TinyPNG – Compress WebP, PNG and JPEG images intelligently"
- History: [docs/HISTORY/tinypng.com.md](../HISTORY/tinypng.com.md)

**Match: 39%**: 9 have, 0 partial, 2 missing, 12 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| All your photos in one place | Library | have | its live page (2026-10-28): "HEIC is an image format that compresses photos very efficiently, but it is not widely supported by many other" | void-live-deploy/photos/tinypng/index.html:64 `les" role="group" aria-label="Your photos"></div>` |
| Search photos by what is in them | Library | have | its live page (2026-10-28): "speeds and improve your website&#x27;s search engine ranking . Does TinyPNG support WebP images? Yes, TinyPNG" | void-live-deploy/photos/app.js:21 `const lang = (new URLSearchParams(location.search).get('lang') // (navigator.language //` |
| Group photos by face | Library | missing | its live page (2026-10-28): "nd drop your pictures onto the web interface, and let our intelligent algorithm compress them for optimal resu" | no sign of it in the source of /photos/tinypng/ |
| Crop, rotate, adjust and filters | Editing | have | its live page (2026-10-28): "how it compares to PNG, how to open and edit one, and how to compress SVG files for faster pages. View all blo" | void-live-deploy/photos/tinypng/index.html:66 `essed="false" data-i="t_crop">Crop and rotate</button><button type="button" data-t="adj" a` |
| Compress and convert images | Files | have | its live page (2026-10-28): "TinyPNG – Compress WebP, PNG and JPEG images intelligently Tinify Primary Tools Solutions Integrations Resour" | void-live-deploy/photos/tinypng/index.html:62 `aps" style="min-height:7.5em">Compress and convert JPEG, PNG, WebP and AVIF with a quality` |
| Many images at once | Files | have | its live page (2026-10-28): "WebP or efficiently compress extensive batches to minimize file sizes, all with ease. Buy now Tinify CDN logo" | void-live-deploy/photos/tinypng/index.html:117 `lass="go" hidden data-i="zip">Download all as a zip</button><button type="button" id="stri` |
| Read, edit and strip photo metadata | Privacy | have | its live page (2026-10-28): "olor images. We also remove unnecessary metadata to further reduce file size. The result? Optimized PNG files" | void-live-deploy/photos/tinypng/index.html:66 `essed="false" data-i="t_info">EXIF and privacy</button>` |
| Add text | Editing | have | its live page (2026-10-28): "ntent, considering factors like colors, textures, and patterns. Unlike one-size-fits-all approaches, we unders" | void-live-deploy/photos/tinypng/index.html:98 `ion class="panel" id="p-text" aria-label="Text" hidden>` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "ge base Blog Status page Donate Pricing Login to your Dashboard We will send you a link by mail that will sign" | void-live-deploy/photos/app.js:37 `it) { it.hist.push(snap(it)); sync(); }` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "esses. In this case, we suggest using a shared email address for signup. I have an active Web subscription, bu" | void-live-deploy/photos/tinypng/index.html:61 `on" id="share" data-i="share">Share this tool</button></p>` |
| A public API | Developers | missing | its live page (2026-10-28): "ression More about conversion Solutions Developer API Getting started Developer API: Automate your AVIF, JXL," | no sign of it in the source of /photos/tinypng/ |
| Tinify | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Getting started | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| How it works | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CDN Documentation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Wordpress Plugin Official | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Figma Plugin Official | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Contact support | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Knowledge base | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Send link | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Analyze now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
