# sejda.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: sejda.com (https://www.sejda.com/)
- Verse: /pdf/?tool=pages (pdf: sejda.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Sejda helps with your PDF tasks"
- History: [docs/HISTORY/sejda.com.md](../HISTORY/sejda.com.md)

**Match: 44%**: 14 have, 0 partial, 6 missing, 12 unreviewed, of 32 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | its live page (2026-10-28): "jda All Tools Compress Edit Fill & Sign Merge Delete Pages Crop Pricing Desktop Log in Account Logout Select l" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Split a PDF | Organise | have | its live page (2026-10-28): "Organize Arrange and reorder PDF pages Split Extract Pages Get a new document containing only the desired pag" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Reorder, rotate and delete pages | Organise | have | its live page (2026-10-28): "mbine multiple PDFs and images into one Organize Arrange and reorder PDF pages Split Extract Pages Get a new d" | void-live-deploy/pdf/app.js:3 `t","pages","extract","order","rotate","compress","img2pdf","pdf2img","numbers","watermark"` |
| Compress a PDF | Files | have | its live page (2026-10-28): "com logo Sejda.com logo Sejda All Tools Compress Edit Fill & Sign Merge Delete Pages Crop Pricing Desktop Log" | void-live-deploy/pdf/index.html:56 `<h1>PDF tools: merge, split, compress and edit pages</h1>` |
| Convert Word, images and more to PDF | Convert | have | its live page (2026-10-28): "Annotate PDF Fill & Sign Add signature to PDF. Fill out PDF forms Create Forms Free PDF forms creator. Make e" | void-live-deploy/pdf/index.html:60 `><a href="/pdf/?tool=img2pdf">Images to PDF</a><a href="/pdf/?tool=pdf2img">PDF to images<` |
| Convert PDF to Word, Excel or images | Convert | have | its live page (2026-10-28): "int & scan in one step Convert from PDF PDF to Excel Convert PDF to Excel or CSV online for free. Extract tabl" | void-live-deploy/pdf/index.html:60 `><a href="/pdf/?tool=pdf2img">PDF to images</a><a href="/pdf/?tool=watermark">Watermark</a` |
| Add text, images and shapes | Edit | missing | its live page (2026-10-28): "Sejda.com logo Sejda All Tools Compress Edit Fill & Sign Merge Delete Pages Crop Pricing Desktop Log in Accoun" | no sign of it in the source of /pdf/ |
| Sign a PDF | Edit | have | its live page (2026-10-28): "go Sejda All Tools Compress Edit Fill & Sign Merge Delete Pages Crop Pricing Desktop Log in Account Logout Sel" | void-live-deploy/lib/image-handoff.js:56 `: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });` |
| Fill in forms | Edit | missing | its live page (2026-10-28): ".com logo Sejda All Tools Compress Edit Fill & Sign Merge Delete Pages Crop Pricing Desktop Log in Account Log" | no sign of it in the source of /pdf/ |
| Add or remove a password | Security | have | its live page (2026-10-28): "ss Reduce the size of your PDF Security Protect Protect file with password and permissions Unlock Remove restr" | void-live-deploy/pdf/index.html:63 `sit the page works offline. A password-protected PDF cannot be opened, and text in a PDF c` |
| Watermarks and page numbers | Edit | have | its live page (2026-10-28): "estrictions and password from PDF files Watermark Add image or text watermark to PDF documents Flatten Makes f" | void-live-deploy/pdf/index.html:60 `images</a><a href="/pdf/?tool=watermark">Watermark</a><a href="/pdf/?tool=numbers">Page nu` |
| Read scanned text (OCR) | Convert | missing | its live page (2026-10-28): "straighten and deskew scanned PDF pages OCR Convert PDF scans to searchable text and PDFs. Extract text from s" | no sign of it in the source of /pdf/ |
| Files never leave your device | Privacy | have | its live page (2026-10-28): "e couldn't connect to GoogleDrive. Your browser (or add-ons) might be blocking the load of javascript files fr" | void-live-deploy/pdf/index.html:57 `n this one page, and the file never leaves this device.</p>` |
| Many files at once | Files | have | its live page (2026-10-28): "alternating between them Merge Combine multiple PDFs and images into one Organize Arrange and reorder PDF pag" | void-live-deploy/lib/pdf-ui.js:24 `delete and combine pages from several files, then save.'],` |
| Open from cloud drives | Files | have | its live page (2026-10-28): "r purchase We couldn't connect to GoogleDrive. Your browser (or add-ons) might be blocking the load of javascr" | void-live-deploy/visit.js:20 `thname, r: r, w: navigator.webdriver ? 1 : 0 }));` |
| An account that keeps your things on every device | Accounts | missing | its live page (2026-10-28): "Merge Delete Pages Crop Pricing Desktop Log in Account Logout Select language Close × Recent Merge Alternate &" | no sign of it in the source of /pdf/ |
| Works offline | Apps | have | its live page (2026-10-28): "eviews Works the way you work Online or offline — in the cloud or as a desktop application Sejda Web Works in" | void-live-deploy/pdf/index.html:63 `fter one visit the page works offline. A password-protected PDF cannot be opened, and text` |
| The site in other languages | Settings | missing | its live page (2026-10-28): "p Pricing Desktop Log in Account Logout Select language Close × Recent Merge Alternate & Mix Mixes pages from" | no sign of it in the source of /pdf/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "nfidential. Attach a screenshot* Please share a screenshot of the problem, as you see it. Choose screenshot im" | void-live-deploy/lib/pdf-ui.js:45 `ool.'); } catch (_) { prompt('Share link', u); } } }, 'Share link');` |
| A public API | Developers | missing | its live page (2026-10-28): "G Suite Sejda for Education About Blog API HTML to PDF API Developer Docs Legal Terms of Use Privacy Policy C" | no sign of it in the source of /pdf/ |
| All Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Delete Pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Desktop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Suggest a missing feature | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| hi@sejda.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| https://www.sejda.com/account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| https://www.sejda.com/upgrade | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| https://www.sejda.com/desktop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| This does not answer my question | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
