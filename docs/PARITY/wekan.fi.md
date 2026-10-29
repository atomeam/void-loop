# wekan.fi: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: wekan.fi (https://wekan.fi/)
- Verse: /kanban/teams/ (kanban: wekan.fi, tower gate 13 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "WeKan ® — Open-Source kanban"
- History: [docs/HISTORY/wekan.fi.md](../HISTORY/wekan.fi.md)

**Match: 39%**: 9 have, 0 partial, 2 missing, 12 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "ll Commercial support Features in WeKan Boards You can make many boards for different projects or tasks. Each" | void-live-deploy/lib/kanban-ui.js:11 `: 'Rename', del: 'Delete', addCard: 'Add a card', addCardPh: 'Card title, then Enter', add` |
| Drag cards between lists | Boards | have | its live page (2026-10-28): "me. You can move tasks between lists by dragging and dropping them. Lists can be customized by changing their" | void-live-deploy/lib/kanban-ui.js:18 `h1: 'Drag and drop cards between columns by their grip, or focus a card and press Alt+` |
| Card details: description, due date, labels | Cards | have | its live page (2026-10-28): "board to represent tasks, with titles, descriptions, and due dates. WeKan helps you keep track of your tasks" | void-live-deploy/kanban/teams/index.html:62 `s by label or person, labels, due dates, checklists, comments, assignees, an archive and f` |
| Checklists in cards | Cards | have | its live page (2026-10-28): "customized by adding labels, files, and checklists. You can also comment on cards to provide updates or feedba" | void-live-deploy/kanban/teams/index.html:62 `or person, labels, due dates, checklists, comments, assignees, an archive and filters. Bri` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): "-08, Trello will limit free users to 10 members. xet7 recommends to download all Trello JSON and attachments w" | void-live-deploy/kanban/teams/index.html:60 `<h1>Plan team work on a shared to-do board (kanban with WIP limits)</h1>` |
| Comments and activity | Teams | have | its live page (2026-10-28): "tle, description, due date, labels, and comments. To create a new card, choose the board and column, and add t" | void-live-deploy/kanban/teams/index.html:62 `abels, due dates, checklists, comments, assignees, an archive and filters. Bring in a Trel` |
| Attachments | Cards | missing | its live page (2026-10-28): "about security CVE Hall of Fame Trello Attachments Downloader At 2024-04-08, Trello will limit free users to" | no sign of it in the source of /kanban/teams/ |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "s Downloader At 2024-04-08, Trello will limit free users to 10 members. xet7 recommends to download all Trello" | void-live-deploy/kanban/teams/index.html:60 `ared to-do board (kanban with WIP limits)</h1>` |
| Export and import | Files | have | its live page (2026-10-28): "ts Downloader . xet7 is adding a way to import from those files to WeKan. Standard for Public Code WeKan and S" | void-live-deploy/kanban/teams/index.html:62 `nd filters. Bring in a Trello export; share a board as a link. No server, no account.</p>` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "that your data is not being accessed or shared without your knowledge. Access controls WeKan allows you to set" | void-live-deploy/lib/kanban-ui.js:13 `share: 'Share link', archive: 'Archive', archived: 'Archived cards', restore: 'Restore` |
| A public API | Developers | missing | its live page (2026-10-28): "SaaS App Sponsors Awards Success FLOSS Developers Only Private Paid Commercial Support Sponsor Privacy Policy" | no sign of it in the source of /kanban/teams/ |
| WeKan ® | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Status | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Docs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Install | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Upgrade | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| SaaS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| App | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sponsors | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Awards | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Success | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Private Paid Commercial Support | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sponsor | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
