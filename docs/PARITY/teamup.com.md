# teamup.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: teamup.com (https://www.teamup.com/)
- Verse: /calendar/ (calendar: teamup.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Customizable shared calendar for business"
- History: [docs/HISTORY/teamup.com.md](../HISTORY/teamup.com.md)

**Match: 52%**: 15 have, 1 partial, 2 missing, 12 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | its live page (2026-10-28): "ntments (e.g. hoof groomer comes in two weeks). Overlaps of appointments become immediately visible and the ca" | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "access Shareable link access Shareable event pages Single sign-on (SSO) support INTEGRATION API documentation" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): "levels of access control Sync / combine calendars CUSTOMIZABLE Custom fields Customizable access control Smart" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | its live page (2026-10-28): ") support INTEGRATION API documentation iCalendar (.ics) feeds Zapier integration Microsoft Teams Solutions TE" | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | its live page (2026-10-28): "NTEGRATION API documentation iCalendar (.ics) feeds Zapier integration Microsoft Teams Solutions TEAMS Operati" | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Share a calendar | Sharing | have | its live page (2026-10-28): "Customizable shared calendar for business Teamup.com &raquo; Feed Teamup.com &raquo; Comments Feed oEmbed (JS" | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Find a time when everyone is free | Scheduling | have | its live page (2026-10-28): "SES Organize teams Schedule work Manage availability Share events Resources EXPLORE Embedded calendars Case st" | void-live-deploy/calendar/index.html:137 `="false" aria-controls="find">Find a time</button>` |
| Booking pages for appointments | Scheduling | missing | its live page (2026-10-28): "bility Whether it&#8217;s a simple room booking system or complex job schedules for field crews, there&#8217;s" | no sign of it in the source of /calendar/ |
| Tasks beside the calendar | Tasks | have | its live page (2026-10-28): "void scheduling conflicts, and delegate tasks without losing sight of the big picture. 🙂 Keep all the details" | void-live-deploy/calendar/index.html:160 `on type="submit" id="taskBtn">Add task</button></form>` |
| Time zones | Settings | have | its live page (2026-10-28): "e people are scattered over probably 20 time zones&#8230; The functionality of Teamup is critical to supportin" | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| A video call link on an event | Events | have | its live page (2026-10-28): "ics) feeds Zapier integration Microsoft Teams Solutions TEAMS Operations Event planning Workforce Training Mar" | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| A family or group calendar | Sharing | have | its live page (2026-10-28): "calendar access for each individual and group. Learn more User Story: Hope Channel &#8220; Hope Channel was hi" | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| Print a calendar | Files | have | its live page (2026-10-28): "tutorial TEMPLATES Templates library → Printable Calendars Pricing Login Get Started Select Page The only cus" | void-live-deploy/calendar/index.html:224 `<button type="button" id="printBtn" title="Print what is on screen: the month, week, d` |
| Events added from your email | Events | missing | its live page (2026-10-28): ". 👋 Communicate efficiently with fewer emails, messages, Excel sheets, or copy-pasting information. 🤝 Provid" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "s library → Printable Calendars Pricing Login Get Started Select Page The only customizable calendar for busin" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| A public API | Developers | have | its live page (2026-10-28): "ingle sign-on (SSO) support INTEGRATION API documentation iCalendar (.ics) feeds Zapier integration Microsoft" | void-live-deploy/calendar/index.html:308 `const r = await fetch('/api/icsfeed?url=' + encodeURIComponent(c.url)).then(async (x` |
| Teamup.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FEATURE HIGHLIGHTS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| View all key features → | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 12 Calendar views | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 9 levels of access control | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CUSTOMIZABLE | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Custom fields | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customizable access control | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Smart color-coding | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Link parameters | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FLEXIBLE ACCESS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
