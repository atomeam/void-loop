# Upgrading Void: the short version

Written for the simplest agent that can run a shell. `AGENTS.md` has the full rules; this is the path that works.

## Add a skill (five steps)

1. Pick what to build. In this order: what Void asked for (`node tools/reflect.mjs`), a real miss (`node tools/next-skill.mjs`, needs `VOID_MISSES_TOKEN`), the top of `domains/void.growth.md`.
2. `node tools/new-skill.mjs <name> --ask "an ask it answers" --ask "another" --near "a look-alike it must not take"`
   Writes `void-live-deploy/skills/<name>.js` (a working card on exactly your examples), its routing-order file, the generated index, and runs the collision check.
3. Edit the new file: widen `WHEN` to the phrasings people type, replace `ANSWER` with real work (`api.showPage`, `api.esc`; look at `skills/tip.js` or `skills/sleep.js`). Name the source on the card.
4. `node tools/merge-main.mjs`, then `VOID_SKIP_BENCH=1 node tools/checks.mjs`. Fix what it prints; it names the file.
5. `node tools/grow.mjs grow "what Void can do now"`, one line in `docs/MAP.md`, `node tools/push.mjs`, open the PR, `node tools/automerge.mjs <pr> --label`. Then move on.

Never hand-edit `skills/index.json`, the agent log's old lines or the growth ledger's old lines.

## How Void upgrades itself

`/api/miss` records what Void could not answer -> `lib/learn.js` turns an ask missed 3 times by people over 2 days into a `miss:<slug>` job (misses tagged `origin: agent` do not count) -> a builder claims it (`python tools/void_queue.py claim`) -> steps 2 to 5 above. Each job's note says what the router made of the ask (`router skill:<name> 0.78` means a skill should have caught it: extend that skill instead of adding one).
The model-drafted version of this (`tools/learn-draft.mjs`) needs `OPENROUTER_API_KEY` and `VOID_OWNER_TOKEN` set by the owner; without them the loop stops at the queue and a builder does the rest.
