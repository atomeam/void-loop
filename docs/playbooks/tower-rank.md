# Tower rank: which Versus site next, from data

**Starts when:** a builder or the standing tower session needs the next floor (owner, 2026-10-26: "we should always go after the easiest site", "rank every tower site by real traffic"), or the monthly `Tower rank` workflow runs, or a floor or lane site is added to `lib/tower.js` (its rank is missing until the next run).

**Commands**
1. `node tools/tower-rank.mjs --next` (or `--next 10`): the next 10 floors Verse has not surpassed, smallest site first. Unranked sites come first, then the biggest Tranco rank number down to the leaders last; `*` marks a hand order. "Surpassed" is the gate's own: every aspect equal-and-better or better in `tower.evidence.json` (a regressed site is back in the list). Take the first one whose features are all free and on the device.
2. `node tools/tower-rank.mjs`: fetches the Tranco top-million list (`https://tranco-list.eu/top-1m.csv.zip`) and rewrites `void-live-deploy/tower.rank.json` (only our ~170 rivals, deterministic). A builder sandbox usually cannot reach tranco-list.eu: dispatch `.github/workflows/tower-rank.yml` instead (`gh workflow run tower-rank.yml`); it commits the file to main and starts the deploy. `--file top.csv` reads a local copy.
3. A hand order for an edge case (a tiny site that is data-heavy, a lane site that needs a licence): add `"<floor id>": <number>` to `order` in `domains/tower.order.json` and say why in `why`. The number stands in for the rank (a big number = small = earlier). The next run copies it into `tower.rank.json`; `--next` reads the file directly, so it counts at once.
4. The card: Versus shows each site's size (`#1,234`, or `unranked` outside the million) and a "By size" toggle (remembered in `a2m.void.tower.bysize`) that lists every site in this order.

**How to tell it worked:** `tower.rank.json` has a `list.date` and about 170 `ranks` (null = outside the million); `node --test tools/tower-rank.test.mjs` passes; the Versus card at 390 px shows a "By size" button under the score line and the sizes on the rows. Until the first workflow run the file is empty and the card shows no size at all (never invented).

**What it will not do:** measure traffic itself, rank by anything but Tranco, change which floor the ladder calls current (`lib/tower.js` keeps its own order; this is a second, size-based order for builders and the By size view), or edit `tower.evidence.json`.

**Mistakes to avoid:** matching the whole host (`int.soccerway.com` is `soccerway.com`, `bbc.co.uk` keeps three labels: add a new two-part suffix to `TWO_PART` in `lib/tower-rank.js` when a rival uses one); one rank for a path (`google.com/finance` ranks as `google.com`, so a giant's sub-product looks huge: give it a hand order); treating "unranked" as "easy" without looking (it only means outside the top million); committing a guessed rank; forgetting the credit line (Tranco, Le Pochat et al., NDSS 2019) that the file and the card keep.
