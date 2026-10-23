---
name: void-run
description: How a run on Verse (this repo, a-to-mind.com) goes from claim to merged PR. Use when building a skill, fixing something, taking a frontier step or a queued job in atomeam/void-loop.
---

# A run on Verse

AGENTS.md is the source; this is the short path through it. If they ever disagree, AGENTS.md wins and this file is out of date.

Every run is B.I.T.E.: brief, implement the smallest useful piece, test it the way it will be used, evolve from what the test showed.

1. **What next.** `node tools/next.mjs`: the cleanup steps left, the frontier's open items with their sources, then the misses. A queued job instead: `python tools/void_queue.py claim`.
2. **Brief.** Who it is for, the problem, **who does this best and how** (look it up: a library, an algorithm, a product to copy), what Verse adds that they do not, what the first version does, and **what it will not build**. It goes in the PR.
3. **Build on the best.** Take the proven approach (an open-source library, a known algorithm) rather than inventing one. A new skill: `node tools/new-skill.mjs <name> --ask "..."` (`docs/UPGRADING.md`); `docs/MAP.md` and `docs/SALVAGE.md` say what is already here.
4. **Test as a person will.** `node tools/ask.mjs "..."`, a play-through, and the browser-suite sections you touched: `node tools/test_void.mjs --only "<words>"` (seconds; `--list` shows them). Never the whole 20-minute suite locally: `verify.yml` runs it on main. What the test showed goes in the PR's Evolve section. Then **look at the result**: open the screenshot `tools/ask.mjs` saves (its `look:` line) and check it is the thing the ask names, not a stand-in for it; finish.mjs stops when the `--try` answer names nothing the ask is about (`--about "words"` only when the right answer truly shows other words).
5. **Finish.**
   `node tools/finish.mjs <grow|build|fix|retire|idea|finding> "what changed" --brief "..." --test "<browser-suite words>" --show "<the change in plain words>" --try "<an ask that shows it>" --body "<commit trailers>"`
   (`--show`/`--try` let the "look what I made" walkthrough put the change on the stage for returning visitors; skip them only for changes no one can see)
   Anything that reaches the site needs a `--test` that passes in a real browser first; it stops otherwise (`docs/RULES.md`, right the first time).
   It writes the ledger and log lines, checks the map, commits, merges main, runs the fast checks and pushes, then opens the PR labelled automerge (or prints the body when `gh` is not signed in). It stops at the first failure; resume with `--from N`. `--dry` shows the steps.
6. **Review.** `node tools/review-pr.mjs` before or after pushing; then the `steward` skill drives the PR to merged.

One PR per run. After it merges, restart the branch from main before the next one.

The "never" list is in AGENTS.md: read it, it is short.
