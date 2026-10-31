# pdfcandy.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: pdfcandy.com (https://www.pdfcandy.com/)
- Verse: /pdf/toolbox/ (pdf: pdfcandy.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "90+ Free PDF Tools Online – PDF Candy"
- History: [docs/HISTORY/pdfcandy.com.md](../HISTORY/pdfcandy.com.md)

**Match: 41%**: 11 have, 0 partial, 4 missing, 12 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | its live page (2026-10-28): "press PDF PDF Summarizer PDF Summarizer Merge PDF Merge PDF PDF Translator PDF Translator Chat with PDF Chat w" | void-live-deploy/pdf/toolbox/index.html:56 `box of PDF tools in one row: merge, split, extract or delete pages, rotate, compress, pic` |
| Split a PDF | Organise | have | its live page (2026-10-28): "Translator Chat with PDF Chat with PDF Split PDF Split PDF Unlock PDF Unlock PDF Protect PDF Protect PDF Rota" | void-live-deploy/pdf/toolbox/index.html:56 `PDF tools in one row: merge, split, extract or delete pages, rotate, compress, pictures t` |
| Reorder, rotate and delete pages | Organise | have | its live page (2026-10-28): "PDF Unlock PDF Protect PDF Protect PDF Rotate PDF Rotate PDF Crop PDF Crop PDF Sign PDF Sign PDF Edit metadat" | void-live-deploy/pdf/toolbox/index.html:56 `lit, extract or delete pages, rotate, compress, pictures to PDF and back, watermark, page` |
| Compress a PDF | Files | have | its live page (2026-10-28): "iles Manage PDF files Edit PDF Edit PDF Compress PDF Compress PDF PDF Summarizer PDF Summarizer Merge PDF Merg" | void-live-deploy/pdf/toolbox/index.html:56 `ract or delete pages, rotate, compress, pictures to PDF and back, watermark, page numbers,` |
| Convert Word, images and more to PDF | Convert | have | its live page (2026-10-28): "ext All PDF Tools All PDF Tools Convert to PDF Convert to PDF Word to PDF Word to PDF JPG to PDF JPG to PDF PD" | void-live-deploy/pdf/toolbox/index.html:56 `s, rotate, compress, pictures to PDF and back, watermark, page numbers, crop and document` |
| Convert PDF to Word, Excel or images | Convert | have | its live page (2026-10-28): "90+ Free PDF Tools Online – PDF Candy Sign in to continue Sign in with Google Sign in with Apple or Sign in u" | void-live-deploy/lib/pdf-ui.js:29 `pdf2img: ['PDF to images', 'Save pages as PNG or JPG pictures, in a ZIP.'],` |
| Add text, images and shapes | Edit | missing | its live page (2026-10-28): "gn Up Manage PDF files Manage PDF files Edit PDF Edit PDF Compress PDF Compress PDF PDF Summarizer PDF Summari" | no sign of it in the source of /pdf/toolbox/ |
| Sign a PDF | Edit | have | its live page (2026-10-28): "90+ Free PDF Tools Online – PDF Candy Sign in to continue Sign in with Google Sign in with Apple or Sign in u" | void-live-deploy/lib/image-handoff.js:56 `: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });` |
| Fill in forms | Edit | missing | its live page (2026-10-28): "le PDF Header and footer Repair PDF PDF Filler Organize pages All PDF Tools Convert to PDF Word to PDF JPG to" | no sign of it in the source of /pdf/toolbox/ |
| Add or remove a password | Security | have | its live page (2026-10-28): "h PDF Chat with PDF Split PDF Split PDF Unlock PDF Unlock PDF Protect PDF Protect PDF Rotate PDF Rotate PDF Cr" | void-live-deploy/pdf/toolbox/index.html:59 `sit the page works offline. A password-protected PDF cannot be opened, and text in a PDF c` |
| Watermarks and page numbers | Edit | have | its live page (2026-10-28): "t pages Extract text Extract images Add page numbers Edit PDF text PDF Viewer Add watermark Add text Add image" | void-live-deploy/pdf/toolbox/index.html:56 `ss, pictures to PDF and back, watermark, page numbers, crop and document info. No limit on` |
| Read scanned text (OCR) | Convert | missing | its live page (2026-10-28): "s Convert from PDF Convert from PDF PDF OCR PDF OCR PDF to Word PDF to Word PDF to JPG PDF to JPG PDF to PNG P" | no sign of it in the source of /pdf/toolbox/ |
| Many files at once | Files | have | studied by hand: pdfcandy.com offers this (https://www.pdfcandy.com/) | void-live-deploy/lib/pdf-ui.js:24 `delete and combine pages from several files, then save.'],` |
| Open from cloud drives | Files | have | studied by hand: pdfcandy.com offers this (https://www.pdfcandy.com/) | void-live-deploy/visit.js:9 `thname, r: r, w: navigator.webdriver ? 1 : 0 }));` |
| An account that keeps your things on every device | Accounts | missing | its live page (2026-10-28): "90+ Free PDF Tools Online – PDF Candy Sign in to continue Sign in with Google Sign in with Apple or Sign in u" | no sign of it in the source of /pdf/toolbox/ |
| Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italiano | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Español | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Português | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Nederlands | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Svenska | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bahasa Indonesia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tiếng việt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Türkçe | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Polski | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDFCandy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
