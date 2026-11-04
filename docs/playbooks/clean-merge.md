# Land a change without a conflict

What starts it: you are about to open a pull request, or a pull request is sitting dirty because it rewrote a file the deploy generates.

## Before you open it

1. One pull request for the one task.
2. `git fetch origin main` then `node tools/merge-main.mjs` so the branch is on top of main. A conflict outside the append-only records and the build outputs needs a person; the command names the files.
3. Do not commit a build output. The list is `tools/generated.mjs`. Add a skill as `void-live-deploy/skills/order/<rank>-<name>`. Add a ledger line as `growth/entries/<file>.json` (`node tools/grow.mjs` does that on a branch). A red suite writes `void-live-deploy/incidents/entries/<sha>.json`. A Versus floor writes `void-live-deploy/tower-evidence/<floor>.json`.
4. `node tools/pre-pr.mjs` — it refuses a branch behind main or one that commits a build output, then runs the fast checks.

## What "it worked" looks like

- `node tools/pre-pr.mjs --check-only` prints `on top of main, and no build output in the diff`.
- The pull request's `merge-gate` check is green. It merged main in a temporary tree, regenerated the build outputs, and ran the fast checks there.
- GitHub shows auto-merge armed (squash) once Verse's review and the merge gate are green. `automerge.yml` does that; it does not wait for a person.

## Mistakes

- Committing `skills/index.json`, `families.json`, `guide.json`, `deps.json`, `sitemap.xml` or `tower.evidence.json` in the pull request. Two of those always conflict. Take the file out; the deploy writes it.
- Slowing a schedule to avoid a conflict. The bots ship as often as they do. The conflict was the shared file, not the pace.
- Editing `domains/handoff.md` in the same lines another agent is editing. Add one line, or leave the board to them.
