# jasperbernaers.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: jasperbernaers.com (https://jasperbernaers.com/kanban-board/)
- Verse: /kanban/ (kanban: jasperbernaers.com, tower gate 14 of 16); /tuner/ (music: jasperbernaers.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Free Kanban Board Online — Board, List, Calendar &amp; Flow Charts, No Signup / JasperBernaers.com"
- History: [docs/HISTORY/jasperbernaers.com.md](../HISTORY/jasperbernaers.com.md)

**Match: 56%**: 18 have, 0 partial, 2 missing, 12 unreviewed, of 32 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Boards with lists and cards | Boards | have | its live page (2026-10-28): "Free Kanban Board Online — Board, List, Calendar & Flow Charts, No Signup / JasperBernaers.com JasperBernaers" | void-live-deploy/kanban/index.html:63 `ntro">Boards with columns and cards you drag (or move with the keyboard), labels, due date` |
| Drag cards between lists | Boards | have | its live page (2026-10-28): "tings to enforce it. 4 Pull work across Drag cards with the mouse, press and hold on a phone, or use Shift + a" | void-live-deploy/kanban/index.html:63 `ds with columns and cards you drag (or move with the keyboard), labels, due dates, checkli` |
| Card details: description, due date, labels | Cards | have | its live page (2026-10-28): "your browser. WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kan" | void-live-deploy/kanban/index.html:63 `e with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a ti` |
| Checklists in cards | Cards | have | its live page (2026-10-28): "ow charts in your browser. WIP limits · checklists · due dates · share links. Saved on this device, no account" | void-live-deploy/kanban/index.html:63 `keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeat` |
| Members, assignees and sharing | Teams | have | its live page (2026-10-28): ". WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kanban board Bo" | void-live-deploy/kanban/index.html:61 `columns, timers, limits and a share link</h1>` |
| Comments and activity | Teams | have | its live page (2026-10-28): "a card for its description, checklist, comments and history. 5 Switch views, read the flow Board, List, Calen" | void-live-deploy/kanban/index.html:63 `abels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive,` |
| Calendar, table and timeline views | Views | have | its live page (2026-10-28): "Free Kanban Board Online — Board, List, Calendar & Flow Charts, No Signup / JasperBernaers.com JasperBernaers." | void-live-deploy/kanban/index.html:66 `el">Use with</span> <a href="/calendar/">Calendar</a> <a href="/notes/">Notes</a> <a href=` |
| Automation rules | Power | missing | its live page (2026-10-28): "ous version of this page are moved over automatically. Sharing a board without an account Share packs the whol" | no sign of it in the source of /kanban/ |
| Work-in-progress limits and swimlanes | Boards | have | its live page (2026-10-28): "lendar and flow charts in your browser. WIP limits · checklists · due dates · share links. Saved on this devic" | void-live-deploy/kanban/index.html:61 `anban board: columns, timers, limits and a share link</h1>` |
| A Pomodoro timer and time tracking | Power | have | its live page (2026-10-28): "ng Tool — jasperbernaers.com whiteboard Pomodoro Timer Online — Free Focus Timer with Tasks & Stats pomodoro D" | void-live-deploy/kanban/index.html:61 `<h1>Kanban board: columns, timers, limits and a share link</h1>` |
| Board templates | Boards | have | its live page (2026-10-28): "this browser as you go. 1 Start from a template The example board has three columns and a few cards to try. P" | void-live-deploy/kanban/app.js:3 `"csv":1,"share":1,"colour":1,"templates":1}});` |
| Export and import | Files | have | its live page (2026-10-28): "nd clearing site data deletes them. Use Export, import, backup in the ⋯ menu to download a backup of all board" | void-live-deploy/kanban/index.html:63 `, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept` |
| Add-ons and integrations | Power | missing | its live page (2026-10-28): "l-time collaboration, notifications and integrations, and their free plans often cap users, boards or storage." | no sign of it in the source of /kanban/ |
| Works offline | Apps | have | its live page (2026-10-28): "ates, a calendar and flow charts, free, offline-capable and private. It is ideal for personal work, a freelanc" | void-live-deploy/kanban/index.html:63 `his device, no account, works offline.</p>` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): ". WIP limits · checklists · due dates · share links. Saved on this device, no account, no ads. Kanban board Bo" | void-live-deploy/kanban/index.html:61 `columns, timers, limits and a share link</h1>` |
| Tune with the microphone | Tuning | have | every site of this kind offers it | void-live-deploy/tuner/index.html:107 `live="polite">–<small id="hz">Turn the microphone on and play a note</small></div>` |
| A needle that shows flat or sharp | Tuning | have | its live page (2026-10-28): "ans work is piling up in that column. A flat done band means nothing is being finished. Choose 14, 30, 60 or 9" | void-live-deploy/tuner/index.html:109 `meter" role="img" aria-label="How flat or sharp the note is"><b></b><i id="needle"></i></d` |
| Instruments and alternate tunings | Tuning | have | every site of this kind offers it | void-live-deploy/tuner/index.html:106 `><option value="guitar-dropd">Guitar, drop D</option><option value="guitar-dadgad">Guitar,` |
| Reference tones to tune by ear | Tuning | have | its live page (2026-10-28): "ly throughput over those four weeks and plays out 2,000 imagined futures, each time drawing a random day from" | void-live-deploy/tuner/index.html:118 `0 auto" aria-pressed="false">Play the note</button></div>` |
| Change the reference pitch (A = 440) | Settings | have | every site of this kind offers it | void-live-deploy/tuner/index.html:106 `4" min="410" max="470" value="440" step="1" inputmode="numeric"></label></div>` |
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
