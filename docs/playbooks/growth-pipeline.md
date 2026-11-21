# Verse's own build pipeline

GitHub stays the source of truth. This runner exists so a growth change can be applied and checked without waiting on an Actions queue.

## What starts it

`node tools/growth-runner.mjs --demo` applies one small change to a throwaway copy, checks the copy, and prints the record: proposed, then tested, then shipped. A failed check is rolled.

## What the first piece does

`void-live-deploy/lib/growth-runner.js` is pure. A path that leaves the tree is refused. The copy is a directory under the system temp dir, removed when the demo ends. The check list always names the stranger gate (`lib/stranger.js`). A pass may be committed later with `git push origin HEAD`. The token is `GH_TOKEN`, already in the environment. The runner never reads it into a log and `--commit` on the command refuses, so a person at a keyboard cannot print it by running the demo.

## What it will not do yet

It does not open a Cloudflare container, and it does not push. The next step is a Worker that calls this same module: Queues for the proposal, R2 or D1 for the record, and the existing token only inside the commit step.

## How to tell it worked

`node --test tools/growth-runner.test.mjs` and `node tools/growth-runner.mjs --demo` both end with state `shipped`.
