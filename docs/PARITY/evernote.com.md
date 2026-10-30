# evernote.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: evernote.com (https://evernote.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: evernote.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Best Note Taking App - Organize Your Notes with Evernote"
- History: [docs/HISTORY/evernote.com.md](../HISTORY/evernote.com.md)

**Match: 56%**: 19 have, 1 partial, 3 missing, 12 unreviewed, of 35 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "Best Note Taking App - Organize Your Notes with Evernote Evernote Logo Evernote Get the app Download Evernote" | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | its live page (2026-10-28): "scan, clip— no matter how you gather information, Evernote keeps all your content safe for you. Save your ide" | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Tables | Editing | have | studied by hand: evernote.com offers this (https://evernote.com/) | void-live-deploy/notes/index.html:187 `iv id="tblbar" role="toolbar" aria-label="Table" data-wal="tbl" hidden><button type="butto` |
| Checklists | Editing | have | its live page (2026-10-28): "seconds icon Tasks Stay on top of your to-dos and keep things moving icon Calendar Link events to notes for a" | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | studied by hand: evernote.com offers this (https://evernote.com/) | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | its live page (2026-10-28): "os and keep things moving icon Calendar Link events to notes for a seamless workflow icon Web Clipper Clip wha" | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | its live page (2026-10-28): "ures Collaboration Web Clipper Advanced search Document scanning Personalization Tasks Calendar Ecosystem AI A" | void-live-deploy/notes/index.html:168 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | its live page (2026-10-28): "ures Collaboration Web Clipper Advanced search Document scanning Personalization Tasks Calendar Ecosystem AI A" | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | its live page (2026-10-28): "er with ready-made note structures icon Notebooks & Spaces Organize ideas where they belong icon Search Find e" | void-live-deploy/notes/index.html:155 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Pin notes | Organising | have | studied by hand: evernote.com offers this (https://evernote.com/) | void-live-deploy/notes/index.html:155 `a-pressed="false" data-w="pin">Pin</button><label class="vh" for="tagsIn" data-w="tagsLabe` |
| Templates | Organising | have | its live page (2026-10-28): "d access it whenever and wherever. icon Template Get further faster with ready-made note structures icon Noteb" | void-live-deploy/notes/index.html:116 `elect id="tplSel" aria-label="Start from a template" data-wal="tpl"><option value="">Start` |
| Trash and restore | Safety | have | studied by hand: evernote.com offers this (https://evernote.com/) | void-live-deploy/notes/index.html:169 `ontrols="trash" data-w="trash">Trash</button>` |
| Share a note by link | Sharing | have | its live page (2026-10-28): "ond brain even sharper. Try it for free Share Unlock seamless collaboration Boost teamwork with real-time edit" | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | its live page (2026-10-28): "g Productivity What&#x27;s new Features Collaboration Web Clipper Advanced search Document scanning Personaliz" | no sign of it in the source of /notes/ |
| Comments and suggestions on the text | Sharing | have | its live page (2026-10-28): "teamwork with real-time editing, leave comments to stay in sync, and assign tasks to keep everything moving T" | void-live-deploy/notes/index.html:149 `"button" id="cmB" aria-label="Comment on the selected words" title="Comment on the selecte` |
| Export (Word, PDF, Markdown, text) | Files | have | its live page (2026-10-28): "note Evernote Logo Evernote Get the app Download Evernote logo Evernote logo AI Features Explore Solutions Why" | void-live-deploy/notes/index.html:164 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| Import files | Files | have | its live page (2026-10-28): "re everything that is, was, or could be important and access it whenever and wherever. icon Template Get furth" | void-live-deploy/notes/index.html:117 `mportBtn" data-w="importFile">Import .md or .txt</button><input type="file" id="file" acce` |
| Word count | Editing | have | its live page (2026-10-28): "PDF Editor PDF Converter Online Notepad Word Counter Citation Generator Plans Enterprise What&#x27;s new Log i" | void-live-deploy/notes/index.html:154 `s="status"><span id="words">0 words</span><span id="saved" data-w="saved">Saved on this de` |
| Writing help (summarise, rewrite) | Writing | missing | its live page (2026-10-28): "pp Download Evernote logo Evernote logo AI Features Explore Solutions Why Evernote Note Taking Self organizing" | no sign of it in the source of /notes/ |
| Clip pages from the web | Files | have | its live page (2026-10-28): "t&#x27;s new Features Collaboration Web Clipper Advanced search Document scanning Personalization Tasks Calend" | void-live-deploy/notes/index.html:259 `const pics = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^ima` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "erator Plans Enterprise What&#x27;s new Log in Download Start for free AI Features Explore Why Evernote Note T" | void-live-deploy/notes/index.html:215 `try { store = N.load(localStorage.getItem(N.KEY)); } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "nd productive even on the go. Get it on App Store Get it on Google Play Web Clipper Extension Clip what you se" | void-live-deploy/notes/index.html:504 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | missing | its live page (2026-10-28): "learning Templates Forum Find an Expert Developers Contact us Careers About Bending Spoons Get Started Sign up" | no sign of it in the source of /notes/ |
| Self organizing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Productivity | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| What&#x27;s new | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Personalization | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tasks | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Citation Generator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Plans | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Enterprise | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Start for free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Discover more | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Try it for free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
