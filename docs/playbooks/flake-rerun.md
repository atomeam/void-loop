# One rerun when verify fails

When a job of Verse verify fails on main, that job runs once more (`tools/flake-rerun.mjs` from `verify.yml`). A pass appends the failed check to `tools/flakes.json` and the run stays green. A second failure uses the revert or heal path already in `verify.yml`.

`node tools/flake-rerun.mjs decide --failed --rerun pass` prints `record` and `green`. `node --test tools/flakes.test.mjs` checks that path.
