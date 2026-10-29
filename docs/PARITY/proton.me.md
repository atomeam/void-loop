# proton.me: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: proton.me (https://proton.me/calendar)
- Verse: /calendar/ (calendar: proton.me, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Proton Calendar: Your schedule is worth protecting / Proton"
- History: [docs/HISTORY/proton.me.md](../HISTORY/proton.me.md)

**Match: 46%**: 12 have, 1 partial, 2 missing, 12 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | every site of this kind offers it | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "Calendar automatically secures all your events with end-to-end encryption. Events received from people who use" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | its live page (2026-10-28): "s, modify invitations, and set multiple reminders, meaning you can spend less time managing your schedule and" | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): "ents received from people who use other calendars are secured with zero-knowledge encryption. In both cases, e" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Subscribe to a calendar by address | Calendars | have | its live page (2026-10-28): "back-and-forth. Proton Calendar automatically updates your availability, protects your schedule, and adds con" | void-live-deploy/calendar/index.html:169 `ton type="submit" id="feedBtn">Subscribe</button></form>` |
| Import and export .ics files | Files | have | studied by hand: proton.me offers this (https://proton.me/calendar) | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "itle, description, location, and people invited, are encrypted so not even we can see them. See all security f" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | every site of this kind offers it | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Find a time when everyone is free | Scheduling | have | its live page (2026-10-28): "ton Calendar automatically updates your availability, protects your schedule, and adds confirmed meetings to y" | void-live-deploy/calendar/index.html:137 `="false" aria-controls="find">Find a time</button>` |
| Booking pages for appointments | Scheduling | missing | its live page (2026-10-28): "Create a free account Features Security Appointment scheduling All features Resources Product news Pricing Per" | no sign of it in the source of /calendar/ |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| A video call link on an event | Events | have | its live page (2026-10-28): "ass Lumo AI AI assistant Lumo AI Proton Meet Video conferencing Proton Meet Proton Calendar Private scheduling" | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| Events added from your email | Events | missing | its live page (2026-10-28): "app (new window) Proton Mail Encrypted email Proton Mail Proton VPN VPN Proton VPN (new window) Proton Drive" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "otes Standard Notes (new window) Simple Login powered by Proton Hide-my-email aliases SimpleLogin (new window)" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| Personal | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Business | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Download | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Discover Proton | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Create a free account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Proton Calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Open menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Calendar for Business | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Start secure scheduling | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See all security features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Proton VPN (new window) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Standard Notes (new window) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
