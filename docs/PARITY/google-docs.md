# Google Docs: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Google Docs (https://docs.google.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Sign in - Google Accounts"
- History: [docs/HISTORY/google-docs.md](../HISTORY/google-docs.md)

**Match: 89%**: 19 have, 1 partial, 2 missing, 0 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Tables | Editing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:187 `iv id="tblbar" role="toolbar" aria-label="Table" data-wal="tbl" hidden><button type="butto` |
| Checklists | Editing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | its live page (2026-10-28): "ne Email or phone Forgot email? CAPTCHA image of text used to distinguish humans from robots Listen and type t" | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | every site of this kind offers it | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:168 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | every site of this kind offers it | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Pin notes | Organising | have | its live page (2026-10-28): "ña) Español (Latinoamérica) euskara Filipino Français (Canada) Français (France) Gaeilge galego Hrvatski Indon" | void-live-deploy/notes/index.html:155 `a-pressed="false" data-w="pin">Pin</button><label class="vh" for="tagsIn" data-w="tagsLabe` |
| Templates | Organising | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:116 `elect id="tplSel" aria-label="Start from a template" data-wal="tpl"><option value="">Start` |
| Version history and restore | Safety | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:112 `g, search across all of them, version history. Nothing goes to a server; it works offline.` |
| Trash and restore | Safety | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:169 `ontrols="trash" data-w="trash">Trash</button>` |
| Share a note by link | Sharing | have | every site of this kind offers it | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | studied by hand: Google Docs offers this (https://docs.google.com/) | no sign of it in the source of /notes/ |
| Comments and suggestions on the text | Sharing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:149 `"button" id="cmB" aria-label="Comment on the selected words" title="Comment on the selecte` |
| Export (Word, PDF, Markdown, text) | Files | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:164 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| Import files | Files | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:117 `mportBtn" data-w="importFile">Import .md or .txt</button><input type="file" id="file" acce` |
| Print | Files | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:167 `" id="printBtn" data-w="print">Print</button>` |
| Word count | Editing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:154 `s="status"><span id="words">0 words</span><span id="saved" data-w="saved">Saved on this de` |
| Voice typing | Editing | have | studied by hand: Google Docs offers this (https://docs.google.com/) | void-live-deploy/notes/index.html:333 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Writing help (summarise, rewrite) | Writing | missing | studied by hand: Google Docs offers this (https://docs.google.com/) | no sign of it in the source of /notes/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Sign in - Google Accounts Loading Loading Sign in Use your Google Account Email or phone Email or phone Forgo" | void-live-deploy/notes/index.html:215 `try { store = N.load(localStorage.getItem(N.KEY)); } catch (_) {}` |
