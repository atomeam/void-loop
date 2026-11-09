# simplenote.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: simplenote.com (https://simplenote.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: simplenote.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Simplenote"
- History: [docs/HISTORY/simplenote.com.md](../HISTORY/simplenote.com.md)

**Match: 59%**: 23 have, 1 partial, 5 missing, 11 unreviewed, of 40 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "Simplenote Simplenote &raquo; Feed Simplenote &raquo; Comments Feed RSD Simplenote WordPress.com Skip to cont" | void-live-deploy/notes/index.html:131 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | its live page (2026-10-28): "iew, and publish your notes in Markdown format. It’s free Apps, backups, syncing, sharing – it’s all completel" | void-live-deploy/notes/index.html:156 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Checklists | Editing | have | its live page (2026-10-28): "note-featured-ios Work together Share a to-do list, post some instructions, or publish your notes online. Go b" | void-live-deploy/notes/index.html:163 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | its live page (2026-10-28): "t this content Collapse this bar Toggle photo metadata visibility Toggle photo comments visibility This image" | void-live-deploy/notes/index.html:167 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | its live page (2026-10-28): "tions Site options Simplenote Copy shortlink View post in Reader Manage subscriptions Sign up Log in Report th" | void-live-deploy/notes/index.html:179 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | its live page (2026-10-28): "tags to find notes quickly with instant searching. simplenote-featured-ios Work together Share a to-do list, p" | void-live-deploy/notes/index.html:191 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | its live page (2026-10-28): "tags to find notes quickly with instant searching. simplenote-featured-ios Work together Share a to-do list, p" | void-live-deploy/notes/index.html:146 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | its live page (2026-10-28): "tton: It just works. Stay organized Add tags to find notes quickly with instant searching. simplenote-featured" | void-live-deploy/notes/index.html:174 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Pin notes | Organising | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:174 `a-pressed="false" data-w="pin">Pin</button><button type="button" id="arcBtn" aria-pressed=` |
| Version history and restore | Safety | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:128 `g, search across all of them, version history. Nothing goes to a server; it works offline.` |
| Trash and restore | Safety | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:192 `ontrols="trash" data-w="trash">Trash</button>` |
| Share a note by link | Sharing | have | its live page (2026-10-28): ". simplenote-featured-ios Work together Share a to-do list, post some instructions, or publish your notes onli" | void-live-deploy/notes/index.html:183 `id="shareBtn" data-w="share">Copy share link</button>` |
| Edit together in real time | Sharing | missing | its live page (2026-10-28): "searching. simplenote-featured-ios Work together Share a to-do list, post some instructions, or publish your n" | no sign of it in the source of /notes/ |
| Comments and suggestions on the text | Sharing | have | its live page (2026-10-28): "plenote &raquo; Feed Simplenote &raquo; Comments Feed RSD Simplenote WordPress.com Skip to content Simplenote" | void-live-deploy/notes/index.html:168 `"button" id="cmB" aria-label="Comment on the selected words" title="Comment on the selecte` |
| Export (Word, PDF, Markdown, text) | Files | have | its live page (2026-10-28): "ac, Windows, Linux, or in your browser. Download on the App Store Download on the Play Store Download for Linu" | void-live-deploy/notes/index.html:184 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| Sort by modified, created or name, either way | Organising | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:148 `vh">Sort notes</label><select id="sortSel" aria-label="Sort notes"></select></div>` |
| Search by tag (tag:name) and other search words | Organising | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:212 `list or a quote. Search takes tag:work, is:pinned, is:archived, is:checklist and color:min` |
| Rename or remove a tag on every note | Organising | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:149 `ton type="button" id="tagRen">Rename tag</button><button type="button" class="bad" id="tag` |
| Export every note at once and import it back | Files | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:134 `on file you can import again">Back up all notes</button>` |
| Import notes from another notes app | Files | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:133 `text files, a Verse backup, a Simplenote export (notes.json) or Google Keep notes from Tak` |
| Markdown typed at a line start formats it | Editing | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:428 `const ls = O.lineStart(n.data.slice(0, s.anchorOffset)); if (!ls) return;` |
| Focus mode | Editing | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:188 `ge step aside (Ctrl+Shift+F)">Focus mode</button>` |
| Text size | Settings | have | studied by hand: simplenote.com offers this (https://simplenote.com/) | void-live-deploy/notes/index.html:189 `tton" id="sizeUp" aria-label="Larger text" title="Larger text">A+</button>` |
| Nested checklists | Editing | missing | studied by hand: simplenote.com offers this (https://simplenote.com/) | no sign of it in the source of /notes/ |
| A Markdown source view and preview | Editing | missing | studied by hand: simplenote.com offers this (https://simplenote.com/) | no sign of it in the source of /notes/ |
| A passcode lock on the notes | Safety | missing | studied by hand: simplenote.com offers this (https://simplenote.com/) | no sign of it in the source of /notes/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "menu Contact Us Help Support Forum Blog Log In Sign Up Simplenote The simplest way to keep notes All your note" | void-live-deploy/notes/index.html:239 `try { store = N.load(localStorage.getItem(N.KEY)); } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ux, or in your browser. Download on the App Store Download on the Play Store Download for Linux Download on th" | void-live-deploy/notes/index.html:574 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | missing | its live page (2026-10-28): "nloads Footer Menu Contact Us Help Blog Developers Terms of Service Privacy Press Privacy Notice for Californi" | no sign of it in the source of /notes/ |
| Support Forum | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sign up now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Privacy Notice for California Users | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Blog at WordPress.com. | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &times; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get the app | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sign me up | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| View post in Reader | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manage subscriptions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Collapse this bar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Want updates? Enter your email | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
