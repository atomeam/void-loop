# livescore.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: livescore.com (https://www.livescore.com/)
- Verse: /scores/ (sports: livescore.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "LiveScore / Today&#x27;s Live Football Scores, Fixtures &amp; Results"
- History: [docs/HISTORY/livescore.com.md](../HISTORY/livescore.com.md)

**Match: 44%**: 11 have, 0 partial, 1 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "LiveScore / Today&#x27;s Live Football Scores, Fixtures & Results livescore Scores Scores News News Favourite" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "LiveScore / Today&#x27;s Live Football Scores, Fixtures & Results livescore Scores Scores News News Favourite" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "with LiveScore! We cover all countries, leagues, and competitions in unbeatable detail. The number one destina" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | its live page (2026-10-28): "Football Scores, Results, Fixtures and Tables Keep up to date with today&#x27;s football fixtures and results" | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "at your fingertips. With match info and line-ups thrown into the mix, you need not look anywhere else for foot" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "sults livescore Scores Scores News News Favourites Favourites Select language icon Settings icon livescore Foo" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Goal and score alerts | Personal | missing | studied by hand: livescore.com offers this (https://www.livescore.com/) | no sign of it in the source of /scores/ |
| Sports news | News | have | its live page (2026-10-28): "tures & Results livescore Scores Scores News News Favourites Favourites Select language icon Settings icon liv" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Odds | Games | have | its live page (2026-10-28): "a League Scores Champions League Scores Betting Betting Sites UK Free Bets Betting Sites US Betting Sites ZA B" | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Spins US Casino Sites CA livescore logo Google play App store FAQ Contact Privacy Notice Advertise © 1998- 202" | void-live-deploy/scores/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| The site in other languages | Settings | have | its live page (2026-10-28): "Scores News News Favourites Favourites Select language icon Settings icon livescore Football Football Hockey" | void-live-deploy/scores/app.js:7 `const lang = navigator.language // 'en', FALLBACK = { story: 'Story', details: 'Details',` |
| Scores | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Settings icon | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Football Football | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Hockey Hockey | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Basketball Basketball | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tennis Tennis | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cricket Cricket | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| left arrow | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| arrow | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| TV Guide arrow | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cricket | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tennis | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
