# calendar.zoho.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: calendar.zoho.com (https://calendar.zoho.com/)
- Verse: /calendar/ (calendar: calendar.zoho.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200
- History: [docs/HISTORY/calendar.zoho.com.md](../HISTORY/calendar.zoho.com.md)

**Match: 81%**: 13 have, 0 partial, 3 missing, 0 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | every site of this kind offers it | void-live-deploy/calendar/index.html:229 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:142 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:135 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:148 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | every site of this kind offers it | void-live-deploy/calendar/index.html:199 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:200 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:252 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:241 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | every site of this kind offers it | void-live-deploy/calendar/index.html:240 `link that carries this event">Share link</button>` |
| Booking pages for appointments | Scheduling | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:169 `"button" class="go" id="bkGo">Make a booking link</button></div>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:197 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| Search events | Events | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:152 `class="vh" for="sq" id="sqL">Search events</label><input type="search" id="sq" placeholde` |
| A video call link on an event | Events | have | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | void-live-deploy/calendar/index.html:277 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| Working hours that others see | Settings | missing | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | no sign of it in the source of /calendar/ |
| Hide weekends in the week and month views | Views | missing | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | no sign of it in the source of /calendar/ |
| A default event length and reminder | Settings | missing | studied by hand: calendar.zoho.com offers this (https://calendar.zoho.com/) | no sign of it in the source of /calendar/ |
