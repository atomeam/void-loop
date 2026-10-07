# AGENTS.md — a-to-mind-loop

This is the live Void (a-to-mind.com) and the private company Loop.

Read `STANDING.md` first: it explains what we are building and where things are.

Then read `domains\void.growth.md` (what's next) and the last lines of `domains\void.agents.log.md` (what just happened).

## Working fast (learned 2026-10-04)

- `node tools/checks.mjs` runs every fast check in one go (fringe ledger, skill collisions, calendar, glyphs, void.html matching its two deploy copies, the full benchmark against its floor, the miss reader's redaction). Run it before every push; CI runs the full browser suite.
- `node tools/bench.mjs --probe candidates.json` tries a batch of new asks (same shape as tools/bench.json) and prints only the misses. Probe 30–40 at once, fix the misses, then add the batch with `node tools/append.mjs bench --skip candidates.json` (the same file). After a fix, `node tools/bench.mjs --again` re-probes only the asks the last probe missed. For review asks, `says` is checked with the pasted code taken out of the card first, so a pattern that only appears in the code no longer passes.
- Never wait on CI. Push, then run `node tools/merge-when-green.mjs <pr>` in the background; it merges when test-and-deploy (and the bench job, on the rare PR that changes the benchmark harness) pass on the PR's current head, and stops with the failing run's link otherwise. A CodeRabbit review still running (or asked for and not yet posted) gets up to 10 min after green (when CodeRabbit says it is rate-limited, the script asks once more as soon as the limit lifts), and actionable CodeRabbit findings on the head, or any CodeRabbit thread nobody has answered, stop it (exit 3) so they get fixed or answered before merging.
- A new push to a PR cancels the older run of that PR (deploy.yml "Supersede older runs"); on a PR the benchmark runs as its own job, in parallel with the suite.
- Everyday maths and unit asks now pass on the first probe (run 36: 32 of 32), so spend probes where Void is thinner: review asks in more languages, places and times, words and definitions, and phrasings people actually type. `bench.mjs --probe` skips asks the bench already has.
- `node tools/ask.mjs "ask" …` shows what Void answers for each ask (who answered, the card text, any page error such as a TDZ crash) with outside services blocked. Use it when a probe misses for no clear reason.
- Void reviews code. `void-live-deploy/lib/code-review.js` holds the checks (bugs, risks, style, safe automatic fixes) the site runs when someone asks "review this code", and `tools/review.test.mjs` tests them. `node tools/review-pr.mjs [--base origin/main]` runs them on the lines a branch adds, and the "Void review" workflow posts that on every PR as one comment. Treat its bugs and risks like a reviewer's; a false positive is a bug in code-review.js, so fix the rule and add a case to the test.
- `node tools/merge-main.mjs` merges origin/main and settles the append-only files (bench.json, grown.json, the agent log) by keeping both sides.
- `node tools/misses.mjs` reads the real miss board (owner-only /api/misses, needs VOID_MISSES_TOKEN). It only prints: this repo is public, so raw asks never get committed.
- `node tools/fringe.mjs --record <draft> <sources.json>` adds a fringe run in the ledger's own style; after fixing a recorded draft (a review finding), `node tools/fringe.mjs --rehash <draft>` refreshes its sha256.
- `node tools/draft-check.mjs [draft.html]` opens fringe drafts headless (by default the ones this branch changes) and fails on a missing noindex, a page error on load or first button press, anything fetched from outside, or no `window.__name` hook. checks.mjs runs it, so there is no need to hand-write a test script for a new draft. Give the draft's hook a `selftest()` that runs its maths on made-up data and returns true (or a string saying what is wrong); draft-check calls it, so the maths is checked on every run.
- Don't run the browser suite and the benchmark at the same time on one machine: the benchmark reads answers on a timer and misses them when the CPU is shared.
