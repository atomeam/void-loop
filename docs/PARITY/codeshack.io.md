# codeshack.io: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: codeshack.io (https://codeshack.io/pdf-merge-tool/)
- Verse: /pdf/merge/ (pdf: codeshack.io, tower gate 12 of 16)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/codeshack.io.md](../HISTORY/codeshack.io.md)

**Match: 75%**: 3 have, 0 partial, 0 missing, 1 unreviewed, of 4 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Merge PDFs | Organise | have | every site of this kind offers it | void-live-deploy/pdf/merge/index.html:55 `<h1>Merge PDF files</h1>` |
| Split a PDF | Organise | have | every site of this kind offers it | void-live-deploy/pdf/merge/app.js:3 `, {"tools":["merge"],"also":["split","rotate","extract","order","img2pdf","compress"]});` |
| Reorder, rotate and delete pages | Organise | have | every site of this kind offers it | void-live-deploy/pdf/merge/app.js:3 `s":["merge"],"also":["split","rotate","extract","order","img2pdf","compress"]});` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://codeshack.io/pdf-merge-tool/ | not compared yet |
