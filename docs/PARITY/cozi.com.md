# cozi.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: cozi.com (https://www.cozi.com/)
- Verse: /calendar/ (calendar: cozi.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Cozi Family Calendar &amp; Organizer App / Free Shared Planner"
- History: [docs/HISTORY/cozi.com.md](../HISTORY/cozi.com.md)

**Match: 50%**: 14 have, 1 partial, 2 missing, 12 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Day, week, month and year views | Views | have | its live page (2026-10-28): "e family sees the same plan. 3 Add this week's plans Type them in, or bring them in from Google, Outlook, or A" | void-live-deploy/calendar/index.html:198 `d="vYear" aria-pressed="false">Year</button>` |
| Make, edit and delete events | Events | have | its live page (2026-10-28): "ear Start with Max What's included R AI Event Import: emails → events R AI Meal Planner R AI Recipe Creator Co" | void-live-deploy/calendar/index.html:133 `ton type="button" id="newBtn">New event</button>` |
| Repeating events | Events | have | every site of this kind offers it | void-live-deploy/calendar/index.html:126 `th, week and day; events that repeat, remind and invite; everything stays on this device a` |
| Reminders and notifications | Events | have | its live page (2026-10-28): "ere at a glance, color-coded by person. Reminders and agenda emails mean fewer missed pickups and double-booke" | void-live-deploy/calendar/index.html:138 `pe="button" id="allow" hidden>Allow notifications</button>` |
| Several calendars with colours | Calendars | have | its live page (2026-10-28): ". Works with Google, Outlook, and Apple calendars. Get Cozi Free N Cozi is free N iPhone, Android & Web N One" | void-live-deploy/calendar/index.html:168 `type="submit" id="calAddBtn">Add calendar</button></form>` |
| Import and export .ics files | Files | have | its live page (2026-10-28): "art with Max What's included R AI Event Import: emails → events R AI Meal Planner R AI Recipe Creator Compare" | void-live-deploy/calendar/index.html:221 `icsFile" class="vh" id="icsL">Import .ics</label>` |
| Invite people and collect replies | Sharing | have | its live page (2026-10-28): "count On iPhone, Android, or the web. 2 Invite your family Everyone shares one account and signs in their own" | void-live-deploy/calendar/index.html:210 `o the invitees with the .ics">Invite by email</button>` |
| Share a calendar | Sharing | have | its live page (2026-10-28): "Family Calendar & Organizer App / Free Shared Planner Cozi Family Organizer &raquo; Feed Log in to Cozi Sign" | void-live-deploy/calendar/index.html:209 `link that carries this event">Share link</button>` |
| Tasks beside the calendar | Tasks | have | its live page (2026-10-28): "Overview Calendar Shopping Lists Family To-Do Lists Recipes &#038; Meal Planner Pricing Compare Plans Family R" | void-live-deploy/calendar/index.html:160 `on type="submit" id="taskBtn">Add task</button></form>` |
| Time zones | Settings | have | every site of this kind offers it | void-live-deploy/calendar/index.html:166 `length="60" placeholder="e.g. America/New_York" style="flex:1 1 180px"></div>` |
| Search events | Events | have | its live page (2026-10-28): "tory and Mission Contact Us Select Page Search &hellip; Family Calendar App and Organizer The whole family. Fi" | void-live-deploy/calendar/index.html:142 `class="vh" for="sq" id="sqL">Search events</label><input type="search" id="sq" placeholde` |
| A video call link on an event | Events | have | its live page (2026-10-28): "alendars and sports team schedules from TeamSnap, SportsEngine, and more. Get Cozi Free LOVED BY FAMILIES Why" | void-live-deploy/calendar/index.html:246 `abel for="eVideo" id="lVideo">Video call</label><div class="row" style="margin:0"><input i` |
| A family or group calendar | Sharing | have | its live page (2026-10-28): "Cozi Family Calendar & Organizer App / Free Shared Planner Cozi Family Organizer &raquo; Feed Log in to Cozi" | void-live-deploy/calendar/index.html:182 `<div class="seg" role="group" aria-label="Going?"><button type="button" data-a="yes` |
| Shopping and to-do lists | Tasks | missing | its live page (2026-10-28): "ly Organizer Features Overview Calendar Shopping Lists Family To-Do Lists Recipes &#038; Meal Planner Pricing" | no sign of it in the source of /calendar/ |
| Events added from your email | Events | missing | its live page (2026-10-28): "r-coded by person. Reminders and agenda emails mean fewer missed pickups and double-booked Saturdays. Explore" | no sign of it in the source of /calendar/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "nner Cozi Family Organizer &raquo; Feed Log in to Cozi Sign up for Cozi Cozi Family Organizer Cozi Family Orga" | void-live-deploy/calendar/index.html:293 `const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "t for the whole family 4.8 ★★★★★ on the App Store 399K App Store ratings "Must-have app" TODAY show Download o" | void-live-deploy/calendar/index.html:658 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Sign up for Cozi | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipes &#038; Meal Planner | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compare Plans | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Getting Started | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FAQs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Story and Mission | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Cozi Free | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Explore the calendar → | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
