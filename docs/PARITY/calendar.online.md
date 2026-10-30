# calendar.online: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: calendar.online (https://calendar.online/)
- Verse: /calendar/ (calendar: calendar.online, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Online calendar for teams and groups - Calendar.online"
- History: [docs/HISTORY/calendar.online.md](../HISTORY/calendar.online.md)

**Match: 51%**: 17 have, 1 partial, 4 missing, 12 unreviewed, of 34 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | its live page (2026-10-28): "amily members. You can receive daily or weekly agenda reminders so that you can stay informed by email about u" | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "ty roster School calendar Never miss an event again Get reminders for your appointments via email or text mess" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | its live page (2026-10-28): "calendar Never miss an event again Get reminders for your appointments via email or text message . You can al" | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): "tructure your calendar with colored sub-calendars . For each access link, you can also define which sub-calend" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | its live page (2026-10-28): "ionally protected with a password. Practical for teams Due to the easy access via links and the extensive righ" | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | its live page (2026-10-28): "ensive rights management Printing / PDF export Appointment statistics Event export Event import Import interva" | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "Booking products/links Reminder by SMS Invite participants to events People can be invited to appointments. P" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | its live page (2026-10-28): "for / Teams easily organize, plan, and share Live Demo Create calendar Online calendar Desktop Online calenda" | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Find a time when everyone is free | Scheduling | have | its live page (2026-10-28): "pointment is specified in advance. Only free times are automatically offered in your calendar. You can choose" | void-live-deploy/calendar/index.html:137 `="false" aria-controls="find">Find a time</button>` |
| Booking pages for appointments | Scheduling | missing | its live page (2026-10-28): "s an event again Get reminders for your appointments via email or text message . You can also choose to have r" | no sign of it in the source of /calendar/ |
| Time zones | Settings | have | its live page (2026-10-28): "your own website Android-APP / iOS-APP Time zone support Times of events are automatically adjusted between u" | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| A video call link on an event | Events | have | its live page (2026-10-28): "Online calendar for teams and groups - Calendar.online You are using an outdated browser. Please upgrade your" | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| A family or group calendar | Sharing | have | its live page (2026-10-28): "Online calendar for teams and groups - Calendar.online You are using an outdated browser. Please upgrade your" | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| Shopping and to-do lists | Tasks | missing | its live page (2026-10-28): "he rights for each sub-calendar via the list that is now open. Then save the link and send it to the desired u" | no sign of it in the source of /calendar/ |
| Public holidays | Calendars | have | its live page (2026-10-28): "splay on info monitor Personal calendar Holiday planning Timetable Riding stable planning Room planning Duty r" | void-live-deploy/calendar/index.html:234 `tch: yours, birthdays, public holidays by country. Share a calendar by a view link or an e` |
| Print a calendar | Files | have | its live page (2026-10-28): "f users Comprehensive rights management Printing / PDF export Appointment statistics Event export Event import" | void-live-deploy/calendar/index.html:224 `<button type="button" id="printBtn" title="Print what is on screen: the month, week, d` |
| Events added from your email | Events | missing | its live page (2026-10-28): "o: What can Calendar Online do for you? Email Name create a free calendar Create calendar Easy access without" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "dar Create calendar Easy access without login Access your calendar via access links without a login. For examp" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "endar Tablet Online calendar smartphone Google Play 5.0 110 reviews App Store 4.6 37 reviews Video: What can C" | void-live-deploy/calendar/index.html:658 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Dark mode | Settings | missing | its live page (2026-10-28): "nel (SMS) 4) Save your event Is there a dark mode? Yes, it can be activated in the calendar in the top right c" | no sign of it in the source of /calendar/ |
| A public API | Developers | have | its live page (2026-10-28): "No Calendar.online branding Custom logo API interface Unlimited historical data Appointments are stored in the" | void-live-deploy/calendar/index.html:308 `const r = await fetch('/api/icsfeed?url=' + encodeURIComponent(c.url)).then(async (x` |
| upgrade your browser | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Calendar.online | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Start | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FAQs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Create calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Live Demo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Online calendar Desktop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Online calendar Tablet | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Online calendar smartphone | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| create a free calendar Create calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
