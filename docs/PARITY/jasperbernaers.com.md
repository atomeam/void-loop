# jasperbernaers.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: jasperbernaers.com (https://jasperbernaers.com/kanban-board/)
- Verse: /kanban/simple/ (kanban: jasperbernaers.com, tower gate 13 of 16); /tuner/ (music: jasperbernaers.com, tower gate 13 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Free Kanban Board Online — Board, List, Calendar &amp; Flow Charts, No Signup / JasperBernaers.com"
- History: [docs/HISTORY/jasperbernaers.com.md](../HISTORY/jasperbernaers.com.md)

**Match: 56%**: 18 have, 0 partial, 2 missing, 12 unreviewed, of 32 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "Free Kanban Board Online — Board, List, Calendar & Flow Charts, No Signup / JasperBernaers.com JasperBernaers" | void-live-deploy/kanban/simple/index.html:62 `boards with columns you name, cards with a title and notes that you drag between columns o` |
| Drag cards between lists | Boards | have | its live page (2026-10-28): "tings to enforce it. 4 Pull work across Drag cards with the mouse, press and hold on a phone, or use Shift + a" | void-live-deploy/kanban/simple/index.html:61 `ain three-column to-do board: drag tasks from To do to Done.</p>` |
| Card details: description, due date, labels | Cards | have | its live page (2026-10-28): "your browser. WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kan" | void-live-deploy/kanban/simple/app.js:3 `ures":{"boards":1,"filter":1,"due":1,"labels":1,"checklist":1,"archive":1,"csv":1,"share":` |
| Checklists in cards | Cards | have | its live page (2026-10-28): "ow charts in your browser. WIP limits · checklists · due dates · share links. Saved on this device, no account" | void-live-deploy/kanban/simple/app.js:3 `filter":1,"due":1,"labels":1,"checklist":1,"archive":1,"csv":1,"share":1}});` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): ". WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kanban board Bo" | void-live-deploy/kanban/simple/index.html:62 `he keyboard, saved as you go. Share a board as a link, export and import it as JSON. Kept` |
| Comments and activity | Teams | have | its live page (2026-10-28): "a card for its description, checklist, comments and history. 5 Switch views, read the flow Board, List, Calen" | void-live-deploy/lib/kanban-ui.js:13 `ist', addItem: 'Add an item', comments: 'Comments', addComment: 'Add a comment', assignee:` |
| Calendar, table and timeline views | Views | have | its live page (2026-10-28): "Free Kanban Board Online — Board, List, Calendar & Flow Charts, No Signup / JasperBernaers.com JasperBernaers." | void-live-deploy/kanban/simple/index.html:65 `s and swimlanes</a> <a href="/calendar/">Calendar</a> <a href="/tools/">All tools</a>` |
| Automation rules | Power | missing | its live page (2026-10-28): "ous version of this page are moved over automatically. Sharing a board without an account Share packs the whol" | no sign of it in the source of /kanban/simple/ |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "lendar and flow charts in your browser. WIP limits · checklists · due dates · share links. Saved on this devic" | void-live-deploy/kanban/simple/index.html:65 `ban/teams/">Kanban board with WIP limits and swimlanes</a> <a href="/calendar/">Calendar</` |
| A Pomodoro timer and time tracking | Power | have | its live page (2026-10-28): "ng Tool — jasperbernaers.com whiteboard Pomodoro Timer Online — Free Focus Timer with Tasks & Stats pomodoro D" | void-live-deploy/lib/kanban-ui.js:14 `start: 'Start', stop: 'Stop', pomodoro: 'Pomodoro (25 min)', cancel: 'Cancel', close: 'Clo` |
| Board templates | Boards | have | its live page (2026-10-28): "this browser as you go. 1 Start from a template The example board has three columns and a few cards to try. P" | void-live-deploy/lib/kanban-ui.js:15 `e left', right: 'Move right', template: 'Start from', tBasic: 'To do, Doing, Done', tFlow:` |
| Export and import | Files | have | its live page (2026-10-28): "nd clearing site data deletes them. Use Export, import, backup in the ⋯ menu to download a backup of all board" | void-live-deploy/kanban/simple/index.html:62 `go. Share a board as a link, export and import it as JSON. Kept on this device, no accoun` |
| Add-ons and integrations | Power | missing | its live page (2026-10-28): "l-time collaboration, notifications and integrations, and their free plans often cap users, boards or storage." | no sign of it in the source of /kanban/simple/ |
| Works offline | Apps | have | its live page (2026-10-28): "ates, a calendar and flow charts, free, offline-capable and private. It is ideal for personal work, a freelanc" | void-live-deploy/kanban/simple/index.html:66 `anywhere) and the page works offline after one visit. Export a board as JSON to keep a co` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): ". WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kanban board Bo" | void-live-deploy/lib/kanban-ui.js:13 `share: 'Share link', archive: 'Archive', archived: 'Archived cards', restore: 'Restore` |
| Tune with the microphone | Tuning | have | every site of this kind offers it | void-live-deploy/tuner/index.html:104 `live="polite">–<small id="hz">Turn the microphone on and play a note</small></div>` |
| A needle that shows flat or sharp | Tuning | have | its live page (2026-10-28): "ans work is piling up in that column. A flat done band means nothing is being finished. Choose 14, 30, 60 or 9" | void-live-deploy/tuner/index.html:106 `meter" role="img" aria-label="How flat or sharp the note is"><b></b><i id="needle"></i></d` |
| Instruments and alternate tunings | Tuning | have | every site of this kind offers it | void-live-deploy/tuner/index.html:103 `><option value="guitar-dropd">Guitar, drop D</option><option value="guitar-dadgad">Guitar,` |
| Reference tones to tune by ear | Tuning | have | its live page (2026-10-28): "ly throughput over those four weeks and plays out 2,000 imagined futures, each time drawing a random day from" | void-live-deploy/tuner/index.html:115 `0 auto" aria-pressed="false">Play the note</button></div>` |
| Change the reference pitch (A = 440) | Settings | have | every site of this kind offers it | void-live-deploy/tuner/index.html:103 `4" min="410" max="470" value="440" step="1" inputmode="numeric"></label></div>` |
| JasperBernaers.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| deep work | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &#9749; Support me | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| apps | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ← about me | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Insights | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 📝 Notepad Plain notes in your browser | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| deep work log | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| buy me a coffee | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ' + html + ' | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ' + ic('x') + 'Clear | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ' + n + ' ' + esc(col.name) + ' | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
