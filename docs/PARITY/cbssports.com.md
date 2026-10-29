# cbssports.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: cbssports.com (https://www.cbssports.com/)
- Verse: /scores/ (sports: cbssports.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "CBS Sports / News, live scores, schedules, Fantasy, and more"
- History: [docs/HISTORY/cbssports.com.md](../HISTORY/cbssports.com.md)

**Match: 46%**: 12 have, 1 partial, 1 missing, 13 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "CBS Sports / News, live scores, schedules, Fantasy, and more site: media / arena: other / pageType: home-site" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "CBS Sports / News, live scores, schedules, Fantasy, and more site: media / arena: other / pageType: home-site" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "rts Watch Fantasy Betting Featured logo NFL logo NCAA FB logo NBA logo MLB logo UFC logo Golf SportsSoccer Soc" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | its live page (2026-10-28): "go Explore NFL NFL News Scores Schedule Standings Expert Picks Picks Odds Props Teams Stats Power Rankings Pro" | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "ngs Expert Picks Picks Odds Props Teams Stats Power Rankings Prospect Rankings Mock Drafts Video NFL Draft Sup" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "F Explore Fantasy Fantasy News Play Now My Teams Football Baseball UFC Pick'Em Get the Fantasy App Men's Brack" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Player pages and stats | Stats | have | its live page (2026-10-28): "Mock Drafts Video NFL Draft Super Bowl Players Injuries Transactions NFL Betting Fantasy Paramount + NFL Shop" | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "CBS Sports / News, live scores, schedules, Fantasy, and more site: media / arena: other / pageType: home-site" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Highlights and video | Media | have | its live page (2026-10-28): "Rankings Prospect Rankings Mock Drafts Video NFL Draft Super Bowl Players Injuries Transactions NFL Betting F" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Fantasy games and pick'em | Games | have | its live page (2026-10-28): "Sports / News, live scores, schedules, Fantasy, and more site: media / arena: other / pageType: home-site / s" | void-live-deploy/scores/index.html:100 `essed="false" data-k="pickem">Pick'em</button><button type="button" id="tWhat" aria-presse` |
| Odds | Games | have | its live page (2026-10-28): "ground Flyout Menu Sports Watch Fantasy Betting Featured logo NFL logo NCAA FB logo NBA logo MLB logo UFC logo" | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Watch games live | Media | missing | its live page (2026-10-28): "ews Leaderboard Schedule Stats Rankings Watch Live Masters Golf Betting Play Golf Northeast Golf Shop Northeas" | no sign of it in the source of /scores/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Projections Teams Stats Watch CFB Live Signing Day Transfer Portal Northeast 2027 Top Recruits Northeast 2027" | void-live-deploy/scores/app.js:9 `{ try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object'` |
| Scores | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Expert Picks | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Picks | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Props | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Power Rankings | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Prospect Rankings | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Mock Drafts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Super Bowl | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Injuries | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Transactions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Paramount + | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
