# abacktools.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: abacktools.com (https://abacktools.com/tools/productivity/planning/kanban-board)
- Verse: /kanban/ (kanban: abacktools.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Kanban Board - Free Online Drag-and-Drop Project Board"
- History: [docs/HISTORY/abacktools.com.md](../HISTORY/abacktools.com.md)

**Match: 40%**: 10 have, 1 partial, 3 missing, 12 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "Kanban Board - Free Online Drag-and-Drop Project Board Skip to content Toggle sidebar Aback Tools Logo Open f" | void-live-deploy/kanban/index.html:63 `ntro">Boards with columns and cards you drag (or move with the keyboard), labels, due date` |
| Drag cards between lists | Boards | have | its live page (2026-10-28): "Kanban Board - Free Online Drag-and-Drop Project Board Skip to content Toggle sidebar Aback Tools Logo Open f" | void-live-deploy/kanban/index.html:63 `ds with columns and cards you drag (or move with the keyboard), labels, due dates, checkli` |
| Card details: description, due date, labels | Cards | have | its live page (2026-10-28): "Create columns, add cards with priority labels and tags, drag cards between stages to track your workflow - no" | void-live-deploy/kanban/index.html:63 `e with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a ti` |
| Checklists in cards | Cards | have | its live page (2026-10-28): "d download - no account or cloud needed Checklist Generator Create custom checklists with categories and items" | void-live-deploy/kanban/index.html:63 `keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeat` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): "pe. Content Calendar Management Content teams use the kanban board to manage articles, videos, and social post" | void-live-deploy/kanban/index.html:61 `columns, timers, limits and a share link</h1>` |
| Comments and activity | Teams | have | its live page (2026-10-28): "ategories Analyzers Archive Beautifiers Comment Removers Converters Dev Utilities Formatters Generators Minifi" | void-live-deploy/kanban/index.html:63 `abels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive,` |
| Calendar, table and timeline views | Views | have | its live page (2026-10-28): "or client name or project type. Content Calendar Management Content teams use the kanban board to manage artic" | void-live-deploy/kanban/index.html:66 `el">Use with</span> <a href="/calendar/">Calendar</a> <a href="/notes/">Notes</a> <a href=` |
| Automation rules | Power | missing | its live page (2026-10-28): "tely private. The kanban board persists automatically across browser sessions with no account required. Breadc" | no sign of it in the source of /kanban/ |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "letely free with no signup and no usage limits. Add unlimited columns and cards, choose column accent colors," | void-live-deploy/kanban/index.html:61 `anban board: columns, timers, limits and a share link</h1>` |
| Export and import | Files | have | its live page (2026-10-28): "YouTube. Session-based planner with CSV export. All processing runs locally in your browser - free online Soci" | void-live-deploy/kanban/index.html:63 `, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ween stages to track your workflow - no login, no server, completely private. The kanban board persists automa" | void-live-deploy/lib/kanban-ui.js:46 `let lang = 'en'; try { lang = localStorage.getItem(LANG) // ''; } catch (_) {} const qp =` |
| Dark mode | Settings | missing | its live page (2026-10-28): "uides Change language English Switch to dark mode Kanban Board Simple drag-and-drop kanban board saved in your" | no sign of it in the source of /kanban/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "rds between columns by recreating them. Share this tool Share on X Share on LinkedIn Share on Facebook Share o" | void-live-deploy/kanban/index.html:61 `columns, timers, limits and a share link</h1>` |
| A public API | Developers | missing | its live page (2026-10-28): "owser&#x27;s native HTML5 drag-and-drop API - no plugins required. All changes save automatically to local sto" | no sign of it in the source of /kanban/ |
| Productivity Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Planning | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Aback Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Devvrat Hans | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| llms.txt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| llms-full.txt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ai.txt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| AI Docs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| auth.md | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| OAuth metadata | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| sitemap.xml | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| robots.txt | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
