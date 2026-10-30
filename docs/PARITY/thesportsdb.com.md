# thesportsdb.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: thesportsdb.com (https://www.thesportsdb.com/)
- Verse: /sports/ (sports: thesportsdb.com, tower gate 17 of 19)
- Live scan: 2026-10-28, HTTP 200, page title "TheSportsDB / Open Sports Database &amp; Free Sports API"
- History: [docs/HISTORY/thesportsdb.com.md](../HISTORY/thesportsdb.com.md)

**Match: 19%**: 3 have, 1 partial, 2 missing, 12 unreviewed, of 18 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Many sports, leagues, teams and players | Data | have | its live page (2026-10-28): "TheSportsDB / Open Sports Database & Free Sports API Main navigation TheSportsDB home Toggle navigation Data" | void-live-deploy/sports/index.html:89 `nav class="chips" aria-label="Sports with live scores"><a href="/scores/?league=epl">Premi` |
| Team badges and artwork | Data | missing | its live page (2026-10-28): "ssing Scores Missing Highlights Missing Artwork --> Missing Seasons Latest Transfers Latest Honours Latest Sta" | no sign of it in the source of /sports/ |
| A free public API | Developers | have | its live page (2026-10-28): "DB / Open Sports Database & Free Sports API Main navigation TheSportsDB home Toggle navigation Data Site Activ" | void-live-deploy/sports/index.html:96 `tier, described in <a href="/openapi.json">openapi.json</a>. No betting, no ads. Live sco` |
| Anyone can add and correct data | Community | missing | its live page (2026-10-28): "istings Sport Calendar Event Highlights Edit Contribute Guide Apply Editor Player Birthdays Missing Scores Mis" | no sign of it in the source of /sports/ |
| Event schedules and results | Data | have | its live page (2026-10-28): "ctions Browse Honours Browse Milestones Events --> TV Sport Listings Sport Calendar Event Highlights Edit Cont" | void-live-deploy/lib/scores.js:136 `5).map((x) => ({ r: str(x.gameResult, 1), opp: str(x.opponent && (x.opponent.abbreviation` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "s Player Charts Team Quick Image (Beta) Login Signup Navigation search Search TheSportsDB Search Welcome to Th" | void-live-deploy/sports/app.js:9 `= {}; try { mem = JSON.parse(localStorage.getItem('a2m.void.scores.v1')) // {}; } catch (` |
| Data | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Site Activity | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Venues | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Players | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Seasons | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Collections | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Honours | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Browse Milestones | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Player Birthdays | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Missing Scores | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Missing Highlights | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Missing Seasons | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
