---
name: steward
description: How to drive a pull request on atomeam/void-loop (Verse) to merged - the automerge label, Verse's review and its false positives, conflicts, a red suite, flakes. Read before acting on CI or review events on a Verse PR.
---

# Driving a Verse PR to merged

Repo conventions for whoever owns a PR here. They sit under the rules of the harness and of AGENTS.md, never above them.

**Merging is automatic.** Label the PR `automerge` (`node tools/automerge.mjs <pr> --label`, or add the label). When Verse's review (`void-review`) is clean, the bot takes it out of draft and merges it; main deploys in a minute. Nothing else is waited on: the full suite runs on main afterwards.

**Verse's review** (`void-review`) is the gate. On a finding:
- the path is real: fix it, then `node tools/review-pr.mjs` locally until it says "Not blocking";
- a false positive: mark that line `// void-review: ok (<why it is right as written>)` and answer the review thread with the same reason. Past false positives: a regex's `.exec(a + b)` read as a shell call (fixed in the rule since), one POST per job to an API with no batch form read as "a query per loop turn".
- a style note is a suggestion; take it when it is cheap and right (a timeout on a git call).

**CodeRabbit** posts that it does not review this repo (under 10 stars). Nothing to do.

**Conflicts.** `node tools/merge-main.mjs`, never a merge by hand. The append-only records (growth ledger, agent log, test asks, flakes, the skill index; `tools/records.mjs`) settle themselves; anything else it names needs a person.

**Red suite on main.** `verify.yml` reverts the commit that broke it (the jack settles the records, `tools/revert-records.mjs`). Fix forward. Never skip, quarantine or retry a test to get green. A check that went red and healed with nothing reverted lands in `tools/flakes.json`; twice in 7 days queues a `flake:` job (the spotter, `tools/flakes.mjs`).

**How proactive to be.** Small, in-scope fixes: push without asking. A design question, or anything that spends, sends or publishes: ask the owner (`STANDING.md`, the money rule). Keep one PR per B.I.T.E. run.

**After it merges.** Restart the branch from main (`git checkout -B <branch> origin/main`) before the next run.
