# Build a skill by calling skills Verse already has

Atom, 2026-11-03: "it should learn to use its skills it builds to build more skills."

A new skill starts from skills that already answer part of the ask. The builder searches them, calls at least one (the same `runSkill` path as `POST /api/mcp`, then that skill's own pure maths when the card does not take the ask), copies their tests as examples, and records the ones that answered as `builtWith`.

**Starts when:** something is about to write a skill file: `tools/new-skill.mjs`, the new-skill lane (`tools/build-miss.mjs scaffold`), a will candidate whose title says "skill" (`tools/will.py`), or a conductor job whose ask or note says "skill" (`tools/conductor.mjs`). Tower does not write skill files (`tools/tower-self.mjs`); the same command is what a tower lane runs when it does.

## The steps

1. **Search.** `node tools/skill-compose.mjs --ask "<the ask>" --json` reads `skills/index.json` and each skill's header, examples and test file. A calculator (`evaluateMath`) and a unit converter (`pairOf`) rank above a loose word match. There is no skill named fetch today; a later one with "fetch skill" in its header is searched the same way.
2. **Call.** For each of the top three, the builder loads that skill and calls it. `runSkill` runs first. When the card answers something else (the calculator does not take "36 / 3"; the converter card does not take "90 miles in km"), the builder uses the skill's own function: `evaluate` or `pairOf` + `convert`.
3. **Reuse the tests.** The reply's `examples` list is those skills' test strings, then their card examples. A new skill's asks should look like the ones those tests already check.
4. **Record the lineage.** A skill that answered is `export const builtWith = ["calc","convert"]` in the skill file, just before `export default`. The deploy's `node tools/skills-index.mjs --write` copies that into `skills/lineage.json` (`count` is how many skills were built with skills). That file is a build output, like `index.json`: do not commit it.
5. **Show it.** The new card says "Built with …". `/brain/` (Knows) shows that line on the skill and "N skills built with skills" under the search.

**How to tell it worked:** `node --test tools/skill-compose.test.mjs tools/drive-share.test.mjs` passes, including the test that the builder's `invoke` runs at least once. `node tools/skills-index.mjs --check` prints the count. On the site, the ask "split a 90 mile drive costing 36 dollars between 3 people" opens Drive share, and https://a-to-mind.com/brain/?find=drive-share shows the same lineage.

**What it will not build:** a skill that only names other skills in a comment and never calls them; a change to the shape of `skills/index.json` (it stays a list of names); a fetch that is not a skill Verse already has.

## Mistakes to not repeat

- Stamping `builtWith` into the middle of the scaffold. The new-skill lane's fill replaces only the `WHEN` line, the `ANSWER` line, the examples list and the Source line (`tools/build-miss.mjs` `applyFill`). The stamp goes immediately before `export default`.
- Letting a drive ask land on the tip card. "split … between N people" is a bill, until the ask also names miles or kilometres and no tip (`skills/tip.js`).
- Hand-editing `skills/lineage.json`. The order files and `export const builtWith` are the source; `--write` rebuilds the file.
