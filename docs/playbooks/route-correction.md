# Route correction: a skill took an ask that is not its job

**Starts when:** the owner replies to a card with a correction such as "I am quoting a conversation about your memory, not fixing a webhook" (the "Reply to what I said, or correct me" section at the end of every card, lib/card-reply.js and functions/api/voice-reply.js). Verse answers, and when it agrees the wrong skill answered (`misroute`), the reply leaves a `route:` job in the build queue: `stop answering "<ask>"`, with a note naming `(wrong skill:<name>) (wanted <skill:name or answer>)` and the owner's words.

**Verse does it itself when the skill is a file in `skills/`:** `.github/workflows/propose-fix.yml` (`tools/propose-fix.mjs`) picks the oldest open `probe:` or `route:` job. For a `route:` job it asks `/api/propose-fix` in `narrow` mode: Verse proposes the narrowest matcher change that makes the skill reject the ask and asks like it, and adds the ask to `nearMisses`. The checks, in order: the collision check, **lets go** (the edited skill, loaded fresh, must no longer `match()` the ask), the skill's unit test, Verse's review as a gate, and the benchmark on every bench ask the skill already answers. The pull request it opens says how sure Verse was and which lines it changed.

**A builder does it when the route is made inside the page** (the automation fix, the answer engine, articles: `routed.skill` names something with no file in `skills/`). `pickJob` skips those jobs so they never block the probes:

1. **Reproduce:** `node tools/ask.mjs "<the ask>"` shows who answered.
2. **Find the matcher in `void.html`** (for the automation fix, the paste/fix intent check near `fixReady`) and tighten it the way a skill's matcher would be: one exclusion or one narrower pattern, never a rewrite.
3. **Add the ask as a bench case** with the `want` the job's note names (`node tools/append.mjs bench`), so the misroute can never come back unnoticed.
4. **Ship:** `node tools/finish.mjs fix "…"` with the browser section that covers that route; mark the job done (`python tools/void_queue.py done <id> live`).

**Mistakes to avoid:** narrowing a pattern until the skill's own examples stop matching (the skill check and the benchmark catch this; read why it failed before trying again); treating a misroute as a missing skill (the ask needs the route it wanted, usually the plain answer, not a new card).
