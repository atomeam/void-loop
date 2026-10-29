# notepad.pw: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: notepad.pw (https://notepad.pw/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: notepad.pw, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "notepad.pw / ma2nwnyd / The napkin of the internet."
- History: [docs/HISTORY/notepad.pw.md](../HISTORY/notepad.pw.md)

**Match: 35%**: 7 have, 0 partial, 1 missing, 12 unreviewed, of 20 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "notepad.pw / ma2nwnyd / The napkin of the internet. Click here for Google Search Click here to close type her" | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Tables | Editing | have | its live page (2026-10-28): "own View with line numbers Code Copy Editable Link Editable Link Copy Share Link Share Link Words: / Chars: 0" | void-live-deploy/notes/index.html:187 `iv id="tblbar" role="toolbar" aria-label="Table" data-wal="tbl" hidden><button type="butto` |
| Links, and links between notes | Editing | have | its live page (2026-10-28): "ew with line numbers Code Copy Editable Link Editable Link Copy Share Link Share Link Words: / Chars: 0 Privac" | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | its live page (2026-10-28): "of the internet. Click here for Google Search Click here to close type here & press enter Remove Ads New Note" | void-live-deploy/notes/index.html:168 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | its live page (2026-10-28): "of the internet. Click here for Google Search Click here to close type here & press enter Remove Ads New Note" | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Share a note by link | Sharing | have | its live page (2026-10-28): "e Copy Editable Link Editable Link Copy Share Link Share Link Words: / Chars: 0 Privacy Terms Contact Us About" | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| End-to-end encryption | Safety | missing | studied by hand: notepad.pw offers this (https://notepad.pw/) | no sign of it in the source of /notes/ |
| Remove Ads | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Password Options | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Change URL | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Account Panel | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| SP Spell Check | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| MO Monospace Font | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Light Switch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Save | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Change | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Remove | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Raw | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
