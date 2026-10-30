# tools.pdf24.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tools.pdf24.org (https://tools.pdf24.org/en/)
- Verse: /pdf/suite/ (pdf: tools.pdf24.org, tower gate 13 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "PDF24 Tools: Free PDF solutions for all PDF problems"
- History: [docs/HISTORY/tools.pdf24.org.md](../HISTORY/tools.pdf24.org.md)

**Match: 39%**: 11 have, 0 partial, 5 missing, 12 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | its live page (2026-10-28): "r your search. Try a different keyword. Merge PDF files into a single PDF Merge PDF Split PDF files into piece" | void-live-deploy/pdf/suite/index.html:56 `working with the network cut. Merge, split, move and delete pages, rotate, compress, pictu` |
| Split a PDF | Organise | have | its live page (2026-10-28): "e PDF files into a single PDF Merge PDF Split PDF files into pieces which creates new PDF files Split PDF PDF" | void-live-deploy/pdf/suite/index.html:56 `with the network cut. Merge, split, move and delete pages, rotate, compress, pictures to` |
| Reorder, rotate and delete pages | Organise | have | its live page (2026-10-28): "and remove password request Unlock PDF Rotate pages in PDF files Rotate PDF pages Removes pages from PDF file" | void-live-deploy/pdf/suite/index.html:56 `split, move and delete pages, rotate, compress, pictures to PDF and back, number, stamp, c` |
| Compress a PDF | Files | have | its live page (2026-10-28): "ich creates new PDF files Split PDF PDF compressor to reduce the size of PDF files Compress PDF PDF editor to" | void-live-deploy/pdf/suite/index.html:56 `ove and delete pages, rotate, compress, pictures to PDF and back, number, stamp, crop. No` |
| Convert Word, images and more to PDF | Convert | have | its live page (2026-10-28): "F Online PDF Converter to convert files to PDF and PDF to other file formats PDF Converter Create PDFs based o" | void-live-deploy/pdf/suite/index.html:56 `s, rotate, compress, pictures to PDF and back, number, stamp, crop. No account, no upload.` |
| Convert PDF to Word, Excel or images | Convert | have | its live page (2026-10-28): "t mode PDF24 Tools Free and easy to use PDF tools that make you more productive – online and offline Search No" | void-live-deploy/lib/pdf-ui.js:28 `pdf2img: ['PDF to images', 'Save pages as PNG or JPG pictures, in a ZIP.'],` |
| Add text, images and shapes | Edit | missing | its live page (2026-10-28): "the size of PDF files Compress PDF PDF editor to edit PDF files online Edit PDF Sign PDF files Sign PDF Onlin" | no sign of it in the source of /pdf/suite/ |
| Sign a PDF | Edit | missing | its live page (2026-10-28): "ditor to edit PDF files online Edit PDF Sign PDF files Sign PDF Online PDF Converter to convert files to PDF a" | no sign of it in the source of /pdf/suite/ |
| Fill in forms | Edit | missing | its live page (2026-10-28): "vert files to PDF and PDF to other file formats PDF Converter Create PDFs based on JPG and other images Images" | no sign of it in the source of /pdf/suite/ |
| Add or remove a password | Security | have | its live page (2026-10-28): "images in PDF files Extract PDF images Protect PDF files with a password and set permissions Protect PDF Unlo" | void-live-deploy/pdf/suite/index.html:59 `sit the page works offline. A password-protected PDF cannot be opened, and text in a PDF c` |
| Watermarks and page numbers | Edit | have | its live page (2026-10-28): "eate searchable PDF files PDF OCR Add a watermark to PDF files Add watermark Add page numbers to PDF files Add" | void-live-deploy/pdf/suite/app.js:3 `img2pdf","pdf2img","numbers","watermark","crop","info"]});` |
| Read scanned text (OCR) | Convert | missing | its live page (2026-10-28): "file Webpage to PDF Recognize text via OCR and create searchable PDF files PDF OCR Add a watermark to PDF fil" | no sign of it in the source of /pdf/suite/ |
| Files never leave your device | Privacy | have | its live page (2026-10-28): "s online tools work directly in the web browser. You do not need to install any software. This means you can u" | void-live-deploy/pdf/suite/index.html:59 `<footer>Every tool runs on this device with a small open-source library (pdf-lib and pdf` |
| Works offline | Apps | have | its live page (2026-10-28): "t make you more productive – online and offline Search No result was found for your search. Try a different ke" | void-live-deploy/pdf/suite/index.html:55 `<h1>PDF tools that work offline</h1>` |
| Dark mode | Settings | missing | its live page (2026-10-28): "pp download page PDF24 Creator Activate dark mode Activate light mode PDF24 Tools Free and easy to use PDF too" | no sign of it in the source of /pdf/suite/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "gler Developed by Stefan Ziegler Please share PDF24 with friends Share this page on Facebook Share this page o" | void-live-deploy/lib/pdf-ui.js:42 `ool.'); } catch (_) { prompt('Share link', u); } } }, 'Share link');` |
| PDF24 Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDF24 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDF24 Creator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDF Converter | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Extract PDF images | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Remove PDF pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Extract PDF pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Rearrange PDF pages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PDF Overlay | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compare PDFs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Web optimize PDF | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
