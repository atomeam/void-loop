# bbc.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: bbc.com (https://www.bbc.com/sport)
- Verse: /scores/ (sports: bbc.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "BBC Sport - Scores, Fixtures, News - Live Sport"
- History: [docs/HISTORY/bbc.com.md](../HISTORY/bbc.com.md)

**Match: 43%**: 10 have, 0 partial, 0 missing, 13 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "BBC Sport - Scores, Fixtures, News - Live Sport BBC BBC Homepage Skip to content Accessibility Help Your acco" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "BBC Sport - Scores, Fixtures, News - Live Sport BBC BBC Homepage Skip to content Accessibility Help Your acco" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "d Martial Arts Motorsport Netball Rugby League Rugby Union Snooker Swimming Tennis Full Sports A-Z More from S" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | every site of this kind offers it | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "& FAQs Home Football Scores & Fixtures Follow Your Football Team Quizzes BBC Sport Live . EFL Cup: Man City e" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Player pages and stats | Stats | have | its live page (2026-10-28): "m Wrexham fined for fielding ineligible players Attribution Wrexham Posted 2 hours ago 2h Wrexham duo Callum O" | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "BBC Sport - Scores, Fixtures, News - Live Sport BBC BBC Homepage Skip to content Accessibility Help Your acco" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Highlights and video | Media | have | its live page (2026-10-28): "Health Culture Arts Travel Earth Audio Video Live More menu More menu Search BBC Search BBC Home News Sport B" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Search teams and players | Scores | have | its live page (2026-10-28): "th Audio Video Live More menu More menu Search BBC Search BBC Home News Sport Business Technology Health Cultu" | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Accessibility Help | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sport | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Business | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Technology | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Travel | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Earth | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Audio | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Football | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cricket | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
