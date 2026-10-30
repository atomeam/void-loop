# standardnotes.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: standardnotes.com (https://standardnotes.com/)
- Verse: /notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread (docs and notes: standardnotes.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Standard Notes / End-To-End Encrypted Notes App"
- History: [docs/HISTORY/standardnotes.com.md](../HISTORY/standardnotes.com.md)

**Match: 50%**: 13 have, 0 partial, 1 missing, 12 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Write and keep notes | Editing | have | its live page (2026-10-28): "Standard Notes / End-To-End Encrypted Notes App Standard Notes logo Pricing Features Help Download for free G" | void-live-deploy/notes/index.html:115 `" id="newBtn" data-w="newDoc">New note</button>` |
| Rich text: bold, italic, headings, lists | Editing | have | its live page (2026-10-28): "tity theft, loss of control over your information, and other existential harms to you or your business. Safegu" | void-live-deploy/notes/index.html:137 `type="button" data-cmd="bold" aria-label="Bold" data-wal="bold" title="Bold (Ctrl+B)"><b>B` |
| Checklists | Editing | have | its live page (2026-10-28): "Budgets and personal finance Tasks and todos Code snippets Passwords and keys Outlining and lists Family reco" | void-live-deploy/notes/index.html:144 `" data-cmd="todo" aria-label="Checklist" data-wal="todo" title="Checklist">&#9745;</button` |
| Images in a note | Editing | have | its live page (2026-10-28): "ary Secure file storage Passport and ID photos Bank account and credit card numbers Legal contracts and agreem" | void-live-deploy/notes/index.html:148 `type="file" id="imgF" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>` |
| Links, and links between notes | Editing | have | its live page (2026-10-28): "6 Follow Us X Discord YouTube Instagram LinkedIn Reddit Download iOS iOS Download for free Copyright © 2026 ·" | void-live-deploy/notes/index.html:159 `<div id="links" aria-label="Links between notes"></div>` |
| Find and replace | Editing | have | its live page (2026-10-28): "pendently audited by leading security researchers. 100% Revenue from paying users $0 In venture capital 10 yea" | void-live-deploy/notes/index.html:168 `ria-controls="fr" data-w="fr">Find and replace</button>` |
| Search all notes | Organising | have | its live page (2026-10-28): "pendently audited by leading security researchers. 100% Revenue from paying users $0 In venture capital 10 yea" | void-live-deploy/notes/index.html:129 `"sq" id="sqL" data-w="search">Search all notes</label><input type="search" id="sq" placeho` |
| Tags or folders | Organising | have | its live page (2026-10-28): "ch Text In Circle Icon Circle With HTML Tags Icon Color Fill In Circle Icon Security In Diamond Icon Dashed Ci" | void-live-deploy/notes/index.html:155 `maxlength="120" placeholder="Tags: travel, work" data-wph="tagsPh" autocomplete="off"></d` |
| Pin notes | Organising | have | its live page (2026-10-28): "ragraph In Circle Icon Textbox Password Pink In Circle Icon Dashed Circle Icon Blue Dot Icon Tasks In Circle I" | void-live-deploy/notes/index.html:155 `a-pressed="false" data-w="pin">Pin</button><label class="vh" for="tagsIn" data-w="tagsLabe` |
| Version history and restore | Safety | have | studied by hand: standardnotes.com offers this (https://standardnotes.com/) | void-live-deploy/notes/index.html:112 `g, search across all of them, version history. Nothing goes to a server; it works offline.` |
| Share a note by link | Sharing | have | every site of this kind offers it | void-live-deploy/notes/index.html:163 `id="shareBtn" data-w="share">Copy share link</button>` |
| Export (Word, PDF, Markdown, text) | Files | have | its live page (2026-10-28): "andard Notes logo Pricing Features Help Download for free Go to web app Right Arrow Icon Menu Icon Pricing Fea" | void-live-deploy/notes/index.html:164 `id="mdBtn" data-w="exportMd">Export .md</button>` |
| End-to-end encryption | Safety | missing | its live page (2026-10-28): "Standard Notes / End-To-End Encrypted Notes App Standard Notes logo Pricing Features Help Download for free G" | no sign of it in the source of /notes/ |
| Works offline | Apps | have | its live page (2026-10-28): "data again. You&#x27;ll always have an offline copy of your data, so you can access your notes and files even" | void-live-deploy/notes/index.html:112 `ng goes to a server; it works offline.</p>` |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Try live demo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| open | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| audited | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Source code | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Writers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Legal Professionals | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Journalists | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Stand For Privacy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Built to Last | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Write Fearlessly | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
