---
name: void-run
description: How a run on Void (this repo, a-to-mind.com) goes from claim to merged PR. Use when building a skill, fixing something, taking a frontier step or a queued job in atomeam/void-loop.
---

# A run on Void

AGENTS.md is the source; this is the short path through it. If they ever disagree, AGENTS.md wins and this file is out of date.

Every run is B.I.T.E.: brief, implement the smallest useful piece, test it the way it will be used, evolve from what the test showed.

1. **What next.** `node tools/next.mjs`: the cleanup steps left, the frontier's open items with their sources, then the misses. A queued job instead: `python tools/void_queue.py claim`.
2. **Brief.** Who it is for, the problem, what the first version does, and **what it will not build**. It goes in the PR.
3. **Build, reusing first.** A new skill: `node tools/new-skill.mjs <name> --ask "..."` (`docs/UPGRADING.md`). Look in `docs/MAP.md` and `docs/SALVAGE.md` before writing new code.
4. **Test as a person will.** `node tools/ask.mjs "..."`, the 3D check, a play-through. What it showed goes in the PR's Evolve section.
5. **Finish.**
   `node tools/finish.mjs <grow|build|fix|retire|idea|finding> "what changed" --brief "..." --body "<commit trailers>"`
   It writes the ledger and log lines, checks the map, commits, merges main, runs the fast checks and pushes, then opens the PR labelled automerge (or prints the body when `gh` is not signed in). It stops at the first failure; resume with `--from N`. `--dry` shows the steps.
6. **Review.** `node tools/review-pr.mjs` before or after pushing; then the `steward` skill drives the PR to merged.

One PR per run. After it merges, restart the branch from main before the next one.

The "never" list is in AGENTS.md: read it, it is short.
