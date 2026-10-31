# ESPN: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: ESPN (https://www.espn.com/)
- Verse: /scores/ (sports, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 202
- History: [docs/HISTORY/espn.md](../HISTORY/espn.md)

**Match: 80%**: 12 have, 0 partial, 2 missing, 1 unreviewed, of 15 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | every site of this kind offers it | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Goal and score alerts | Personal | missing | studied by hand: ESPN offers this (https://www.espn.com/) | no sign of it in the source of /scores/ |
| Player pages and stats | Stats | have | studied by hand: ESPN offers this (https://www.espn.com/) | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | studied by hand: ESPN offers this (https://www.espn.com/) | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Highlights and video | Media | have | studied by hand: ESPN offers this (https://www.espn.com/) | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Fantasy games and pick'em | Games | have | studied by hand: ESPN offers this (https://www.espn.com/) | void-live-deploy/scores/index.html:100 `essed="false" data-k="pickem">Pick'em</button><button type="button" id="tWhat" aria-presse` |
| Odds | Games | have | studied by hand: ESPN offers this (https://www.espn.com/) | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Watch games live | Media | missing | studied by hand: ESPN offers this (https://www.espn.com/) | no sign of it in the source of /scores/ |
