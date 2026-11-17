---
name: void-loop-shipping
description: How a run in atomeam/void-loop (Verse, live at a-to-mind.com) goes from a claimed task to a merged pull request, and which already-red checks on a bare checkout are expected rather than blocking. Use when building, fixing, taking a frontier step or a queued job, running tools/finish.mjs, opening a PR, or when a check fails and you need to know if it is yours.
triggers:
  - ship
  - shipping
  - pull request
  - automerge
  - finish.mjs
  - void-loop
  - verse loop
  - frontier
  - checks.mjs
  - merge-gate
  - b.i.t.e
---

# Shipping a change in void-loop

AGENTS.md is the source of truth; this file is the short path through it. If they disagree, AGENTS.md wins.

## The run (B.I.T.E.)

1. **Claim.** `python tools/void_queue.py claim` for a queued job, or a one-line PR claiming a frontier step (top of `domains/void.frontier.md`). Add your line to `domains/handoff.md` under "Working on" before you start, and move it when you ship.
2. **Brief** (goes in the PR): who it is for, the problem, **who does this best and how**, what the first version does, and **what it will not build**.
3. **Build the smallest useful piece.** Reuse what exists (`docs/MAP.md`). A new skill: `node tools/new-skill.mjs <name> --ask "..."`.
4. **Test as a person will.** `node tools/ask.mjs "<ask>"`, then the browser-suite sections you touched: `node tools/test_void.mjs --only "<words>"` (`--list` shows them; seconds, never the whole ~20-min suite locally). Open the screenshot `tools/ask.mjs` saves and check it shows the thing the ask names, not a stand-in.
5. **Finish.** `node tools/finish.mjs <grow|build|fix|retire|idea|finding> "what changed" --brief "..." [--title "..."] [--test "<words>"]... [--show "plain words"] [--try "an ask"]`
6. **Review.** Verse's review (`void-review`) is the gate. On a real finding, fix it; on a false positive, mark the line `// void-review: ok (<why it is right as written>)` and reply on the thread.

## What finish.mjs does (its steps)

`[0]` browser check on site files you changed · `[1]` growth ledger line (`tools/grow.mjs`) · `[2]` agent-log line (`domains/void.agents.log.md`) · `[3]` map coverage (`tools/map-coverage.test.mjs`) · `[4]` commit (runs `skills-index.mjs --adopt`, `families.mjs`, `guide.mjs`) · `[5]` bring main in (`tools/merge-main.mjs`, never a merge by hand) · `[6]` fast checks (`checks.mjs --changed`) · `[7]` push (`tools/push.mjs`) · `[8]` open the PR and label it `automerge`.

It stops at the first failure and prints the resume command; continue with `--from N`.

## The expected reds (do not chase them)

On a bare checkout (no Chromium installed, plus content drift) several **structural** checks are already red on `main`. Seen and confirmed: `taste-audit`, `real-pages-list`, `seo-audit`, `drafts`, `handoff-scan`. They are not yours and they do not block a PR.

- `finish.mjs` step 6 runs `checks.mjs --changed` **without** the gate, so it stops on these. That is not your bug.
- The **PR gate** is `node tools/merge-gate.mjs` (and `merge-gate.yml` in CI). It runs `checks.mjs --changed` with `VOID_GATE=1`, which **leaves the structural checks to main**. Run it locally: if it exits 0, your PR is clean. Only a **new** red in a check your change touches blocks you.
- So when step 6 stops on a pre-existing red, confirm with `node tools/merge-gate.mjs`, then resume: `node tools/finish.mjs ... --from 7`.

## Pitfalls that cost turns

- **A change that name-matches a red check drags it in.** `checks-changed.mjs` runs a check when a changed file's basename is in the check's name (e.g. editing `domains/handoff.md` pulls in `handoff-scan`, which is red on main). If a doc edit is not part of your fix, drop it — "no new red" is the rule.
- **A change that reaches the site needs a passing `--test` first** (`void.html`, `void-live-deploy/**` minus `.json/.md/.txt`). A `tools/`-only change needs none.
- **Bring main in with `tools/merge-main.mjs`**, never a hand merge; the append-only records (growth ledger, agent log, `domains/handoff.md`, the skill index) settle themselves.
- **Run one heavy browser job at a time**: `node tools/heavy.mjs <command>` queues them.

## Never

- Push to `main` (work on a branch; `push.mjs` pushes the current branch).
- Quote the owner in a PR title/body, commit message, doc, or page — say what changed in your own plain words.
- Hand-edit `skills/index.json`, or any old line of the growth ledger or the agent log.
- Commit a secret; a made-up key in a test says so with `secret-scan: ok`.
- Write a rule in the owner's name without the owner's words.

## The finish command, filled in

```bash
node tools/finish.mjs fix "what changed, in one line" \
  --title "Plain title for the PR" \
  --brief "for whom; the problem; what it will not build" \
  --test "<browser-suite words>" --show "<the change in plain words>" --try "<an ask that shows it>"
```

`--show`/`--try` put a visible change on the stage for returning visitors; skip them only for changes no one can see. `--dry` prints the steps and runs none.
