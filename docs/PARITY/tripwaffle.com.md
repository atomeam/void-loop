# tripwaffle.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tripwaffle.com (https://tripwaffle.com/)
- Verse: /flights/trip/ (travel: tripwaffle.com, tower gate 16 of 18)
- Live scan: 2026-10-28, HTTP 200, page title "TripWaffle - Travel planning, fixed."
- History: [docs/HISTORY/tripwaffle.com.md](../HISTORY/tripwaffle.com.md)

**Match: 59%**: 13 have, 0 partial, 2 missing, 7 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | its live page (2026-10-28): "et it on Google Play Booking emails for flights, hotels, and tickets being magically transformed into a clean" | void-live-deploy/flights/trip/index.html:63 `<h1>Flight itinerary and layovers</h1>` |
| A price calendar and graph | Find | missing | its live page (2026-10-28): "ime stats page for the bragging. Phone, calendar and paper iPhone and Android apps, calendar sync, offline and" | no sign of it in the source of /flights/trip/ |
| Explore destinations on a map | Find | have | its live page (2026-10-28): "rest Gates, terminals, check-in times, maps, visa rules and local tips, attached to every stop. 3 Travel happ" | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Track prices | Alerts | have | its live page (2026-10-28): "d it becomes your trip. Then you get an alert the moment a gate, delay or baggage belt changes. Continue with" | void-live-deploy/lib/flights-ui.js:241 `PANELS.tracker = () => {` |
| Filters: stops, airlines, times | Find | have | its live page (2026-10-28): "o credit card, no upsell Works with any airline, hotel or booking site Private - forwarded emails auto-delete" | void-live-deploy/lib/flights-ui.js:95 `bel for="pv-al">' + esc(t('An airline’s own site')) + '</label><select id="pv-al"><option` |
| Distance and flight time | Data | have | its live page (2026-10-28): "AVE Renfe Yes Yes Award Flight Delta SkyMiles Yes Yes Budget Flight easyJet Yes Yes Taiwan B&B BRIO Hotel Taip" | void-live-deploy/lib/flights-ui.js:118 `'Pick two airports to see the Distance in km, miles and nm, the typical flight time, the t` |
| Airport details and codes | Data | have | its live page (2026-10-28): "rivate Shuttle TRANSVIP No Yes Istanbul Airport Transfer Yes Yes London Restaurant Circolo Popolare Yes Yes It" | void-live-deploy/flights/trip/index.html:64 `ad out of it: flight numbers, airports, dates and times, and the booking reference. Or typ` |
| Direct routes from an airport | Data | have | its live page (2026-10-28): "ather than a surprise. ✅ Check-in links Direct links to each airline&#039;s online check-in. Live flight track" | void-live-deploy/lib/flights-ui.js:114 `const s = pane('Route facts', 'facts'); s.insertAdjacentHTML('beforeend', '<div id="fa-o` |
| Plan a trip with several stops | Plan | have | its live page (2026-10-28): "TripWaffle - Travel planning, fixed. TripWaffle home TripWaffle TripWaffle Reviews How it works Features FAQ" | void-live-deploy/flights/trip/index.html:67 `public domain); the fares and trips you keep stay in this browser, and the page works offl` |
| Go on to book | Book | have | its live page (2026-10-28): "with Apple Sign-in with email Forward a booking. Get your itinerary. Send TripWaffle one confirmation email an" | void-live-deploy/flights/trip/index.html:64 `<p class="intro">Paste a booking confirmation and the flights are read out of it: flight` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "affle Reviews How it works Features FAQ Sign in More sign-in options Continue with Apple Sign-in with email Fo" | void-live-deploy/lib/flights-ui.js:78 `const sync = () => { for (const i of r.querySelectorAll('input')) i.checked = (i.value` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "rded emails auto-delete Download on the App Store Get it on Google Play Booking emails for flights, hotels, an" | void-live-deploy/flights/trip/index.html:70 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Works offline | Apps | have | its live page (2026-10-28): "iPhone and Android apps, calendar sync, offline and print. 📲 Native apps iOS and Android - same features as t" | void-live-deploy/flights/trip/index.html:67 `s browser, and the page works offline after one visit. Verse has no live fares: the prices` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "bookings can I forward? Flights and codeshares Hotels B&Bs, rentals Trains cars, ferries Tours tickets, events" | void-live-deploy/lib/flights-ui.js:283 `utton" id="i-link">' + esc(t('Copy a link to this trip')) + '</button> <button type="butto` |
| A public API | Developers | missing | its live page (2026-10-28): "ChatGPT needs a Plus plan or higher and Developer mode switched on. Your assistant can then read your trips, a" | no sign of it in the source of /flights/trip/ |
| Reviews | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| How it works | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All questions and answers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Safety guides | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Data | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| System status | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
