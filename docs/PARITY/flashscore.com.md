# flashscore.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: flashscore.com (https://www.flashscore.com/)
- Verse: /scores/ (sports: flashscore.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Football Live Scores, Latest Football Results / Flashscore.com"
- History: [docs/HISTORY/flashscore.com.md](../HISTORY/flashscore.com.md)

**Match: 46%**: 12 have, 0 partial, 1 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "Football Live Scores, Latest Football Results / Flashscore.com Football Live Scores, Latest Football Results," | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "d in the Live scores section). Find all today's/tonight's football scores on Flashscore.com. The football live" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "ootball Results, EPL, LaLiga, Champions League Skip to main content Go to main page Header Scores News TRANS_D" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | its live page (2026-10-28): "s, results , fixtures , LaLiga news and standings . EPL 2026/27 live on Flashscore.com! Follow English Premier" | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "previews of football matches, detailed statistics (shots on goal, ball possession, expected goals (xG), corne" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "_BOOKMARK_BONUS_OFFERS Search Open menu Favorites - Football Tennis Basketball Hockey Golf Formula 1 Baseball" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Goal and score alerts | Personal | missing | studied by hand: flashscore.com offers this (https://www.flashscore.com/) | no sign of it in the source of /scores/ |
| Player pages and stats | Stats | have | its live page (2026-10-28): "s, fouls etc.), odds comparison, unique player ratings, average team rating, player of the match, H2H stats, l" | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "n content Go to main page Header Scores News TRANS_DETAIL_BOOKMARK_BONUS_OFFERS Search Open menu Favorites - F" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Highlights and video | Media | have | its live page (2026-10-28): "ntary, match report, transfers, news or video highlights. In addition to football scores, football news , tran" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Odds | Games | have | its live page (2026-10-28): "ats, yellow and red cards, fouls etc.), odds comparison, unique player ratings, average team rating, player of" | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | its live page (2026-10-28): "News TRANS_DETAIL_BOOKMARK_BONUS_OFFERS Search Open menu Favorites - Football Tennis Basketball Hockey Golf Fo" | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ad it for free! iPhone/iPad application App Store Android application Google Play Lite version Odds and bettin" | void-live-deploy/scores/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| buwei.de | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Football | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FIFA | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Albania | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Algeria | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Andorra | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Angola | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Antigua & Barbuda | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Argentina | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Armenia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Aruba | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Australia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
