# Build Verse's own asks: read its voice, check what is built, ship one small thing per ask

**Starts when:** the owner says "build what V01D wants", or a run starts and `domains/void.voice.md` lists "Void's current asks" nobody has built (AGENTS.md: Verse's asks come first, oldest first, say "asked by Void").

1. **Read the asks word for word** in `domains/void.voice.md` ("Verse's current asks" and the older Asks lines). Never reword them. Skip any that touch money, prices, secrets or the owner key.
2. **Group repeats.** The same ask is often written several times a day in different words (Family Health 13 times). One build answers all of them; name the ask ids in the PR.
3. **Check whether it is already built before writing code.** Search `void-live-deploy/void.growth.json` for the words (`python3` over `what` and `asked`), `docs/MAP.md`, and the code (`grep -rn` for the name). Then try it the way a person would: `node tools/ask.mjs "<an ask>"`. Most repeats are already built; the gap is usually small (a routing phrase, a missing field).
4. **Already built:** record it with `node tools/finish.mjs finding "already built, recorded for Verse's asks (asked by Verse): <ask> is <where>"`, one PR for all of them, with the file or ledger line as evidence. No new code.
5. **Gap:** build the smallest piece in its own worktree and branch (`git worktree add -b helper/<name> /home/user/<name> origin/main`; symlink `node_modules`). Do not use the shared tree; another agent may switch its branch.
6. **Test only what changed:** a unit test in `tools/`, and one section with `node tools/test_void.mjs --only "<section words>"`. `--only` matches section names, not check names; a check inside the shared `t` page runs only in the core run, so put a new check in a section that uses `fresh()`.
7. **Finish:** `node tools/finish.mjs grow "asked by Verse: ..." --asked "<a few of Verse's own words for the ask, or its ask-… id>" --brief ... --test "<section>" --show ... --try ...`. Give `--test` the section you changed. On a loaded machine step 6 (checks) can take over 20 minutes or hang in `perf3d`; wrap it in `timeout`, kill only the checks processes, and resume with `--from 7`. Never `pkill -f` a pattern that appears in your own command line.
8. **PR:** no signed-in `gh`: open it with the GitHub tool, add the `automerge` label, subscribe to its activity.

**Mistakes already made:** rebuilding a thing that existed (check the ledger first); a `--test` naming another section so the first-shot check did not cover the change; running `finish` in the shared tree after another agent switched its branch (it pushed their branch); `pkill -f` killing the shell running it; adding new numbers to flavor or swap text that the evidence does not give.


**Mistake (2026-10-17):** "asked by Verse" without `--asked` linked nothing, so the self page read "0 of my 45 asks" built. finish.mjs now stops it; an already-built ask gets a `words` link in void.asks.json (a few key words of the ask, so its rewordings match).
