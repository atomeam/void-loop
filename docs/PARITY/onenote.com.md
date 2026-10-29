# onenote.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: onenote.com (https://onenote.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: onenote.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Take notes anywhere for free / Microsoft OneNote for the Web"
- History: [docs/HISTORY/onenote.com.md](../HISTORY/onenote.com.md)

**Match: 91%**: 10 have, 0 partial, 1 missing, 0 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "Take notes anywhere for free / Microsoft OneNote for the Web" | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Tables | Editing | have | studied by hand: onenote.com offers this (https://onenote.com/) | void-live-deploy/notes/index.html:187 `iv id="tblbar" role="toolbar" aria-label="Table" data-wal="tbl" hidden><button type="butto` |
| Checklists | Editing | have | studied by hand: onenote.com offers this (https://onenote.com/) | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | studied by hand: onenote.com offers this (https://onenote.com/) | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Search all notes | Organising | have | every site of this kind offers it | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | studied by hand: onenote.com offers this (https://onenote.com/) | void-live-deploy/notes/index.html:155 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Share a note by link | Sharing | have | every site of this kind offers it | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | studied by hand: onenote.com offers this (https://onenote.com/) | no sign of it in the source of /notes/ |
| Clip pages from the web | Files | have | studied by hand: onenote.com offers this (https://onenote.com/) | void-live-deploy/notes/index.html:259 `const pics = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^ima` |
