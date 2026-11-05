# Playbook: a helper push opens its own pull request

A push to `helper/*`, including one from Grok, runs `.github/workflows/helper-pr.yml`.

## What starts it

The push. The plan is `tools/helper-pr.mjs` (`plan`, `inboxJobs`).

## What it does

- If the branch is behind main, rebase it onto main and push with `--force-with-lease` on that helper branch only. A rebase that conflicts is aborted and filed as a heal job. Main is not rewritten.
- If main lacks commits and no pull request is open, open one labelled `automerge`.
- If the skill check or the rebase fails, still open the pull request and file a `heal:<branch>` job on the build queue (the conductor's heal path). The idea is not dropped.
- A `Growth inbox item` block in the commits or the pull request body becomes a `feature:inbox-…` build job. A block marked `private: yes` does not.

## How to tell it worked

`node --test tools/helper-pr.test.mjs`. On GitHub, the push's "Verse helper PR" run prints the pull request URL, and the pull request carries `automerge`.

## Mistakes

Leaving with exit 0 and no pull request when the skill check failed dropped the idea (2026-10-30). The check still runs. The failure is now the heal job's reason.
