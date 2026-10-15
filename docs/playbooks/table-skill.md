# A table skill: a new skill answered from a built-in table

**Starts when:** a whole kind of ask falls through to an article or a model and the answers are stable facts (food values, kitchen swaps, unit tables).

1. `node tools/new-skill.mjs <name> --ask "<one real ask>" --near "<a look-alike it must not take>" --rank <NNNN>`: the rank puts it before the skills that would otherwise take its asks (`ls void-live-deploy/skills/order`).
2. **The table first:** each row whole, from one named source (USDA FoodData Central for food; the usual kitchen equivalents for swaps). Write the test of the table before the matcher: every row complete, and a sanity check that ties the numbers together (calories ≈ 4·protein + 4·carbs + 9·fat).
3. **The matcher:** an exported pure function `xAsk(text)` that returns the row or null. Test the phrasings people type and a list of look-alikes that must return null ("substitute teacher", "out of office").
4. **The card:** `showPage`, everything through `esc()`, the source named at the bottom.
5. Register the test in `tools/checks.mjs`, add the skill to a family in `tools/families.mjs` (then `node tools/families.mjs`), one line in `docs/MAP.md`.
6. If an earlier skill takes some of its asks (recipe took "how to make buttermilk"), make that skill defer: `import { xAsk } from './x.js'` and `&& !xAsk(text)` in its `match`.
7. Probe 10–15 asks (playbook probe-and-fix), then ship.
