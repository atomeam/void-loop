# Card merge: two ideas make one Verse card

**Starts when:** someone asks "merge X and Y" (or combine, fuse, "what do you get if you merge X and Y"), or a frontier #34 step is claimed.

**How it works:** `skills/merge.js` parses the ask, builds a parent card for each side (a skill name uses its real stats through `cardOf`; any other idea is 1/1/0), and shows the merged card at once with the plain blend name. It then asks `/api/merge` (GET for a cached pair, POST for a new one). The route asks the free model once for `{name, line}`, keeps the pair in D1 and returns it; later callers get the same words. The numbers are computed on the page by `lib/merge-rules.js` and never come from the route.

**Commands:**
1. `node --test tools/merge-rules.test.mjs tools/merge-route.test.mjs` (rules, parsing, route with a fake model and fake D1).
2. `node tools/heavy.mjs node tools/test_void.mjs --only "Verse merge"` (the page, route stubbed, route down, refusal).
3. `node tools/ask.mjs "merge a pizza and a black hole"` to see it as a person does.
4. Ship with `node tools/finish.mjs grow "..." --test "Verse merge" --try "merge a pizza and a black hole"`.

**Worked when:** the card shows both parents, a name, the type line "Idea - merged, depth 1", `P 1 R 1 I 0` for two fresh ideas, and the source line says "Named once by Verse's model" (route up) or "Named offline" (route down); asking the pair in the other order gives the same card.

**Rules to keep:** the model returns a name and one line only (40 and 120 characters, no markup, links or key shapes); a stat rule changes only in `merge-rules.js` with its test; a model failure is never cached; typed words are never stored, only the folded pair key; the route's file header says what a stranger can make it do, keep it true.

**Mistakes made:** the Write tool turns `\uXXXX` in a file into raw characters, which broke a regex (write such files with a quoted heredoc and check with `grep -nP "[^\x00-\x7e]"`); a run of 40 or more letters counts as a key shape and is stripped from a name; the route's refusals never touch D1, so a test must not read the table after one; a skill that merges files or branches must not take the ask (the `TECH` list in `skills/merge.js`).
