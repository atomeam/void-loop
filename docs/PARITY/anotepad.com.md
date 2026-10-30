# anotepad.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: anotepad.com (https://anotepad.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: anotepad.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Online Notepad - Take Notes and Share Notes Online"
- History: [docs/HISTORY/anotepad.com.md](../HISTORY/anotepad.com.md)

**Match: 47%**: 13 have, 1 partial, 3 missing, 12 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "Online Notepad - Take Notes and Share Notes Online Online Notepad aNotepad aNotepad - free online notepad Tog" | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | its live page (2026-10-28): "tures. Send to Email Email Address Note Format Email body PDF attachment Word attachment Invalid email address" | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Checklists | Editing | have | its live page (2026-10-28): "ormatted notes, draft in Markdown, keep checklists, build spreadsheets, and sketch on a whiteboard &#x2014; al" | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | its live page (2026-10-28): "AI Writing & AI Chat File attachments & image uploads Audio notes 10MB note size & 50 version history Send not" | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | its live page (2026-10-28): "hare your notes Every note gets its own link you can share with anyone. Choose whether a note is private, publ" | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Search all notes | Organising | have | every site of this kind offers it | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | its live page (2026-10-28): "nt, no email, no install. When you want folders, sharing history, and syncing across devices, a free account t" | void-live-deploy/notes/index.html:155 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Templates | Organising | have | its live page (2026-10-28): "- free online notepad Toggle navigation Templates Workspace Register/Login Online Notepad A free online notepa" | void-live-deploy/notes/index.html:116 `elect id="tplSel" aria-label="Start from a template" data-wal="tpl"><option value="">Start` |
| Version history and restore | Safety | have | its live page (2026-10-28): "is note Editor Password Close Save Note Version History Close Close Send Note by Email Close This feature is a" | void-live-deploy/notes/index.html:112 `g, search across all of them, version history. Nothing goes to a server; it works offline.` |
| Share a note by link | Sharing | have | its live page (2026-10-28): "Online Notepad - Take Notes and Share Notes Online Online Notepad aNotepad aNotepad - free online notepad Tog" | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | its live page (2026-10-28): "sword-protected, and let others view or collaborate. Notes you share stay in sync across the web app and the m" | no sign of it in the source of /notes/ |
| Export (Word, PDF, Markdown, text) | Files | have | its live page (2026-10-28): "il Email Address Note Format Email body PDF attachment Word attachment Invalid email address Close Save your w" | void-live-deploy/notes/index.html:164 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| Import files | Files | have | its live page (2026-10-28): "kmark Whiteboard Spreadsheet Group Chat Import Docs Share AI Chat Note Content Maximize Editor Public Note ( R" | void-live-deploy/notes/index.html:117 `mportBtn" data-w="importFile">Import .md or .txt</button><input type="file" id="file" acce` |
| Writing help (summarise, rewrite) | Writing | missing | its live page (2026-10-28): "preadsheet Group Chat Import Docs Share AI Chat Note Content Maximize Editor Public Note ( Register for privat" | no sign of it in the source of /notes/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "navigation Templates Workspace Register/Login Online Notepad A free online notepad to take and share notes &#x" | void-live-deploy/notes/index.html:215 `try { store = N.load(localStorage.getItem(N.KEY)); } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "d. Mobile app downloads Download on the App Store Get it on Google Play Footer navigation aNotepad About Featu" | void-live-deploy/notes/index.html:504 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | missing | its live page (2026-10-28): "Creator&#x27;s Guide Buyer&#x27;s Guide Developers REST API AI Integration (MCP) Tools Resume Builder Free Fax" | no sign of it in the source of /notes/ |
| Workspace | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Markdown | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Task List | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bookmark | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Whiteboard | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Spreadsheet | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Group Chat | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Send | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Save | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Upgrade Now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Continue without account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sort by Title | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
