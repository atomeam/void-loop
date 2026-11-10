# Playbook: an older loop pull request is closed only when its work is already kept

A newer `loop/*` pull request used to close every older one. On 2026-11-09 that closed #2569 (`loop/20261109-131044`, the hexen.ai lap) because #2598 (`loop/nightly`) was open. #2598 only changes `void-live-deploy/progress/nightly.json`. The feature note, the tower row and the lap line were on neither #2598 nor main.

## What starts it

`tools/automerge.mjs` during a sweep, when two or more bot `loop/*` pull requests are open. `lab/sync-*` is still one queue: the newest import closes the older ones.

## What it does

For each older loop pull request it reads `compare/main...<head>` for that pull request and for the newest one, and the same paths on the main checkout.

`loopCovers` in `tools/merge-policy.mjs` keeps a file when every added run of lines already sits together on main or in the newer patch, and a pure deletion is already gone from main or deleted by the newer patch. A missing patch, a compare with no `files` array, or a thrown check does not count as contained.

- Contained: the bot comments `<!-- void-superseded -->` and closes the older pull request.
- Not contained: the bot comments `<!-- void-carry -->` once, names the missing paths, and includes the missing patch (cut at 4000 characters). The pull request stays open and can still merge. The sweep adds the automerge label if it is missing. A pull request the owner opened on `helper/*` is eligible either way.

## How to tell it worked

`node --test tools/merge-policy.test.mjs`

The hexen case is in that file: a newer patch that only touches `nightly.json` leaves `domains/features/ai-consulting.json` and the `ai-consulting` tower row missing. The same lines on main, or the same patch on the newer pull request, count as contained.

## Mistakes

Closing because the newer pull request is newer. Age is not the work. #2569 was reviewed and ready, then closed, and the three files never reached main.

Treating a compare that failed, or a diff too big to list, as an empty change. An empty `files` array means the branch adds nothing. No array means the answer was not read, and the older pull request stays open.

Carrying the work by deleting the branch. The branch is the copy. Leave it, and land the missing files on a helper branch when the older pull request can no longer merge.
