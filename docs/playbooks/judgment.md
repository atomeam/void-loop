# Judgment before a ship

What starts it: a lap of `tools/verse-loop.mjs` has a change whose checks passed, or Verse review is deciding a pull request.

`node tools/judgment.mjs --base origin/main` asks the free model one question, with the goals from `domains/void.canon.md` and `docs/RULES.md`. Exit 0 is a yes. Anything else, including no model, is a no, and the change is not shipped. The lap fixes it once and asks again.

It worked when a fake yes in the test ships and a fake no leaves the tree clean. A vague answer is a no.
