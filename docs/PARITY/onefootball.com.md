# onefootball.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: onefootball.com (https://www.onefootball.com/)
- Verse: /scores/ (sports: onefootball.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "OneFootball: Football News, Scores &amp; Latest Updates"
- History: [docs/HISTORY/onefootball.com.md](../HISTORY/onefootball.com.md)

**Match: 46%**: 12 have, 1 partial, 1 missing, 13 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "me page Matches Teams Manchester United Liverpool FC Arsenal Chelsea Manchester City Tottenham Hotspur Newcast" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "ighton; Bournemouth and Sunderland lead FIXTURES: 2026-10-28T19:54:18ZA wayward effort from Moisés Caicedo giv" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "otland All teams Competitions World Cup Premier League UEFA Champions League DFB-Pokal EFL Championship LaLiga" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | its live page (2026-10-28): "e Man Utd players who will welcome inevitable Michael Carrick sack Five Man Utd players who will welcome inevi" | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "r winner Kane! Here’s Bayern’s starting lineup against Magdeburg Without Ballon d’Or winner Kane! Here’s Bayer" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "he record champions are, of course, the favorites heading into the home game against the second-division... Ic" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Goal and score alerts | Personal | missing | studied by hand: onefootball.com offers this (https://www.onefootball.com/) | no sign of it in the source of /scores/ |
| Player pages and stats | Stats | have | its live page (2026-10-28): "appears to still have support from the playersA Manchester United player has lifted the lid... Icon: Evening" | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "OneFootball: Football News, Scores & Latest Updates and tags, as close as possible to the opening tag. Creati" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Highlights and video | Media | have | studied by hand: onefootball.com offers this (https://www.onefootball.com/) | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Odds | Games | have | its live page (2026-10-28): "ay · 13 hours ago Add to your bookmarks Betting See more FC Köln vs Union Berlin – Prediction, where to watch," | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | its live page (2026-10-28): "nal Friendlies All competitions FanPass Search Settings Sign In Sign In Join OneFootball: Football News, Score" | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ll competitions FanPass Search Settings Sign In Sign In Join OneFootball: Football News, Scores & Latest Updat" | void-live-deploy/scores/app.js:9 `{ try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object'` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Paper OFC White Paper More OneFootball App Store App Store Google Play Google Play OneFootball Merch OneFootb" | void-live-deploy/scores/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Matches | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manchester United | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arsenal | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chelsea | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manchester City | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tottenham Hotspur | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Newcastle United | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Celtic | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| West Ham United | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Rangers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| England | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
