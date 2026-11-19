# thesportsdb.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: thesportsdb.com (https://www.thesportsdb.com/)
- Verse: /scores/?mode=sports (sports: thesportsdb.com, tower gate 17 of 19)
- Live scan: 2026-10-28, HTTP 200, page title "TheSportsDB / Open Sports Database &amp; Free Sports API"
- History: [docs/HISTORY/thesportsdb.com.md](../HISTORY/thesportsdb.com.md)

**Match: 39%**: 8 have, 1 partial, 0 missing, 13 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:95 `<h1 id="title">Live Sports Scores</h1>` |
| Fixtures and results by day | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:115 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:105 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | every site of this kind offers it | void-live-deploy/scores/index.html:130 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | every site of this kind offers it | void-live-deploy/scores/index.html:105 `pressed="false" data-k="mine">My teams</button></div>` |
| Search teams and players | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:118 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "s Player Charts Team Quick Image (Beta) Login Signup Navigation search Search TheSportsDB Search Welcome to Th" | void-live-deploy/scores/app.js:9 `{ try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object'` |
| A public API | Developers | have | its live page (2026-10-28): "DB / Open Sports Database & Free Sports API Main navigation TheSportsDB home Toggle navigation Data Site Activ" | void-live-deploy/scores/app.js:29 `ea.p; } else j = await (await fetch('/api/scores?' + qs, { headers: { accept: 'application` |
| TheSportsDB home | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Data | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Site Activity | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Venues | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Seasons | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Collections | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Honours | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Milestones | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Events | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| TV Sport Listings | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sport Calendar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
