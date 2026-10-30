# Verse without Claude: the audit and the tower cycle

Owner, 2026-10-26: "use all your energy into making fully autonomous verse continue the tower without you and become the worlds best autonomous money maker", and "correct the goal is for verse to do it without claude". This page is the audit of every scheduled and manual workflow (`.github/workflows/`, 68 files on 2026-10-26), whether each needs Claude, whether it works, and the map of the Versus tower cycle onto what exists. Runs were read from the GitHub API on 2026-10-26 around 06:40 UTC (the last ten runs of each, newest first: s = success, f = failure, c = cancelled, k = skipped, p = pending or in progress).

## Who needs Claude

Two workflows can reach Claude, and neither is on Verse's path:

- `propose-fix.yml`: its daily runs use Verse's own model (Workers AI, `lib/propose-fix.js` through the owner-only `/api/propose-fix`). A run started by hand may pick the `claude` brain (`tools/claude-brain.mjs`, the `ANTHROPIC_API_KEY` secret, one capped call). The default and every scheduled run are free and Claude-free.
- `think-tank.yml`: manual only, needs `ANTHROPIC_API_KEY`; its schedule was turned off on 2026-10-07.

Every other workflow runs on the repo's own tools, Workers AI (the site's binding or the REST API with `CLOUDFLARE_API_TOKEN`), free public sources, or nothing at all. The builders who write the code are Claude sessions; the workflows themselves do not call Claude.

## Every workflow

| Workflow | What it does | When | Claude | Works (last runs) |
| --- | --- | --- | --- | --- |
| appraise-live | checks the live appraiser with one test image | hand | no | 3 runs, last s (10-16) |
| arena | self-play tuning of Connect Four and Othello, commits ratings | daily 06:53 | no | s ×10 |
| art-look | paints one Art Forge picture to a branch for a builder to see | hand | no | s ×10 |
| ask-void | asks live Verse one question from GitHub's network | hand | no | s ×4 |
| assemble-growth | (push trigger, no jobs run so far) | push | no | never ran |
| automations-seed | puts the seeded automations on the site | after deploy, hand | no | s ×10 (952 runs) |
| automerge | merges labelled PRs once Verse's review is clean | events, hourly | no | s ×10 (7,793 runs) |
| bench | the everyday benchmark (1,900+ asks) | daily 09:47, PRs touching it | no | c c f f c… (cancelled and failing) |
| better | daily "is Verse getting better" score | daily 06:51 | no | s ×9 |
| build-miss | the miss board scaffolds a new skill with the free model | daily 15:23 | no | s ×9 |
| cf-scope | what the Cloudflare tokens can read | hand | no | s ×2 |
| clef-probe | Clef model metadata | hand | no | never ran |
| clips | daily ad clips filmed and rendered | daily 14:17 | no | s ×10 |
| coins-snapshot | top coins snapshot for /markets/ | daily 05:41 | no | s ×1 |
| collide | which open PRs touch the same files | PRs | no | f c f f f s… (fails often) |
| deploy-workers | deploys the standalone Workers | push, hand | no | s ×1 |
| deploy | tests and deploys a-to-mind.com | push, hand, PRs | no | p s c c s… (works; superseded runs cancel) |
| dispatcher | inspects the build queue (dry run on schedule) | daily 13:23 | no | s ×10 |
| easiest-sites | ranks the easiest real sites from the Tranco top list | hand | no | s ×4 |
| feature-scan | reads every Versus site's features, queues gaps | weekly Mon 04:41, push of lib/tower.js, hand | no | s ×7 then c ×3 |
| films-live | checks /films/ from outside | hand | no | s ×1 |
| free-pics-probe | asks the free picture sources once each | weekly, hand | no | s ×4 |
| gaps | queues gaps from public "most wanted" lists | weekly Mon | no | s ×2 |
| grow-clock | starts one growth step every 10 minutes in turn | hourly at :07 | no | p p c c c s c s… (mostly cancelled: overlaps) |
| grow-self | Verse hardens itself from what it lacks, opens its own PR | hand (started by grow-clock) | no | s ×10 (365 runs) |
| learn | queues the week's misses as jobs | daily 18:39/19:39 | no | s ×10 |
| live-revert | reverts a deploy that broke MCP live | after MCP live | no | k ×10 (nothing to revert) |
| loop-critic | annotates vague or roleplay text in PRs | PRs | no | f s f f f f s… (a gate that fails often) |
| mcp-live | a real MCP client against the live site | after deploy, hand | no | mixed p c k s |
| mcp-registry | keeps Verse in the MCP registry | after deploy, hand | no | s ×10 |
| mirror | copies the repo's knowledge to a second host | weekly Sun | no | s ×3 (no-op until MIRROR_URL) |
| misses-snapshot | public miss terms and counts | daily 06:23 | no | s ×10 |
| model-bench | free model bake-off on Workers AI | hand | no | last s (10-10) |
| ouroboros | Ouroboros on Windows | PRs, push, hand | no | s f s s s f |
| probe-asks | Verse writes 25 probe asks for its weakest family | every 4 h | no | s ×10 |
| propose-fix | Verse's model proposes the matcher fix for a probe miss | every 2 h | optional (hand runs may pick claude) | s ×10 |
| rea-study | the owner's reverse-engineering studies | daily 05:23 | no | s ×4 |
| record | films a lab experiment | daily, after deploy | no | s k s k… |
| reefwatch | coral heat card keeps itself current | daily 06:47 | no | s ×10 |
| rehearsal | the commercial chain rehearsed | hand | no | last s after 9 f (10-10) |
| reinvest | Verse's reinvestment plan from earnings | daily 11:41 | no | s ×10 |
| review-bench | scores Verse's code review on real bugs | weekly Mon | no | s ×5 |
| review-main | Verse reviews its own skills on main, queues jobs | daily 12:53 | no | s ×10 |
| rides-live | the rides family against a live router | daily 14:17 | no | s ×10 |
| route-bench | Clef-flash against the embedding router | hand | no | s ×3 |
| site-icons | every Versus floor's logo kept | hand | no | s ×2 |
| site-re | reverse engineering of each tower site's client code | weekly Sun 05:23, hand | no | s ×5 |
| site-scout | what a real site shows a visitor | hand | no | s ×10 |
| site-test | the live site in headless Chrome | after deploy, hourly | no | mostly c (superseded), p |
| store-check | the store's free downloads fetched | daily 11:07 | no | s ×10 |
| store-gap | product gaps become products | every 4 h | no | s ×10 |
| subject-eval | subject evaluation against live sources | daily 05:41, hand | no | s ×5 |
| think-tank | the Forethinkers research cycle | hand | **yes** (`ANTHROPIC_API_KEY`) | s ×10 (last 10-07, schedule off) |
| touch-webkit | Ringer touch checks in WebKit | PRs, hand | no | f f s s… |
| tower-gate | the head-to-head gate against live sites, commits verdicts | after deploy, daily 06:17 sweep, hand | no | s k s k… (works) |
| tower-rank | ranks every Versus site by Tranco traffic | monthly, hand | no | s ×1 |
| **tower-self** (new) | **the whole tower cycle by itself** (below) | 3× a day, hand | no | proof runs below |
| traffic | visitor counts | daily 05:17 | no | never ran yet |
| trialwatch | trial watch card keeps itself current | daily 06:41 | no | s ×10 |
| upkeep | daily and weekly upkeep data files | daily, PRs | no | s ×10 |
| verify | the full suite on every head of main, reverts what breaks it | push | no | mostly c (superseded), p |
| verse-podcast | Verse Out Loud weekly episode | weekly Mon | no | never ran yet |
| visual | weekly visual diff of the live site | weekly Mon | no | s ×2 |
| void-review | Verse's own review of every PR (the merge gate) | PRs, hand | no | s f s f… (fails when a PR has a finding, by design) |
| void-tick | the clock for Verse's automations | every 15 min | no | mostly c (overlaps) |
| void-voice | Verse's daily voice | daily 18:09/19:09 | no | s ×10 |
| watchdog | the full suite daily, an issue on failure | daily | no | c f f f f f f f f s (failing for 8 days) |
| will | Verse's will: three wants an hour | hourly, after runs | no | s k s… |
| word-sweep | random words typed into the live site | every 6 h | no | s ×10 |
| workflow-lint | actionlint on every workflow | PRs, push | no | s ×10 |

Not found: `earn-self.yml`, named in `docs/RULES.md` (2026-10-26) as Verse's earning loop, does not exist yet on main.

## The tower cycle, mapped

| Step | Before this run | Now |
| --- | --- | --- |
| Pick the next unbeaten site, easiest first | `lib/tower.js` (`tower()`, `frontierOf()`), `tower.frontier.json` (1,071 sites from `easiest-sites.mjs --tools`), `tower-rank.yml` monthly. Nothing acted on the pick by itself: the frontier sites were never floors, so the gate never measured them | `tools/tower-self.mjs plan`: the frontier easiest first, skipping blocked sites and ones tried lately |
| Research its features | `feature-scan.yml` (floors only, weekly, its push trigger never fires for bot pushes), `site-re.yml` (floors only, weekly) | the build reads each candidate with feature-scan's own `scanSite` and `scanFloor` and merges into `domains/features/<family>.json`; site-re runs on the floor once it exists (its weekly sweep) |
| Build the page | Claude builders by hand (lane pages from rows: `lib/tool-sites.js`, `lib/flight-sites.js`, `tools/tool-site-pages.mjs`) | a DATA row in `lib/self-sites.js`: the family is chosen by Verse's free model and checked against the site's own words, the page is the family's page with the row's words (`variantHtml`), its search block, sitemap entry and offline entry are generated |
| Gate | `tower-gate.yml` after each deploy (the current fight and pages the deploy changed) and the daily sweep | the loop gates its own new floors right after its deploy, landing rows as tower-gate.yml does |
| Fix losing rows | Claude builders by hand | mechanical templates (offline list, link-preview tags) applied and redeployed once; every other row becomes a `versus:` job on Verse's queue with the gate's evidence |
| Next | a builder picks the next floor | the next run (3 a day) picks the next site |
| Report | builders' agent-log lines | one line per run on the agent log and the growth ledger by Verse, and in `domains/tower-self.json` |

## What still needs Claude (the gaps)

- **A site no floor covers.** Of the first frontier sites most are not tools Verse has a page for (paint-by-number games, emoji trackers, web hosts). The loop queues each as a `versus:` job and moves on; building a new kind of page is still a builder's work.
- **The fix of a row with no template.** Speed above the bar, design defects, a missing feature: queued with the gate's evidence for a builder; `propose-fix.yml`'s free model only fixes skill matchers today.
- **Pinned lanes.** The pdf, kanban, travel and generator lanes are pinned by their own tests to their hand tables, so the loop leaves them out until those tests read `lib/self-sites.js`.
- **The page is the family's page.** A self-built page has its own address, title, headline, intro, preview words and search block, and every feature of the family page, but the same body: a feature the site has that the family page lacks becomes a queued job, not new code.
- **Queued jobs are claimed now (2026-10-26, the conductor).** `tools/conductor.mjs` (every 10 minutes from `grow-clock.yml`) hands each queued job to the loop that can do it: probes to `propose-fix.yml`, new-skill misses to `build-miss.yml`, store gaps to `store-gap.yml`, and every other kind (features, gaps, reviews, flakes, Verse's own wants and voice asks, tower rows, repairs of broken loops) to the coding agent `verse-agent.yml` once it is on main; until then those are held, with the reason in `domains/conductor.json`. Before this, 57 jobs sat queued, the oldest since 2026-10-09, and 240 probe fixes had failed against 35 done. Playbook: `docs/playbooks/conductor.md`.
