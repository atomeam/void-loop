# kanbanflow.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: kanbanflow.com (https://kanbanflow.com/)
- Verse: /kanban/flow/ (kanban: kanbanflow.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "KanbanFlow - Lean project management. Simplified."
- History: [docs/HISTORY/kanbanflow.com.md](../HISTORY/kanbanflow.com.md)

**Match: 46%**: 10 have, 1 partial, 3 missing, 9 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "ersonal or team productivity KanbanFlow board Sign up for free! Email Sign Up Visualize your work with Kanban" | void-live-deploy/kanban/flow/index.html:62 `rt a timer or a Pomodoro on a card, see the total on it, repeat cards daily, weekly or mon` |
| Drag cards between lists | Boards | have | every site of this kind offers it | void-live-deploy/lib/kanban-ui.js:18 `h1: 'Drag and drop cards between columns by their grip, or focus a card and press Alt+` |
| Card details: description, due date, labels | Cards | have | every site of this kind offers it | void-live-deploy/kanban/flow/app.js:3 `"wip":1,"lanes":1,"labels":1,"due":1,"checklist":1,"archive":1,"filter":1,"timer":1,"recur` |
| Checklists in cards | Cards | have | studied by hand: kanbanflow.com offers this (https://kanbanflow.com/) | void-live-deploy/kanban/flow/app.js:3 `"lanes":1,"labels":1,"due":1,"checklist":1,"archive":1,"filter":1,"timer":1,"recur":1,"pri` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): "ent. Simplified. Boost your personal or team productivity KanbanFlow board Sign up for free! Email Sign Up Vis" | void-live-deploy/lib/kanban-ui.js:13 `share: 'Share link', archive: 'Archive', archived: 'Archived cards', restore: 'Restore` |
| Comments and activity | Teams | have | studied by hand: kanbanflow.com offers this (https://kanbanflow.com/) | void-live-deploy/lib/kanban-ui.js:13 `ist', addItem: 'Add an item', comments: 'Comments', addComment: 'Add a comment', assignee:` |
| Attachments | Cards | missing | studied by hand: kanbanflow.com offers this (https://kanbanflow.com/) | no sign of it in the source of /kanban/flow/ |
| Calendar, table and timeline views | Views | have | its live page (2026-10-28): "to Excel and others Add tasks by email Calendar feed for external calendars like Outlook and Google Calendar" | void-live-deploy/kanban/flow/index.html:65 `ck kanban board</a> <a href="/calendar/">Calendar</a> <a href="/tools/">All tools</a>` |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "proved productivity . Kanban board with swimlanes Stop starting. Start finishing. Limit your work-in-progress" | void-live-deploy/kanban/flow/index.html:62 `rds daily, weekly or monthly, limit work in progress, group by label, colour cards, print` |
| A Pomodoro timer and time tracking | Power | have | its live page (2026-10-28): "will be happier. Limit Work in Progress Time tracking Track the time that you spend on your tasks. Use the Pom" | void-live-deploy/kanban/flow/index.html:62 `s the time you spend: start a timer or a Pomodoro on a card, see the total on it, repeat c` |
| Export and import | Files | have | its live page (2026-10-28): "ys: REST-based API with webhook support Import/export to Excel and others Add tasks by email Calendar feed for" | void-live-deploy/kanban/flow/index.html:66 `orks offline after one visit. Export a board as JSON to keep a copy or move it; a Trello e` |
| Add-ons and integrations | Power | missing | its live page (2026-10-28): "ting . Cumulative Flow diagram Powerful integrations You can integrate KanbanFlow with other systems in many d" | no sign of it in the source of /kanban/flow/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ent. Simplified. Features Pricing Press Login Sign up Lean Project Management. Simplified. Boost your personal" | void-live-deploy/lib/kanban-ui.js:46 `let lang = 'en'; try { lang = localStorage.getItem(LANG) // ''; } catch (_) {} const qp =` |
| A public API | Developers | missing | its live page (2026-10-28): "tems in many different ways: REST-based API with webhook support Import/export to Excel and others Add tasks b" | no sign of it in the source of /kanban/flow/ |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| mobile web app | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sign up for FREE | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See all features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| hello@kanbanflow.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Facebook | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bluesky | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Email | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
