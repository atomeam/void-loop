# ilovepdf.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: ilovepdf.com (https://www.ilovepdf.com/)
- Verse: /pdf/ (pdf, tower gate 12 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "iLovePDF / Online PDF tools for PDF lovers"
- History: [docs/HISTORY/ilovepdf.com.md](../HISTORY/ilovepdf.com.md)

**Match: 43%**: 13 have, 0 partial, 5 missing, 12 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | its live page (2026-10-28): "lovers iLovePDF iLovePDF All PDF tools Merge PDF Split PDF Compress PDF Convert PDF Convert to PDF JPG to PDF" | void-live-deploy/pdf/index.html:56 `<p class="intro">Merge, split, reorder, rotate and delete pages, compress, turn pictures` |
| Split a PDF | Organise | have | its live page (2026-10-28): "ovePDF iLovePDF All PDF tools Merge PDF Split PDF Compress PDF Convert PDF Convert to PDF JPG to PDF WORD to P" | void-live-deploy/pdf/index.html:56 `<p class="intro">Merge, split, reorder, rotate and delete pages, compress, turn pictures` |
| Reorder, rotate and delete pages | Organise | have | its live page (2026-10-28): "PDF to EXCEL PDF to PDF/A All PDF tools Organize PDF Merge PDF Split PDF Remove pages Extract pages Organize P" | void-live-deploy/pdf/index.html:56 `intro">Merge, split, reorder, rotate and delete pages, compress, turn pictures into a PDF` |
| Compress a PDF | Files | have | its live page (2026-10-28): "vePDF All PDF tools Merge PDF Split PDF Compress PDF Convert PDF Convert to PDF JPG to PDF WORD to PDF POWERPO" | void-live-deploy/pdf/index.html:56 `der, rotate and delete pages, compress, turn pictures into a PDF and pages into pictures,` |
| Convert Word, images and more to PDF | Convert | have | its live page (2026-10-28): "it PDF Compress PDF Convert PDF Convert to PDF JPG to PDF WORD to PDF POWERPOINT to PDF EXCEL to PDF HTML to P" | void-live-deploy/pdf/index.html:59 `><a href="/pdf/?tool=img2pdf">Images to PDF</a><a href="/pdf/?tool=pdf2img">PDF to images<` |
| Convert PDF to Word, Excel or images | Convert | have | its live page (2026-10-28): "iLovePDF / Online PDF tools for PDF lovers iLovePDF iLovePDF All PDF tools Merge PDF Split PDF Compress PDF C" | void-live-deploy/pdf/index.html:59 `><a href="/pdf/?tool=pdf2img">PDF to images</a><a href="/pdf/?tool=pages">Reorder pages</a` |
| Add text, images and shapes | Edit | missing | its live page (2026-10-28): "to POWERPOINT PDF to EXCEL PDF to PDF/A Edit PDF Rotate PDF Add page numbers Add watermark Crop PDF Edit PDF P" | no sign of it in the source of /pdf/ |
| Sign a PDF | Edit | have | its live page (2026-10-28): "rms PDF security Unlock PDF Protect PDF Sign PDF Redact PDF Compare PDF PDF Intelligence AI Summarizer Transla" | void-live-deploy/lib/image-handoff.js:56 `: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });` |
| Fill in forms | Edit | missing | its live page (2026-10-28): "ers Add watermark Crop PDF Edit PDF PDF Forms PDF security Unlock PDF Protect PDF Sign PDF Redact PDF Compare" | no sign of it in the source of /pdf/ |
| Add or remove a password | Security | have | its live page (2026-10-28): "rop PDF Edit PDF PDF Forms PDF security Unlock PDF Protect PDF Sign PDF Redact PDF Compare PDF PDF Intelligenc" | void-live-deploy/pdf/index.html:62 `sit the page works offline. A password-protected PDF cannot be opened, and text in a PDF c` |
| Watermarks and page numbers | Edit | have | its live page (2026-10-28): "EL PDF to PDF/A Edit PDF Rotate PDF Add page numbers Add watermark Crop PDF Edit PDF PDF Forms PDF security Un" | void-live-deploy/pdf/app.js:3 `img2pdf","pdf2img","numbers","watermark","crop","info"]});` |
| Read scanned text (OCR) | Convert | missing | its live page (2026-10-28): "DF Optimize PDF Compress PDF Repair PDF OCR PDF Convert to PDF JPG to PDF WORD to PDF POWERPOINT to PDF EXCEL" | no sign of it in the source of /pdf/ |
| Files never leave your device | Privacy | have | its live page (2026-10-28): "device and send them instantly to your browser. OCR PDF OCR PDF Easily convert scanned PDF into searchable an" | void-live-deploy/pdf/index.html:56 `d crop a PDF. Everything runs on this device: your files are never uploaded, there is no a` |
| Many files at once | Files | have | its live page (2026-10-28): "way you need them. You can even rotate multiple PDFs at once! HTML to PDF HTML to PDF Convert webpages in HTM" | void-live-deploy/lib/pdf-ui.js:24 `delete and combine pages from several files, then save.'],` |
| An account that keeps your things on every device | Accounts | missing | its live page (2026-10-28): "ummarizer Translate PDF PDF to Markdown Login Sign up Other products iLoveIMG iLoveIMG Effortless image editin" | no sign of it in the source of /pdf/ |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Company About us Contact us Blog Press Google Play Google Play App Store App Store Mac Store Mac Store Micros" | void-live-deploy/pdf/index.html:65 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Works offline | Apps | have | its live page (2026-10-28): "flow 1 of 6 1 x free Work your way Work offline with Desktop Work offline with Desktop Batch edit and manage d" | void-live-deploy/pdf/index.html:56 `o account, and the tools work offline after one visit.</p>` |
| A public API | Developers | missing | its live page (2026-10-28): "oveAPI iLoveAPI Document automation for developers Integrations Integrations Zapier, Make, Wordpress... Soluti" | no sign of it in the source of /pdf/ |
| iLovePDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Remove pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Extract pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Repair PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crop PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Redact PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compare PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| AI Summarizer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Translate PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Security | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
