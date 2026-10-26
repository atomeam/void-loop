# Playbook: Versus by itself (tower-self)

What starts it: `.github/workflows/tower-self.yml`, three times a day (02:37, 10:37, 18:37 UTC), or by hand (Actions > Versus by itself > Run workflow; `site` takes hosts, `built` caps the pages). Owner, 2026-10-26: "all sites get a page", and Verse climbs without Claude.

## What one run does

1. `node tools/tower-self.mjs plan --out plan.json`: up to 8 frontier sites (`tower.frontier.json`), easiest first, none tried lately (`domains/tower-self.json`; a site no floor covered comes back after 60 days).
2. `node tools/tower-self.mjs build plan.json decision.json --built 4`: each site read at its own address (feature-scan's `scanSite`: robots.txt, parked, stub and sign-in pages refused, recorded as `gone`); one call to Verse's own model (the site's Workers AI binding through the owner-only `/api/tower-self` with `VOID_OWNER_TOKEN`; the Workers AI REST API only if that fails, and the repo's `CLOUDFLARE_API_TOKEN` has no Workers AI scope: it answered 401 on the first proof run) names the floor that does the site's job and writes the page's words; the choice must share a word with the site (`sharesWords`) and the words must pass `validTexts` (no site named, nothing the family page does not do, five to eight asks, no claim, no key), else the family page's own words are used. A site no floor covers is `no-family` and a `versus:` job. Its features are read by feature-scan's `scanFloor` (one more model call).
3. `sh tools/tower-self-land.sh decision.json "<message>"`: from the newest main, `apply` writes the row (`lib/self-sites.js`), the page (`variantHtml` of the family page), `sw.js` TOOLS, the features file and the state; `seo-pages.mjs` and `sitemap.mjs` run; the checks run (tower-self, lane-pages, tower, tool-sites, toolkit, seo, calendar, generators and floor-kit tests, `refresh --check --only seo`, the secret scan). A failing build is discarded: its sites are recorded `discarded` with the failing check and only the state is pushed. Only the loop's own paths are added.
4. The deploy is started (`gh workflow run deploy.yml -f after_merge=true`) and `tools/tower-self-live.mjs` waits until each new page's headline is live (15 minutes at most).
5. `tools/tower-gate.mjs "<floor id>"` for each new floor, landed with `tools/gate-land.mjs` like tower-gate.yml.
6. `node tools/tower-self.mjs judge ids.txt --queue --decision decision.json`: offline and sharing rows get their templates (the page into `sw.js` TOOLS, the page's preview tags rewritten); every other lost or unmeasured row is a `versus:<host>:<aspect>` job (at most 6 open); the run's line goes to `domains/tower-self.json`, and `tools/tower-self-report.sh` appends it to the agent log and the growth ledger (by `verse`) and pushes. When a template fixed something, the run redeploys and gates once more.

## How to tell it worked

- `node tools/tower-self.mjs status`: pages built, pages in the last day, outcomes, frontier left, the last five run lines.
- The agent log ends with `| verse | build | Versus: took on <host> (<family>, <page>), surpassed N of M rows; next <host>`.
- `node tools/tower-self.mjs guard` (a check in `tools/checks.mjs`, `versus-pages`): exit 1 when a frontier site at the front of the queue (the first 5 unbeaten) has no page.

## Budget

Per run: 8 sites read, 4 pages, about 9 model calls (one choice and one feature list per site built, one choice per site not built), one or two deploys, about 15 to 25 runner minutes. Three runs a day: up to 12 pages a day.

## Mistakes made building it

- The first proof run's model call answered 401: the repo's Cloudflare token cannot run Workers AI (feature-scan has silently fallen back to its heuristic for the same reason). The loop now asks the site's own binding through `/api/tower-self`.

- A copy of a family page one folder down breaks on a relative address: `familiesOf` refuses a page with one (a query-only `?k=` link is fine).
- Lanes pinned by other tests (pdf, kanban, travel, generators) fail those tests when a row joins them: `PINNED` leaves them out.
- A row needs 5 to 8 asks and a description over 40 characters (`tools/seo.test.mjs`), a related row and a stage ask (`tools/toolkit.test.mjs`): `lib/toolkit.js` gives a self-built page its family's.
- `tools/flights.test.mjs` fails on main already (the travel floor has a page the test says it should not); it is not in the loop's checks.
