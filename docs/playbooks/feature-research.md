# Feature research: every feature of every Versus site, by Verse itself

**The owner (2026-10-25):** "make sure you research all features of every site so we have everything", then "ok make it so verse does this on its own automatically also".

**Starts when:** `void-live-deploy/lib/tower.js` changes on main (a new floor or lane site has no features file yet), once a week (files 30 days old or more), or by hand (`gh workflow run feature-scan.yml -f floor="<floor id>"`). A builder about to work a floor reads its file first: `domains/features/<floor slug>.json` (`random generators` is `random-generators.json`; a lane site such as `translate: deepl.com` is filed under its lane's floor, `translate.json`).

## What it does

`tools/feature-scan.mjs` takes a floor and each of its lane sites, each at its OWN address (`siteOf` in `tools/tower-gate.mjs`), and for each site, one at a time:

1. reads `robots.txt` and skips what it disallows for every robot;
2. opens the home page at phone width as an ordinary Chrome, and up to six same-site pages whose links say features, pricing, how it works, FAQ, help or about (`pickLinks`; sign-in, legal and file links never);
3. refuses a page that is parked, a near-empty stub or a sign-in wall (`pageProblem`), and records why under the site's `problem`;
4. lists the features: one Workers AI call with a strict JSON prompt while the run's budget lasts (`FEATURE_SCAN_MAX_CALLS`, 12), else the heuristic (headings, list items, buttons of two words or more, pricing rows; `paid` from a price or a paid plan);
5. marks each against Verse's page for the floor (live, `VERSE_URL`): `has` when the feature's key words are on the page (all of them up to two, all but one past that), `partial` when some are, `missing` when none are, the words found and lacking as `verse_evidence` (`showsFeature` in `tools/tower-probes.mjs`). Anything shaped like a key is dropped (`tools/secret-scan.mjs`).

The file: a file people wrote keeps every section of theirs; the scan goes under `"auto": { "scanned", "sites", "gaps", "queued" }`. A floor with no file gets the whole file with `"source": "auto"`, which the scan may rewrite later (until a person writes over it; then the scan moves under `auto`).

Then the gaps go to Verse's queue (`--queue`): missing, unpaid features in the tower's order (the lowest unbeaten floor first, a lane's sites before its leader as the climb meets them, conquered floors last), hand research before the scan's, three a run and never more than three `feature:` jobs open, each gap once ever (its target is a hash of the floor, the site and the name, kept in `auto.queued`; the server also refuses a second open job for one target). Builders claim them like any job: `python tools/void_queue.py claim`.

The gate counts what Verse has: `withFeatureFacts` (`tools/tower-probes.mjs`, applied by `tools/tower-gate.mjs`) adds up to six features a floor's file marks `has` to that floor's completeness facts (a floor with a probe), so a site reads surpassed only when Verse's page shows them in words. A feature named for what a site lacks or costs ("No sign-up", "Free with ads") is never a fact; a feature whose words are not on the page but is there anyway gets a `"shows": "<regex>"` in the file.

## Commands

```
node tools/feature-scan.mjs "random generators" --list     the sites it would read, nothing loaded
node tools/feature-scan.mjs "random generators"            read them, write domains/features/random-generators.json
node tools/feature-scan.mjs --missing --list               floors with no file, and lane sites their file lacks
node tools/feature-scan.mjs --stale 30 --max-floors 2      files 30 days old or more
node tools/feature-scan.mjs --queue --dry                  the next three gaps it would queue
node --test tools/feature-scan.test.mjs                    the pure parts
```

Locally it needs `CHROME_PATH` (any Chromium) and sites it can reach; this container reaches none, so the pure parts are tested and the reading was tried against a local fixture site (a rival with features, pricing, FAQ, a robots-disallowed page and a link to another host; a Verse page beside it). The workflow's runner reaches the sites.

## How to tell it worked

The run prints one line a site: pages read, features found and by what (model or heuristic), and Verse has / partly / lacks. A commit "Feature scan: <floors> researched by Verse" lands on main; `--queue` prints `queued feature:...`, and `domains/void.queue.md` shows the jobs after the next sync. A site with `problem` and no features was not read: look at why before believing it has nothing.

## Mistakes made (and the checks that stop them)

- **The lane-url bug** (notes lane, 2026-10-25): lane sites read through their probe's `site` were the leader's page eleven times. Always the lane site's own `url` (`siteOf`, tested in `floors: ...` in the test).
- **Redirect stubs:** a bare domain that only redirects (quillpad.in without www) reads as a near-empty page. The lane names `https://www.quillpad.in/`; a stub is recorded as `problem`, not as a site with no features.
- **Parked domains** read as a page full of "buy this domain" words; refused by `pageProblem`.
- **Sign-in walls** (onenote.com, icloud.com, outlook.live.com): the home page is a sign-in form; refused, and the hand research (or the site's public product pages, linked from its own home page) carries those sites.
- **A site that sends you elsewhere** (onenote.com to microsoft.com) is read where it lands and noted as `went_to`; check the features are about the floor's job.
- **Heuristic noise:** navigation, cookie banners and footers are left out, one-word buttons are not features, "Plans" and "Pricing" headings are not features. What still slips through is a builder's to judge: the job's ask names the page and the line it came from.
- **Never overwrite hand research:** only `auto` changes in a file people wrote; the landing (`--put`) folds a run into the file as it stands on the newest main, newer scan per site, every queued job kept.
