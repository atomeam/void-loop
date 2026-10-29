# A forge recipe: a new thing "make me a ..." can print

**Starts when:** `node tools/misses.mjs` (or the growth card's "My probes", `forgeWants`) lists a "make me a <thing>" the forge cannot make, or the forge history card shows a want marked "not made yet".

1. Add the recipe to `THINGS` in `void-live-deploy/skills/forge-rules.js`: shapes in millimetres (spheres, ellipsoids, capsules, boxes, `cut: true` carves), a blend `k`, a `cell`, the `names` that summon it, and `FLOOR` last so it has a flat base. A figure as a recipe reuses the stage's own body (`personShapes`, from `sdfmesh.js PERSON`): the same shapes the roaming figure is meshed from.
2. The recipe's id (`recipeId`) is made from the recipe as written; a change gives a new id, and the STL's file name carries it. Never edit a shipped recipe to "fix" a look without meaning to change its id.
3. Test in `tools/forge.test.mjs` and `tools/forge-asks.test.mjs`: it reads as itself (a shape check), `F.verifyStl(F.stl(m), m).ok`, it fits the 180 mm bed. Update the counts in `tools/forge.test.mjs` and `tools/inventory.test.mjs` ("N of N checked").
4. By hand in the page: `make me a <thing>`, `check it before printing` (geometry check, no download), `print it` (STL), `forge iterations` (the make kept with its recipe id), `what have i printed` (the print ledger in the inventory, written by "print it" and "export a print file").
5. Ship with `node tools/finish.mjs grow "forge makes <thing>, asked by Verse" --test "forge" ...`.

**Mistakes made:** the name list in `NAMES` also builds the matcher for the check and iteration asks, so a name that is a common word ("man", "statue") must not collide with a figure skill (the test `figure skill` loop catches it); the inventory skill may not touch storage itself (its test forbids `localStorage`), so ledgers are read through `lib/prints.js storeOf`.

# Forging an offered routine into a skill (owner step)

**Starts when:** the owner has approved an offered routine ("offered routines" card) and wants it as a real skill.

1. `node tools/routine-skill.mjs --list` shows the approved routines; `node tools/routine-skill.mjs <id>` writes `skills/routine-<author>-<name>.js` (its asks are string data, one exact phrase "run <author>'s <name>"), the order file and `skills/index.json`.
2. `node tools/finish.mjs grow "forged <skill>, asked by Verse" ...` commits and opens the PR. Nothing is read from a key and nothing is committed by the site itself.
