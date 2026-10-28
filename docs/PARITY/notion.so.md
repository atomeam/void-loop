# notion.so: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: notion.so (https://notion.so/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: notion.so, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "The AI workspace that works for you. / Notion"
- History: [docs/HISTORY/notion.so.md](../HISTORY/notion.so.md)

**Match: 51%**: 17 have, 1 partial, 4 missing, 12 unreviewed, of 34 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Tables | Editing | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:187 `iv id="tblbar" role="toolbar" aria-label="Table" data-wal="tbl" hidden><button type="butto` |
| Checklists | Editing | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | its live page (2026-10-28): "ore more → English (US) Change Language Search languages Languages English (US) Bahasa Indonesia Dansk Deutsch" | void-live-deploy/notes/index.html:168 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | its live page (2026-10-28): "ore more → English (US) Change Language Search languages Languages English (US) Bahasa Indonesia Dansk Deutsch" | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | its live page (2026-10-28): "Notion is an important competitive advantage for us to stay small while doing a lot. Michael Truell Co-founder" | void-live-deploy/notes/index.html:155 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Templates | Organising | have | its live page (2026-10-28): "at&#x27;s New Customer stories Webinars Templates Consultants Learn Academy Product tours Help Center Pricing" | void-live-deploy/notes/index.html:116 `elect id="tplSel" aria-label="Start from a template" data-wal="tpl"><option value="">Start` |
| Version history and restore | Safety | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:112 `g, search across all of them, version history. Nothing goes to a server; it works offline.` |
| Trash and restore | Safety | have | its live page (2026-10-28): "over What&#x27;s New Customer stories Webinars Templates Consultants Learn Academy Product tours Help Center P" | void-live-deploy/notes/index.html:169 `ontrols="trash" data-w="trash">Trash</button>` |
| Share a note by link | Sharing | have | every site of this kind offers it | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | its live page (2026-10-28): "Get Notion free Toggle main menu Where teams and agents Think together. Capture context, find answers, and au" | no sign of it in the source of /notes/ |
| Comments and suggestions on the text | Sharing | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:149 `"button" id="cmB" aria-label="Comment on the selected words" title="Comment on the selecte` |
| Export (Word, PDF, Markdown, text) | Files | have | its live page (2026-10-28): "ng 24/7 with agents. . See what’s new → Download the Notion App → Resources Notion for Enterprise Small busine" | void-live-deploy/notes/index.html:164 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| Import files | Files | have | its live page (2026-10-28): "most AI-native tools like Notion is an important competitive advantage for us to stay small while doing a lot" | void-live-deploy/notes/index.html:117 `mportBtn" data-w="importFile">Import .md or .txt</button><input type="file" id="file" acce` |
| Databases (tables of pages with views) | Organising | missing | studied by hand: notion.so offers this (https://notion.so/) | no sign of it in the source of /notes/ |
| Writing help (summarise, rewrite) | Writing | missing | its live page (2026-10-28): "The AI workspace that works for you. / Notion Main Notion – Home Product Features See all features → Capture" | no sign of it in the source of /notes/ |
| Clip pages from the web | Files | have | studied by hand: notion.so offers this (https://notion.so/) | void-live-deploy/notes/index.html:259 `const pics = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^ima` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ours Help Center Pricing Request a demo Log in Get Notion free Toggle main menu Where teams and agents Think t" | void-live-deploy/notes/index.html:215 `try { store = N.load(localStorage.getItem(N.KEY)); } catch (_) {}` |
| A public API | Developers | missing | its live page (2026-10-28): "or Enterprise Small businesses Startups Developers Discover What&#x27;s New Customer stories Webinars Template" | no sign of it in the source of /notes/ |
| See all features → | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See what’s new → | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Notion App → | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Enterprise | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Small businesses | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Startups | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| What&#x27;s New | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer stories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Consultants | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Academy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Product tours | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Help Center | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
