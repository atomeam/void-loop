# sofascore.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: sofascore.com (https://www.sofascore.com/)
- Verse: /scores/ (sports: sofascore.com, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403
- History: [docs/HISTORY/sofascore.com.md](../HISTORY/sofascore.com.md)

**Match: 78%**: 7 have, 0 partial, 0 missing, 2 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | every site of this kind offers it | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Search teams and players | Scores | have | every site of this kind offers it | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.sofascore.com/ | not compared yet |
