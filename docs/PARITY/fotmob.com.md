# fotmob.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: fotmob.com (https://www.fotmob.com/)
- Verse: /scores/ (sports: fotmob.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "FotMob - Football Live Scores"
- History: [docs/HISTORY/fotmob.com.md](../HISTORY/fotmob.com.md)

**Match: 43%**: 10 have, 0 partial, 1 missing, 12 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "FotMob - Football Live Scores Top news Top news Skip to main content Link to Home Search News About About TV" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "Link to Home Search News About About TV schedules TV schedules Search Settings Download FotMob from Apple Stor" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "Live On TV By time Filter Collapse all leagues News See more ‌ FotMob is the essential football app. Matches" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "hedules About Careers Advertise with us Lineup Builder FAQ FIFA Rankings Men FIFA Rankings Women Predictor New" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "ematic or regular use is not permitted. Follow us Follow us Follow us on TikTok Follow us on Instagram Follow" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Goal and score alerts | Personal | missing | studied by hand: fotmob.com offers this (https://www.fotmob.com/) | no sign of it in the source of /scores/ |
| Player pages and stats | Stats | have | studied by hand: fotmob.com offers this (https://www.fotmob.com/) | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "FotMob - Football Live Scores Top news Top news Skip to main content Link to Home Search News About About TV" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Search teams and players | Scores | have | its live page (2026-10-28): "news Skip to main content Link to Home Search News About About TV schedules TV schedules Search Settings Down" | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Apple Store Download FotMob from Google App Store Download FotMob from Google App Store FotMob - Football Live" | void-live-deploy/scores/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| On TV | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| By time | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Matches | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Transfer Center | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Rumors | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Advertise with us | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FIFA Rankings Men | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FIFA Rankings Women | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Predictor | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Transparency act statement | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Filter | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
