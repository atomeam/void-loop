# any.do: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: any.do (https://www.any.do/calendar)
- Verse: /calendar/ (calendar: any.do, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Best Calendar App / Free & Simple Calendar / Any.do"
- History: [docs/HISTORY/any.do.md](../HISTORY/any.do.md)

**Match: 53%**: 17 have, 1 partial, 3 missing, 12 unreviewed, of 33 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | its live page (2026-10-28): "app for life & work. Control your day, week and month with calendar events and tasks in a single view. It's t" | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "gile management Content calendar Budget Event management Inventory tracking Design sprint Roadmap +100 more te" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | its live page (2026-10-28): "lizabeth J. Busy Mom 5 stars rating The recurring task feature in Any.do is great for setting up a routine for" | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | its live page (2026-10-28): "alendar for Firefox Calendar for Chrome Reminders Reminders for iPhone Reminders for Android Reminders for iPa" | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): "enda. Any.do works perfectly with other calendars such as Google Calendar, iCloud, Outlook and more. It's the" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | its live page (2026-10-28): "day to day tasks in one app will dramatically help you focus on the things that really matter. Daily agenda o" | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | its live page (2026-10-28): "ately Google Drive OneDrive Dropbox Box Imports Trello Clickup Asana Monday.com Todoist Solutions Plans Teams" | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "ite calendar Apple calendar Everyone is invited Always know what's coming next on your agenda. Any.do works pe" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | every site of this kind offers it | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Booking pages for appointments | Scheduling | missing | its live page (2026-10-28): "e Dad 5 stars rating Tracking pediatric appointments and vaccinations is effortless with Any.do's calendar and" | no sign of it in the source of /calendar/ |
| Tasks beside the calendar | Tasks | have | its live page (2026-10-28): "ogo Any.do logo Toggle menu Meet Any.do To-do list & Tasks To-do list for iPhone To-do list for Android To-do" | void-live-deploy/calendar/index.html:160 `on type="submit" id="taskBtn">Add task</button></form>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| Search events | Events | have | its live page (2026-10-28): "App Store or Google Play Store. Simply search for Any.do, and you’ll find the calendar app download option. O" | void-live-deploy/calendar/index.html:142 `class="vh" for="sq" id="sqL">Search events</label><input type="search" id="sq" placeholde` |
| A video call link on an event | Events | have | its live page (2026-10-28): ".do Any.do logo Any.do logo Toggle menu Meet Any.do To-do list & Tasks To-do list for iPhone To-do list for An" | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| A family or group calendar | Sharing | have | its live page (2026-10-28): "onday.com Todoist Solutions Plans Teams Family Premium Personal By use case Project management Marketing Sales" | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| Shopping and to-do lists | Tasks | missing | its live page (2026-10-28): "y.do logo Toggle menu Meet Any.do To-do list & Tasks To-do list for iPhone To-do list for Android To-do list f" | no sign of it in the source of /calendar/ |
| Print a calendar | Files | have | its live page (2026-10-28): "ve Software development HR By template Sprint planning Agile management Content calendar Budget Event manageme" | void-live-deploy/calendar/index.html:224 `<button type="button" id="printBtn" title="Print what is on screen: the month, week, d` |
| Events added from your email | Events | missing | its live page (2026-10-28): "t & collaboration Integrations WhatsApp Gmail Slack Zapier Siri Jira Trello Monday.com Clickup Asana Todoist F" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "on Any.do for Gmail Pricing Book a demo Login Working in a team of 10 people or more? Schedule a free onboardi" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "bitious goals. Get Started - It's Free! Google play store Apple AppStore Any.do to-do list app for iPhone Any." | void-live-deploy/calendar/index.html:651 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | have | its live page (2026-10-28): "management processes. Ethan S. Software Developer 5 stars rating Our team’s project management and deadline tr" | void-live-deploy/calendar/index.html:308 `const r = await fetch('/api/icsfeed?url=' + encodeURIComponent(c.url)).then(async (x` |
| Project management | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner (My Day) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for iPhone | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Android | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for iPad | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Mac | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for PC | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Web | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Desktop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Windows | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Siri | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Daily planner for Firefox | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
