# timeanddate.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: timeanddate.com (https://www.timeanddate.com/)
- Verse: /time/?c=Tokyo (time zones, tower gate 12 of 14)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment&hellip;"
- History: [docs/HISTORY/timeanddate.com.md](../HISTORY/timeanddate.com.md)

**Match: 70%**: 7 have, 0 partial, 2 missing, 1 unreviewed, of 10 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| The exact time anywhere | Time | have | its live page (2026-10-28): "Just a moment&hellip; timeanddate logo Just a moment&hellip; Enable JavaScript and cookies to continue Ray ID" | void-live-deploy/time/index.html:68 `<h1>Time zones</h1>` |
| Time zone converter | Time | have | every site of this kind offers it | void-live-deploy/time/index.html:68 `<h1>Time zones</h1>` |
| Meeting planner across zones | Time | have | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | void-live-deploy/time/index.html:98 `a-labelledby="mh"><h2 id="mh">Meeting planner</h2>` |
| Calendars and holidays | Dates | have | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | void-live-deploy/time/index.html:110 `Friday: weekends only, public holidays are not taken off.</p>` |
| Countdowns and date calculators | Dates | missing | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | no sign of it in the source of /time/ |
| Sunrise, sunset and moon phases | Astronomy | have | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | void-live-deploy/time/index.html:80 `edby="sh"><h2 id="sh">Sun and moon today</h2>` |
| Weather | Extras | have | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | void-live-deploy/time/index.html:123 `watch and timer</a> <a href="/weather/">Weather</a> <a href="/tools/">All tools</a>` |
| Eclipses | Astronomy | missing | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | no sign of it in the source of /time/ |
| Daylight saving changes | Time | have | studied by hand: timeanddate.com offers this (https://www.timeanddate.com/) | void-live-deploy/time/index.html:76 `<p class="sub" id="dstnext"></p>` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.timeanddate.com/ | not compared yet |
