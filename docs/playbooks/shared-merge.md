# Shared files, the check set, and two fix tries

A conflict in `void-live-deploy/skills/index.json`, `what.json` or `first.json` is the union of both sides, keyed by skill id and sorted. `families.json`, `deps.json` and `guide.json` are not a skill-id map, so they stay on the existing regenerate path. `domains/growth-inbox.md` is keyed by the ask. Status only moves forward: open, then building, then shipped. `tools/merge-main.mjs`, `tools/merge-gate.mjs` and the helper rebase (`tools/shared-merge.mjs --rebase` from `helper-pr.yml`) use that. A rebase onto main stores main in stage 2, so the rebase path reads the stages the other way round. No model.

Automerge does not merge a head whose check set is only the checks that happened to report. The head SHA needs `void-review`, `merge-gate`, `test-and-deploy` and `collide`, each completed and green. A missing one is started again (`tools/loop-checks.mjs`) and the pull request waits. #2732 was opened by the actions bot, so the pull-request workflows did not start with the pull request.

The copy rewriter and the conflict fixer each get two attempts, stored in one hidden comment (`<!-- fix-cap copy=N conflict=N -->`). The third attempt does not push.
