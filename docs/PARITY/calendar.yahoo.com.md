# calendar.yahoo.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: calendar.yahoo.com (https://calendar.yahoo.com/)
- Verse: /calendar/ (calendar: calendar.yahoo.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Calendar"
- History: [docs/HISTORY/calendar.yahoo.com.md](../HISTORY/calendar.yahoo.com.md)

**Match: 58%**: 7 have, 1 partial, 0 missing, 5 unreviewed, of 13 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | every site of this kind offers it | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | every site of this kind offers it | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Share a calendar | Sharing | have | every site of this kind offers it | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "News Finance Sports Entertainment Life Sign in" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| News | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sports | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Entertainment | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Life | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
