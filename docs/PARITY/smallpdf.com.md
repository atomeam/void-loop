# smallpdf.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: smallpdf.com (https://smallpdf.com/)
- Verse: /pdf/?tool=compress (pdf: smallpdf.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Smallpdf - A Free Solution to all your PDF Problems"
- History: [docs/HISTORY/smallpdf.com.md](../HISTORY/smallpdf.com.md)

**Match: 42%**: 13 have, 0 partial, 6 missing, 12 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | its live page (2026-10-28): "p Smallpdf Tools Tools Compress Convert Merge Edit Sign AI PDF Pricing Teams Log In Free Trial Menu We make PD" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Split a PDF | Organise | have | its live page (2026-10-28): "t it. Things getting chaotic? Merge and split files, or remove excess pages. Smallpdf has it all. View all PDF" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Reorder, rotate and delete pages | Organise | have | its live page (2026-10-28): "rial Get It on Mobile Create PDF scans, organize documents, and share files from all your connected devices wi" | void-live-deploy/pdf/app.js:3 `t","pages","extract","order","rotate","compress","img2pdf","pdf2img","numbers","watermark"` |
| Compress a PDF | Files | have | its live page (2026-10-28): "bile App . Get app Smallpdf Tools Tools Compress Convert Merge Edit Sign AI PDF Pricing Teams Log In Free Tria" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Convert Word, images and more to PDF | Convert | have | its live page (2026-10-28): "iple PDFs into one unified document JPG to PDF Transform JPG, PNG, BMP, GIF, and TIFF images to PDF Sign PDF C" | void-live-deploy/pdf/index.html:60 `><a href="/pdf/?tool=img2pdf">Images to PDF</a><a href="/pdf/?tool=pdf2img">PDF to images<` |
| Convert PDF to Word, Excel or images | Convert | have | its live page (2026-10-28): "the Smallpdf Mobile App . Get app Smallpdf Tools Tools Compress Convert Merge Edit Sign AI PDF Pricing Teams" | void-live-deploy/pdf/index.html:60 `><a href="/pdf/?tool=pdf2img">PDF to images</a><a href="/pdf/?tool=watermark">Watermark</a` |
| Add text, images and shapes | Edit | missing | its live page (2026-10-28): "lpdf Tools Tools Compress Convert Merge Edit Sign AI PDF Pricing Teams Log In Free Trial Menu We make PDF easy" | no sign of it in the source of /pdf/ |
| Sign a PDF | Edit | have | its live page (2026-10-28): "Tools Tools Compress Convert Merge Edit Sign AI PDF Pricing Teams Log In Free Trial Menu We make PDF easy. All" | void-live-deploy/lib/image-handoff.js:56 `: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });` |
| Fill in forms | Edit | missing | its live page (2026-10-28): "to one unified document JPG to PDF Transform JPG, PNG, BMP, GIF, and TIFF images to PDF Sign PDF Create an ele" | no sign of it in the source of /pdf/ |
| Add or remove a password | Security | have | its live page (2026-10-28): ", and TrustPilot. Our Partners Trust Us Unlock bonus features with the Smallpdf Chrome Extension, Google Works" | void-live-deploy/pdf/index.html:63 `sit the page works offline. A password-protected PDF cannot be opened, and text in a PDF c` |
| Watermarks and page numbers | Edit | have | its live page (2026-10-28): "Reader Number Pages Crop PDF Redact PDF Watermark PDF PDF Form Filler Share PDF Fill & Sign Sign PDF Request S" | void-live-deploy/pdf/index.html:60 `images</a><a href="/pdf/?tool=watermark">Watermark</a><a href="/pdf/?tool=numbers">Page nu` |
| Read scanned text (OCR) | Convert | missing | its live page (2026-10-28): "Compress PDF Convert PDF Converter PDF OCR PDF to PDF/A PDF to Image PDF to JPG PDF to PNG Image to PDF JPG t" | no sign of it in the source of /pdf/ |
| Many files at once | Files | have | its live page (2026-10-28): "itable Word documents Merge PDF Combine multiple PDFs into one unified document JPG to PDF Transform JPG, PNG," | void-live-deploy/lib/pdf-ui.js:24 `delete and combine pages from several files, then save.'],` |
| Open from cloud drives | Files | have | its live page (2026-10-28): "Chrome Extension, Google Workspace, and Dropbox App—all free to use. 24/7 Customer Support Get all the help yo" | void-live-deploy/visit.js:20 `thname, r: r, w: navigator.webdriver ? 1 : 0 }));` |
| An account that keeps your things on every device | Accounts | missing | its live page (2026-10-28): "rt Merge Edit Sign AI PDF Pricing Teams Log In Free Trial Menu We make PDF easy. All the tools you’ll need to" | no sign of it in the source of /pdf/ |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Mobile App—wherever you are. Get it on Google Play Download on the App Store Plans & Pricing Get unlimited ac" | void-live-deploy/pdf/index.html:66 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| The site in other languages | Settings | missing | its live page (2026-10-28): "& Conditions Imprint Contact Us English Select Language Bahasa Indonesia Bahasa Malaysia Dansk Deutsch English" | no sign of it in the source of /pdf/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "eate PDF scans, organize documents, and share files from all your connected devices with the Smallpdf Mobile A" | void-live-deploy/lib/pdf-ui.js:45 `ool.'); } catch (_) { prompt('Share link', u); } } }, 'Share link');` |
| A public API | Developers | missing | its live page (2026-10-28): "tistics Product Pricing Teams Embed PDF Developers Sign.com Compare Accessible PDF Apps Download Smallpdf PDF" | no sign of it in the source of /pdf/ |
| Convert | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| AI PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Free Trial | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Pro | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Start Free Trial | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Pro Now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compare Plans | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sales | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Real Estate | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
