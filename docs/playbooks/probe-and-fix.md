# Probe and fix: grow a skill from the asks it misses

**Starts when:** an area answers badly (a miss on the board, a voice ask, a family the self-page calls weakest), or nothing else is queued.

**V01D does steps 1 and 2 itself (2026-10-15):** once a day `.github/workflows/probe-asks.yml` (`tools/probe-asks.mjs`) has V01D's own model write 25 asks for the family it is least proven in (`/api/probe-asks`, owner only; `lib/probe-asks.js` keeps only plain, bench-shaped ones), probes them, and queues the misses as `probe:` jobs with the ask and its want in the note. A builder picks a `probe:` job up at step 3 (`node tools/ask.mjs`) and carries on; the asks V01D wrote are never committed, so write your own paraphrase at step 6 if the fix earns a bench line.

1. **Write 20–30 asks** in one area, the way people type them (typos, short forms, "how many cups is 500g of flour"), each `{ "ask", "want", "says" }` in the shape of `tools/bench.json`. Paraphrases only, never a visitor's exact words (the repo is public).
2. **Probe:** `node tools/bench.mjs --probe asks.json` prints only the misses. The bench stubs places (every place is Paris), countries and Datamuse, so a `says` there can only check who answered.
3. **For each miss, find who answered:** `node tools/ask.mjs "the ask"` shows the skill, the card text and any page error.
4. **Fix in the owning skill's matcher**, not in a new skill, unless no skill owns the area. Keep every new phrase narrow: run the old asks of that skill again only if the matcher you touched is shared.
5. **Re-probe the misses:** `node tools/bench.mjs --again`. A wrong expectation is a fix to the ask, not the skill.
6. **Add the batch:** `node tools/append.mjs bench --skip asks.json`.
7. **Ship:** grow line, agent-log line, `VOID_SKIP_BENCH=1 node tools/checks.mjs`, `node tools/push.mjs`, PR with automerge.

**Mistakes already made:** a broad rewrite rule broke "how many miles is 10k" (restrict rewrites to known unit words); "sunscreen" in one skill's matcher stole another skill's example (run `node tools/checks.mjs`, it checks collisions); a weather matcher took "medium rare steak temperature" (exclude the other domain's words).
