# Land a change without a conflict

What starts it: you are about to open a pull request, or a pull request is sitting dirty because it rewrote a file the deploy generates.

## Before you open it

1. One pull request for the one task.
2. `git fetch origin main` then `node tools/merge-main.mjs` so the branch is on top of main. A conflict outside the append-only records and the build outputs needs a person; the command names the files.
3. Do not commit a build output. The list is `tools/generated.mjs`. Add a skill as `void-live-deploy/skills/order/<rank>-<name>`. Add a ledger line as `growth/entries/<file>.json` (`node tools/grow.mjs` does that on a branch). A red suite writes `void-live-deploy/incidents/entries/<sha>.json`. A Versus floor writes `void-live-deploy/tower-evidence/<floor>.json`.
4. Keep it easily clearable (Atom, 2026-11-04: "only open easily clearable ones so we dont hang anymore"): one purpose, at most 400 changed lines (added plus removed, from `git diff --numstat origin/main...HEAD`; build outputs, `growth/entries/`, `incidents/entries/`, `tower-evidence/`, `skills/order/`, the append-only records and binary files are not counted), and no file that another open pull request is changing (`node tools/collide.mjs --mine` shows them; the shared ledgers in `tools/collide.mjs` COMMON, the append-only records and `docs/MAP.md` are fine to share). Bigger work is split into pull requests that each stand alone and land in order.
5. `node tools/pre-pr.mjs` — it refuses a branch behind main, one that commits a build output, one over 400 changed lines, or one that changes a file another open pull request changes, then runs the fast checks. `--check-only` stops after the refusals. `helper-pr.yml` runs `--check-only` on every helper push and opens no pull request for a branch it refuses (the run's summary says why); fix the branch and push again.

## What "it worked" looks like

- `node tools/pre-pr.mjs --check-only` prints `on top of main, N changed lines (at most 400), no build output, no file another open PR changes`.
- The pull request's `merge-gate` check is green. It merged main in a temporary tree, regenerated the build outputs, and ran the fast checks there.
- GitHub shows auto-merge armed (squash) once Verse's review and the merge gate are green. `automerge.yml` does that; it does not wait for a person.

## Mistakes

- Opening one big pull request for several things. It sits, falls behind, and conflicts with every PR opened after it (2026-11-04: #2112 grew to 1,218 changed lines and #2114 to 2,583 before they landed). Split it.
- Reading `FAIL merge-policy` and a duration as the whole story. The next lines name the rule and the file, branch or label (`merge-gate: merge-policy rule "..."`). On #2315 the rule was "the automerge workflow arms squash auto-merge and keeps the hourly run", and the file was `tools/automerge.mjs`: it no longer contains `enablePullRequestAutoMerge`. The bot squash-merges after the suite and disarms GitHub auto-merge, so the test locks that. Putting the old mutation back would land the pull request before the suite.

- Committing `skills/index.json`, `families.json`, `guide.json`, `deps.json`, `sitemap.xml` or `tower.evidence.json` in the pull request. Two of those always conflict. Take the file out; the deploy writes it.
- Slowing a schedule to avoid a conflict. The bots ship as often as they do. The conflict was the shared file, not the pace.
- Editing `domains/handoff.md` in the same lines another agent is editing. Add one line, or leave the board to them.
