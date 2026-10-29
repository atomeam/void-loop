# pancardresizer.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: pancardresizer.com (https://pancardresizer.com/)
- Verse: /resize-image/ (photo resizer, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "PAN Card Resizer - Photo, Signature and document Resizer, Converter and size compressor"
- History: [docs/HISTORY/pancardresizer.com.md](../HISTORY/pancardresizer.com.md)

**Match: 75%**: 6 have, 0 partial, 0 missing, 2 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Resize to exact size | Image | have | its live page (2026-10-28): "PAN Card Resizer - Photo, Signature and document Resizer, Converter and size compressor Loading... PanCard Re" | void-live-deploy/resize-image/index.html:53 `<p class="lead" id="lead">Resize and compress any photo to exact inches, millimetres or` |
| Compress to a file size in KB | Image | have | every site of this kind offers it | void-live-deploy/resize-image/index.html:53 `limetres or pixels, under the KB limit a form sets, on your device.</p>` |
| Crop | Image | have | its live page (2026-10-28): "ebsite and file type. Adjust a photo in crop box to remove unwanted object and adjust brightness and contrast" | void-live-deploy/resize-image/index.html:63 `<option value="fill" selected>Crop to fill the size</option><option value="fit">Keep the w` |
| Presets for forms and documents | Image | have | its live page (2026-10-28): "PAN Card Resizer - Photo, Signature and document Resizer, Converter and size compressor Loading... PanCard Re" | void-live-deploy/resize-image/index.html:52 `<h1>Passport, ID &amp; exam photo sizer</h1>` |
| Signature resize | Image | have | its live page (2026-10-28): "PAN Card Resizer - Photo, Signature and document Resizer, Converter and size compressor Loading... PanCard Re" | void-live-deploy/resize-image/index.html:54 `-size:16px">Choose a photo or signature (JPEG, PNG or WebP)</label><input id="file" type="` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ne. Download free on Android. Get it on Google Play PAN Card Editor PAN Card Editor Custom Editor Custom Edito" | void-live-deploy/resize-image/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Custom Editor | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &times; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
