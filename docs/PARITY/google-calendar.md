# Google Calendar: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Google Calendar (https://calendar.google.com/)
- Verse: /calendar/ (calendar, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Google Calendar - Sign in to Access &amp; Edit Your Schedule"
- History: [docs/HISTORY/google-calendar.md](../HISTORY/google-calendar.md)

**Match: 83%**: 17 have, 1 partial, 3 missing, 0 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | every site of this kind offers it | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | every site of this kind offers it | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "you hear or see Not your computer? Use Guest mode to sign in privately. Learn more about using Guest mode (ex" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | every site of this kind offers it | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Find a time when everyone is free | Scheduling | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:137 `="false" aria-controls="find">Find a time</button>` |
| Booking pages for appointments | Scheduling | missing | studied by hand: Google Calendar offers this (https://calendar.google.com/) | no sign of it in the source of /calendar/ |
| Tasks beside the calendar | Tasks | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:160 `on type="submit" id="taskBtn">Add task</button></form>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| Search events | Events | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:142 `class="vh" for="sq" id="sqL">Search events</label><input type="search" id="sq" placeholde` |
| A video call link on an event | Events | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| A family or group calendar | Sharing | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| Shopping and to-do lists | Tasks | missing | its live page (2026-10-28): "used to distinguish humans from robots Listen and type the numbers you hear Type the text you hear or see Typ" | no sign of it in the source of /calendar/ |
| Public holidays | Calendars | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:234 `tch: yours, birthdays, public holidays by country. Share a calendar by a view link or an e` |
| Print a calendar | Files | have | studied by hand: Google Calendar offers this (https://calendar.google.com/) | void-live-deploy/calendar/index.html:224 `<button type="button" id="printBtn" title="Print what is on screen: the month, week, d` |
| Events added from your email | Events | missing | its live page (2026-10-28): "Sign in to continue to Google Calendar Email or phone Email or phone Forgot email? CAPTCHA image of text used" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Google Calendar - Sign in to Access & Edit Your Schedule Loading Loading Sign in to continue to Google Calend" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
