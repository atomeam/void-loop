# Tower rules (Versus)

The rules for the Versus tower: the card on the stage, /conquered/ and the /rival/ pages. Any agent that changes the tower must keep every rule. `tools/tower-rules.test.mjs` checks each one and fails the build when one breaks (it runs in `node tools/checks.mjs`).

1. **Real sites only.** Every floor is a real, named site that people use, with a feature study in `docs/PARITY` (at least 3 features). A stub, parked, empty, unstudied or random domain is never a floor. Frontier candidates that fail this stay in data (`t.notFloors`) but never reach the climb.
2. **Closest first.** The climb goes from the site Verse is closest to assimilating (at the bottom) to the hardest (at the top). Closeness is the assimilation percentage (`assimOf` in `lib/tower.js`). Page size never orders the climb. Far-future floors (Amazon, YouTube) stay at the top.
3. **No timed give-way.** Verse stays on a floor until it is truly assimilated. A floor never yields on a timer. Low-confidence or stale results are retried in the background, with no human step.
4. **Assimilated means verified.** A floor is assimilated only when every aspect is verified head to head against the live site, with the evidence kept. Leading on some aspects is not a win. An unverified win is never shown.
5. **One word.** The status word is "assimilated": the assimilated count, the current floor and the floors remaining. No other status words ("surpassed", "passed", "outclassed", "conquering" and the like).
6. **No boast words.** The tower never boasts. It states what is measured.
7. **The rival's own history.** The History on the card and on a rival page is the rival site's own story: its launch, who made it, how it grew, major changes and what it is known for. It comes from public sources (Wikipedia, the first Wayback Machine capture, the site's about page), each with its link. Nothing is invented; an unknown fact stays unknown.
8. **Every rival has a page.** Each rival has `/rival/?site=<slug>` (`rivals/<slug>.json`, written by `tools/rival-pages.mjs`). It shows the rival's history, its feature list and what Verse still lacks, with evidence.
9. **Combined Verse pages.** When several rivals do the same job, they share one Verse page (`LANE_PAGES` in `lib/tower.js`). That page carries the union of their features (`rivals/index.json`), and it counts as assimilated only when all of its rivals are.
10. **Rivals, not Verse.** The card shows the rivals and what Verse lacks. It never shows Verse's own dates or logs: no "since" date, no "updated" clock, no take or attempt log, and no link to the attempt history. Attempt records stay in data (`tower.target.json`) for Verse's own activity page (`attemptLogOf` in `skills/tower.js`).
11. **Plain names.** Sites are named in plain text, with no logos. Each floor shows its gate badge.
12. **Robots.** Studies and live checks respect robots.txt. A site whose robots rules ask bots to stay away is not opened live.
13. **Gaps are queued.** Every gap on the current floor goes into the build queue automatically.

The card layout: the assimilated count, the inventoried count, the average assimilation, the top 3 closest, the current floor with its gaps and its history, the next floors and the far floors.
