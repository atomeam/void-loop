# Trello: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Trello (https://trello.com/)
- Verse: /kanban/ (kanban, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Capture, organize, and tackle your to-dos from anywhere"
- History: [docs/HISTORY/trello.md](../HISTORY/trello.md)

**Match: 39%**: 10 have, 1 partial, 4 missing, 12 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "anized. It’s simple – sign-up, create a board, and you’re off! Productivity awaits. Check out Trello Take a pa" | void-live-deploy/kanban/index.html:62 `ntro">Boards with columns and cards you drag (or move with the keyboard), labels, due date` |
| Drag cards between lists | Boards | have | every site of this kind offers it | void-live-deploy/kanban/index.html:62 `ds with columns and cards you drag (or move with the keyboard), labels, due dates, checkli` |
| Card details: description, due date, labels | Cards | have | every site of this kind offers it | void-live-deploy/kanban/index.html:62 `e with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a ti` |
| Checklists in cards | Cards | have | studied by hand: Trello offers this (https://trello.com/) | void-live-deploy/kanban/index.html:62 `keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeat` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): "ces Explore the features that help your team succeed Inbox Capture every vital detail from emails, Slack, and" | void-live-deploy/kanban/app.js:3 `1,"checklist":1,"comments":1,"assignee":1,"archive":1,"filter":1,"trello":1,"timer":1,"rec` |
| Comments and activity | Teams | have | studied by hand: Trello offers this (https://trello.com/) | void-live-deploy/kanban/index.html:62 `abels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive,` |
| Attachments | Cards | missing | studied by hand: Trello offers this (https://trello.com/) | no sign of it in the source of /kanban/ |
| Calendar, table and timeline views | Views | have | its live page (2026-10-28): "to your Trello Inbox. Planner Sync your calendar and allocate focused time slots to boost productivity. Automa" | void-live-deploy/kanban/index.html:65 `ck kanban board</a> <a href="/calendar/">Calendar</a> <a href="/notes/">Notes</a> <a href=` |
| Automation rules | Power | missing | its live page (2026-10-28): "cused time slots to boost productivity. Automation Automate tasks and workflows with Trello. Power-Ups Power u" | no sign of it in the source of /kanban/ |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "workflow. Developers The sky&#x27;s the limit in what you can deliver to Trello users in your Power-Up! Help r" | void-live-deploy/kanban/index.html:62 `dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive, search and` |
| Board templates | Boards | have | its live page (2026-10-28): "eir favorite tools with Trello plugins. Templates Give your team a blueprint for success with easy-to-use temp" | void-live-deploy/kanban/app.js:3 `"csv":1,"share":1,"colour":1,"templates":1}});` |
| Export and import | Files | have | studied by hand: Trello offers this (https://trello.com/) | void-live-deploy/kanban/index.html:62 `, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept` |
| Add-ons and integrations | Power | missing | its live page (2026-10-28): "tomate tasks and workflows with Trello. Power-Ups Power up your teams by linking their favorite tools with Tre" | no sign of it in the source of /kanban/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "s Pricing Resources Get Trello for free Log in Explore the features that help your team succeed Inbox Capture" | void-live-deploy/lib/kanban-ui.js:46 `let lang = 'en'; try { lang = localStorage.getItem(LANG) // ''; } catch (_) {} const qp =` |
| A public API | Developers | missing | its live page (2026-10-28): "s Ship more code, faster, and give your developers the freedom to be more agile with Trello. Design teams Empo" | no sign of it in the source of /kanban/ |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Check out Trello | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Take a tour of Trello | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| View Trello pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Trello for free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See all use cases | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Check out the Trello blog | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sign up - it’s free! | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Atlassian Privacy Policy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Dot 2 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compare plans | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
