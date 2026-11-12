# A ledger wiped whole, and the guard that catches it in CI

**Starts when:** a file the loop treats as append-only (the growth ledger, `domains/void.frontier.md`, `domains/handoff.md`, `domains/lists.metrics.json`, `domains/void.voice.md`, `docs/convergence.md`) arrives on main much shorter than it was — a whole-file write (an editor save, a bad merge resolution, a script that opened it `w`) replaced it with a stub or one word. The frontier reaching main as a single `PLACEHOLDER` line (PR #2701, 2026-11-11) is the one that started this playbook.

## What to read first

1. The file on main, not in your worktree: `git show origin/main:<path> | wc -l` and `git show origin/main:<path> | head`. If it is short, find the commit that did it: `git log --oneline -- <path>` and look for a `+1 -601`-shaped diff (`git show --stat <sha> -- <path>`). The PR that merged it is the culprit; the intended one-line change is usually inside that same PR's other files (here: "Mark client lift summary shipped", a `growth` edit).
2. Whether main already restored it. Lists runs do this by hand: `domains/handoff.md` and the growth ledger name them. If a later PR ("... the frontier whole again") already brought the file back, your restore is redundant — do not redo it, and do not "fix" the two annotation lines it moved; main's version is canonical.
3. Why the guard did not fire. Two guards can exist and both miss:
   - `tools/prepush.mjs` `ledgerShrinks(path, before, after)` needs a **base** to compare against, so it only catches a shrink a builder can see locally.
   - a per-file test (`tools/frontier-intact.test.mjs`) may run only from `tools/checks.mjs`, and **no CI workflow runs `checks.mjs` directly** (`verify.yml` and `deploy.yml` run their own steps). Registered in `tools/checks.d/` is not the same as run in CI.

## The fix

- Restore, if main has not: `git show <good-sha>:<path> > <path>` from the last good commit, then fold in the intended one-line change from the PR that wiped it (do not drop it). Land it with the normal run (`node tools/finish.mjs fix "..."`).
- The guard that lasts is **base-free**: a whole-file wipe leaves a file that is a stub or a placeholder, no base needed. `tools/prepush.mjs` exports `LEDGERS` (the append-only files) and `ledgerWiped(path, text)` (under 40 bytes, or starting with `PLACEHOLDER`/`SEE_DISK`/`TODO_REPLACE`). `tools/guard-source.mjs` reads every `LEDGERS` file and fails on `ledgerWiped`, and it runs in `deploy.yml`'s "Quick checks" — on every pull request and every head of main. Add a new ledger to `LEDGERS`; the summary line prints `N ledgers whole`.

## How to tell it worked

- `node tools/guard-source.mjs` → `... N ledgers whole` and exit 0 on a clean tree.
- The regression: `printf PLACEHOLDER > domains/void.frontier.md` then `node tools/guard-source.mjs` prints `FAIL domains/void.frontier.md: 11 bytes: a ledger was wiped by a whole-file write...` and exits 1. Restore the file; it exits 0 again.
- Unit: `node --test tools/prepush.test.mjs tools/wiped-files.test.mjs`.

## Mistakes already made

- Treating the per-file test's registration as "it runs in CI". `tools/checks.d/*.chk` is discovered by `tools/checks-list.mjs` and run by `tools/checks.mjs`; if no workflow calls `checks.mjs`, the test is dormant.
- Restoring the file by hand when a lists run already did it, then fighting its two annotation lines. Check main's handoff and the growth ledger first.
- Rebuilding a wipe guard on top of the shrink guard (which needs a base) instead of writing the base-free one. A wipe is visible with no history at all: the file is a stub.
