# timetreeapp.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: timetreeapp.com (https://timetreeapp.com/)
- Verse: /calendar/ (calendar: timetreeapp.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "TimeTree / An app for easy calendar sharing and communication"
- History: [docs/HISTORY/timetreeapp.com.md](../HISTORY/timetreeapp.com.md)

**Match: 50%**: 12 have, 1 partial, 0 missing, 12 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | its live page (2026-10-28): "filters Premium Go Premium for 4.49 USD/month (44.99 USD/annual) and enjoy ad-free calendars, file attachments" | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "your own plans to family schedules and events you care about. Use filters to see everything together, or swit" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): "t on Google Play Manage multiple shared calendars Group-based calendar sharing Easily share schedules with any" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | its live page (2026-10-28): "d-free calendars, file attachments, vertical view, prioritized events, and dedicated support, making sharing a" | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | its live page (2026-10-28): "es to events Vertical calendar view Pin important events Dedicated support Ad-free experience More More User S" | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "h any group. Create a calendar, send an invite, and you&#x27;re done. Family, hobbies, school; keep every grou" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | its live page (2026-10-28): "y Get it on Google Play Manage multiple shared calendars Group-based calendar sharing Easily share schedules w" | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| A family or group calendar | Sharing | have | its live page (2026-10-28): "e Play Manage multiple shared calendars Group-based calendar sharing Easily share schedules with any group. Cr" | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "mpany Information For Business Newsroom Login Get started for free All your plans, Together in one calendar Ap" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ll your plans, Together in one calendar App Store Download on the App Store Google Play Get it on Google Play" | void-live-deploy/calendar/index.html:663 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Newsroom | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get started for free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| View User Stories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See Details | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| TimeTree Premium | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| User Stories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Company Overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Brand Kit | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Public Calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| News | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Press Releases | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Updates | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
