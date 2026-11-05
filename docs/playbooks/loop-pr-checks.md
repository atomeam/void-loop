# A loop pull request's checks start on their own

What starts it: a lap of `tools/verse-loop.mjs` (`.github/workflows/verse-loop.yml`, `verse-job.yml`, or the nightly note in `verse-engineer.yml`) opens or updates a `loop/*` pull request with the workflow token. The author is `github-actions[bot]`.

## What is wrong, and what is not

GitHub's change of 2026-06-11 ("Bot-created pull requests can run workflows if approved") creates a `pull_request` run for `opened`, `synchronize` and `reopened` when the workflow token made the pull request, and leaves that run approval-required: conclusion `action_required`, no jobs, until a write-access approval. Other activity types create no run. `workflow_dispatch` always runs.

Before that change, the same pull requests created no `pull_request` run at all. The ones that merged (#2118, #2193, #2213, and the October ones) did it by the back door: the held runs have zero check runs, so after three quiet minutes `tools/automerge.mjs` saw "void-review never started" and dispatched `void-review.yml`. That review passed and woke automerge, which squash-merged. The held runs were then marked failure as the pull request closed. #2060 was different: a person approved the runs (`triggering_actor` `atomeam`), so the `pull_request` jobs actually ran. #2261 was approved the same way once, its checks passed, and automerge merged it. Approving by hand is not the fix.

`VERSE_LOOP_TOKEN` is the slot for a fine-grained token or a GitHub App installation token. It is unset: every loop pull request's author is still `app/github-actions`. With that secret set, `pull_request` runs start on their own and this dispatch does not. Without it, the lap sets `VERSE_LOOP_DISPATCH_CHECKS=1` and starts the checks itself.

## Commands

From a lap (the workflow does this; a person can do the same for a pull request that is already open):

```bash
node tools/loop-checks.mjs --pr <number> --ref <branch>
```

That starts, on the branch, the workflows a `pull_request` open would have started: Verse review, the merge gate, Verse deploy (quick checks only, `pr` set, no upload), Collide, automerge, and the path-limited ones when the diff touches them (Loop critic, workflow-lint, the bench, Ouroboros, the ringer). `--from automerge` leaves automerge out, because that sweep is already running.

How to tell it worked: each line says `<file>: started`, and the run's event is `workflow_dispatch` with a job that has started. The `pull_request` run may still sit approval-required. It has no check runs, so it does not fail the head. The dispatched jobs are the checks.

## Mistakes

- Dispatching `deploy.yml` with no `pr` input is a manual run: the full suite, then an upload whose branch name is main. The `pr` input forces the quick checks and the upload step requires `inputs.pr == ''`.
- Starting `automerge.yml` from inside automerge starts another sweep. `--from automerge` is that guard.
- Treating an approval of the held runs as the fix. The next loop pull request is born the same way.
- Skipping a check to get the merge. The dispatch runs the same jobs. Verse's review still decides, and a red check still holds the merge.
- Reading only the automerge run that was dispatched on the loop branch. That one often logs `merge gate in_progress` and exits. The merge gate's last step starts automerge again, on main (`workflow_dispatch`, input `pr`). #2264 merged from that second run. #2268's second run logged `safety-check fail (tools/openapi-check.mjs failed)`: the lap added `/api/productsearch` and did not put it in `openapi.json`. The held `pull_request` runs stayed `action_required` and `mergeStateStatus` stayed `UNSTABLE`. That did not block the merge. #2264 was unstable, GitHub refused to arm auto-merge (`Pull request is in unstable status`), and the squash PUT still landed. Self-heal does not see a safety hold: the GitHub checks are green. Document the route (or name it as Verse's own, with a reason) and push. The next automerge reads the new head. Do not approve, skip, or close the held runs to shrink the list.
