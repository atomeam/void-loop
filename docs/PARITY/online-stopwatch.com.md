# online-stopwatch.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: online-stopwatch.com (https://www.online-stopwatch.com/)
- Verse: /stopwatch/ (stopwatch, tower gate 11 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Online Stopwatch"
- History: [docs/HISTORY/online-stopwatch.com.md](../HISTORY/online-stopwatch.com.md)

**Match: 29%**: 5 have, 1 partial, 1 missing, 12 unreviewed, of 19 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A stopwatch | Timing | have | its live page (2026-10-28): "Online Stopwatch Online Stopwatch Online-Stopwatch Log In! Join Premium! Search Change Language Menu Race Tim" | void-live-deploy/stopwatch/index.html:71 `<h1>Stopwatch, timer, interval timer and chess clock</h1>` |
| A countdown timer with an alarm | Timing | have | its live page (2026-10-28): "emium! Search Change Language Menu Race Timers Race Timers - Character Race Timers with Random Results :-) Cla" | void-live-deploy/stopwatch/index.html:71 `<h1>Stopwatch, timer, interval timer and chess clock</h1>` |
| Lap times | Timing | have | its live page (2026-10-28): "s, anywhere really... :-) Split Timer - Lap Timer Split Lap Timer - Split Laps, record times... :-) Egg Timer" | void-live-deploy/stopwatch/index.html:74 `n><button type="button" id="swlap" disabled>Lap</button><button type="button" id="swreset"` |
| Full screen | Display | have | its live page (2026-10-28): "m Feature! :-) Use the Online Stopwatch Full Screen Use the Online Stopwatch Full Screen Go Fullscreen! - Use" | void-live-deploy/stopwatch/index.html:246 `ent.exitFullscreen() : $(tab).requestFullscreen(); } catch (_) {} } });` |
| Classroom timers with themes and sounds | Display | missing | its live page (2026-10-28): "in Premium! Search Change Language Menu Race Timers Race Timers - Character Race Timers with Random Results :-" | no sign of it in the source of /stopwatch/ |
| A clock and alarm clock | Timing | have | its live page (2026-10-28): "No numbers. No Stress. No Problems :-) Clocks Clocks - Try our range of clocks - talking, fun, just a choice" | void-live-deploy/stopwatch/index.html:75 `lap · R resets · M mutes the alarm · F full screen · the fastest and slowest laps are mar` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "watch Online Stopwatch Online-Stopwatch Log In! Join Premium! Search Change Language Menu Race Timers Race Tim" | void-live-deploy/stopwatch/index.html:125 `=> { try { return JSON.parse(localStorage.getItem(KEY) // 'null'); } catch (_) { return n` |
| Join Premium! | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Change Language | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Random Name Pickers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Random Number Generators | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chance Games | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Group Generators | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tally Counters | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Add to My Page! | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Go Ad Free! | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Dates | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Time management | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Metronome | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
