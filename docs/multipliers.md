# Force multipliers: the next tools like Verse's code review

Verse's code review (tools/review-pr.mjs) made every PR reviewable in seconds and set the merge-on-green speed. These are the next tools of that kind: each one removes a wait or a class of rework for every builder (and each is a product a small team would pay for). Ranked by speed gained per unit of effort; checked against tools/ so each extends one engine rather than adding a second.

| # | Tool | What it saves | Effort | Status |
|---|------|---------------|--------|--------|
| 1 | **Site tester** (tools/site-test.mjs) | Live a-to-mind.com driven like a person after every deploy and hourly: real asks, cards, console errors, screenshots, 3D fps; each run ends in one improvement (file once, teach a wording, grow the suite, tighten a limit). Also tests any site from URL + steps (`node tools/site-test.mjs --url https://a-to-mind.com/films/ --steps tools/fixtures/site-test-steps.example.json`). | M | **built** |
| 2 | **PR collision predictor** (tools/collide.mjs) | Before an agent starts, which open PRs and handoff lines already touch the same files; ends the merge-conflict rebases between parallel agents. | S | **built** |
| 3 | **Untested-code ratchet** (tools/untested.mjs) | Lists lib/ and skills/ files no test names, worst first; the count may only go down. Tells test-writers where to start. | S | **built** |
| 4 | **Stale-docs checker** (tools/doc-drift.mjs) | Paths and commands named in docs/, AGENTS.md and the board that no longer exist ("named files that do not exist", Lessons); count may only fall. | S | **built** |
| 5 | **Teach-on-miss auto PR** (tools/site-teach.mjs) | Takes a site-test `teach` item and opens the PR adding the wording to the skill's examples/match plus its regression case: skills/aliases.json, so an existing skill learns the phrase (no new skill). | M | **built** |
| 6 | Real-GPU fps probe | Same fps check on a real device (the Victus) through the local-exec bridge, against the CI software-GL baseline. | M | up for grabs |
| 7 | Visual-diff reviewer | Compares site-test screenshots to the last green run and flags a card that changed shape. | M | up for grabs |
| 8 | Known-failure triager | The six pre-existing check failures (map-coverage, sunrise/sunset, copy drift, bench-load, test_sky, test_extension) each get a root-cause note and a fix PR; tools/flakes.mjs feeds it. | M | up for grabs |
| 9 | Verse self-asks to PR | tools/reflect.mjs asks become drafts with a plan, files and a test stub, ready for a builder. | M | up for grabs |
| 10 | Salvage scanner | Secret, license and dependency scan for salvaged code before it lands in the public repo. | S | up for grabs |
| 11 | Changelog to films/social drafts | Merged PRs of the day become a films script and post drafts (drafts only; Adam posts). | S | up for grabs |
| 12 | Perf budget bot | Page weight and load-time budgets per page, ratcheting like the bench floor. | S | up for grabs |
| 13 | Skill-collision fuzzer | Generates wordings across skills and finds two skills fighting for one ask (extends skills-check). | M | up for grabs |
| 14 | Accessibility ratchet | a11y-run issues count may only fall (extends tools/a11y-run.mjs). | S | up for grabs |
| 15 | Dead-link checker | Every link on the live site and in docs answers (polite, GET only). | S | up for grabs |

## Sellable

- **Site tester for any site** (from #1): "a tester that improves your site every run": URL + steps, screenshots, console errors, fps, one fix item per run, never submits anything. Suggested $19/month or $49 one-time self-host pack. Generic name only (no trademarks).
- **Collision predictor** as a GitHub Action for teams running several AI agents on one repo: $9/month.
- Both go into the store catalog once domains/store.products.json lands on main.

## Site tester rules (Adam, 2026-10-15)

Only tests: every non-GET request is answered inside the browser (nothing submitted, posted, bought, signed up or sent; nothing lands in Verse's logs or view counts). One pass of the suite per run, never the same ask twice, an ask every 3 s, traffic marked (user agent V01DSiteTest, header x-void-test). Other sites: robots.txt first, no clicks on submit/buy/sign-up/send/post. One issue per distinct failure. Its asks are its own (skill examples and made-up wordings); visitors' words are never committed, only paraphrases.
