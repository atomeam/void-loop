# besoccer.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: besoccer.com (https://www.besoccer.com/)
- Verse: /scores/ (sports: besoccer.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "BeSoccer Livescore: Today's live soccer scores"
- History: [docs/HISTORY/besoccer.com.md](../HISTORY/besoccer.com.md)

**Match: 50%**: 13 have, 1 partial, 0 missing, 13 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Live scores as games happen | Scores | have | its live page (2026-10-28): "BeSoccer Livescore: Today's live soccer scores noscript image Are you of legal age? YES NO Confirm if you are" | void-live-deploy/scores/index.html:91 `s="sub" id="sub" data-k="sub">Live scores, schedules and standings for football, NBA, NFL,` |
| Fixtures and results by day | Scores | have | its live page (2026-10-28): "BeSoccer Livescore: Today's live soccer scores noscript image Are you of legal age? YES NO Confirm if you are" | void-live-deploy/scores/index.html:109 `n" id="dTom" data-k="tomorrow">Tomorrow</button>` |
| Many leagues and sports | Scores | have | its live page (2026-10-28): "iga Round 11 Competition icon Champions League Champions League Round 4 Competition icon Most wanted players A" | void-live-deploy/scores/index.html:93 `av class="chips" id="leagues" aria-label="League">` |
| Standings and tables | Tables | have | every site of this kind offers it | void-live-deploy/scores/index.html:99 `sed="false" data-k="standings">Standings</button><button type="button" id="tMine" aria-pre` |
| A match page: lineups, events and stats | Match | have | its live page (2026-10-28): "ther websites PFDB BeSoccer Pro API API Lineups Lineups RF Publicity Company Company Empleo Jobs avatar_user E" | void-live-deploy/scores/index.html:124 `and schedules for 12 leagues, box scores and play by play, standings, team pages, favourit` |
| Favourite teams | Personal | have | its live page (2026-10-28): "Players Transfers Find match Televised Favourites Ajustes Settings Ajustes Languages Google Play App Store Be" | void-live-deploy/scores/index.html:99 `pressed="false" data-k="mine">My teams</button></div>` |
| Player pages and stats | Stats | have | its live page (2026-10-28): "Matches News Explore Competitions Teams Players Transfers Find match Televised Favourites Ajustes Settings Aju" | void-live-deploy/scores/index.html:124 `for teams, events, venues and players, stories written by Verse from the data, and a free` |
| Sports news | News | have | its live page (2026-10-28): "ipal Usuario User Usuario Login Matches News Explore Competitions Teams Players Transfers Find match Televised" | void-live-deploy/scores/index.html:100 `d="false" data-k="reportsTab">Verse reports</button>` |
| Fantasy games and pick'em | Games | have | its live page (2026-10-28): ") and present in a state where Underdog Fantasy operates. Terms apply. Concerned with your play? Call 1-800-MY" | void-live-deploy/scores/index.html:100 `essed="false" data-k="pickem">Pick'em</button><button type="button" id="tWhat" aria-presse` |
| Odds | Games | have | its live page (2026-10-28): "Languages Settings Show news Show news Odds format Select payment format EU (1.50) UK (1/2) US (-200) Hong Ko" | void-live-deploy/scores/index.html:125 `teams stay on this device. No odds, no betting, no fantasy.</p>` |
| Search teams and players | Scores | have | its live page (2026-10-28): "e Find match Televised Favourites Close Search... Search... Search by voice Search... Close Most viewed matche" | void-live-deploy/scores/index.html:112 `><label class="vh" for="find">Search teams</label><input type="search" id="find" placehold` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "tar menú principal Usuario User Usuario Login Matches News Explore Competitions Teams Players Transfers Find m" | void-live-deploy/scores/app.js:9 `{ try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object'` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ites Ajustes Settings Ajustes Languages Google Play App Store BeSoccer BeSoccer Matches News Explore Competiti" | void-live-deploy/scores/index.html:130 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | have | its live page (2026-10-28): "ure. x Other websites PFDB BeSoccer Pro API API Lineups Lineups RF Publicity Company Company Empleo Jobs avata" | void-live-deploy/scores/app.js:29 `ea.p; } else j = await (await fetch('/api/scores?' + qs, { headers: { accept: 'application` |
| YES | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Matches | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Explore | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Competitions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Transfers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Find match | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Televised | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Empleo Jobs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| avatar_user | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Español | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
