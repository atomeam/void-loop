# Playbook: a pack of stage effects (motion, mutation, removal, floods) with nothing saved until it should be

Written 2026-10-18 after building stage pack E, the Opposite Era (`skills/riot.js`, `skills/mutate.js`, `skills/sudden-death.js`, `skills/overload.js`, `skills/extinction.js`, shared `lib/opposite-era.js`), five skills that move, change, flood or remove what is already on the stage. A stage bridge (`stage-bridge.md`) hands text between two kinds; an effect acts on every kind at once, so the rules are different.

## What starts it
The owner or V01D asks for a set of named effects on the stage ("start the riot", "mutate this card", "sudden death in 60 seconds", "overload me", "mass extinction"). Build them as one pack: one shared lib, one unit test file, one browser section, one PR.

## The shape that worked
1. **Scaffold every skill first** so the routing order and index are generated, never hand-edited: `node tools/new-skill.mjs riot --ask "start the riot" --ask "end the riot" --near "riot games"` (one per skill, each with its look-alikes as `--near`). `node tools/skills-check.mjs` must say clean before any code is written.
2. **Draw, do not save.** Motion that must not change where things are (the riot) is drawn with an inline `el.style.transform` (plus `el.style.transition = 'none'` while it runs: `.thing` in `void.html` transitions transforms over .35 s and would smear the frames). `th.x`/`th.y` are never written; ending the effect sets both styles back to `''` and the stylesheet's own transition eases everything home for free. The page's `render()` replaces every element, so a frame loop looks the element up by id each frame (`lib/opposite-era.js` `elOf`) and drops bodies whose element is gone.
3. **A look that is a show, not a change** (the mutation) is the same: inline `filter`/`transform`/`border` on the element, a small tag appended inside it, all re-applied each tick because a redraw wipes them. Replay from a seed (`genomeAt(seed, gen)`) so "lock generation 7" is the same generation 7 whether it is ahead of or behind now.
4. **A banner or a flood that must survive a redraw but never a reload is an ephemeral stage kind:** `stageKinds: { 'sudden-death': { mount, ephemeral: true } }`. The page mounts it on every `render()` and leaves it out of the saved state (`keptThings()` in `void.html`). One module-level interval, re-finding its element by id on each tick, never one per mount (a redraw would leak them).
5. **What may be taken is one rule in one place:** `lib/opposite-era.js` `isSafe` (a kept card, `keep`, or `pinned`: the page sets `pinned` on anything put down by hand) and `removable(things)`; every pick takes its random source as an argument so the test can pin it.
6. **Removal is a promise, not a side effect:** animate with `el.animate(...)`, delete from `things()` in `onfinish`, then `save(); render()`. Reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`) skips straight to the deletion, and an effect that is only motion (the riot) does nothing and says so.
7. **A drop onto another thing is the kind's `dropped(th, stageApi)` hook** (bindDrag calls it on set-down), with the geometry pure (`dropTarget(id, boxes)`) and read off `offsetLeft/Top/Width/Height`.
8. **A destructive ask confirms on the card:** `api.showPage` with a form; `input.addEventListener('keydown', (e) => e.stopPropagation())` so typing the word is not an ask; nothing is deleted until `confirmed(typed)` is true.

## The commands
- `node tools/new-skill.mjs <name> --ask "..." --near "..."` for each; `node tools/skills-check.mjs`.
- `node --test tools/stage-pack-e.test.mjs` (the pure parts: matchers in and out, physics inside the bounds, genome within limits, picks never a safe thing, spawn seeded, merge, confirmation).
- `node tools/heavy.mjs node tools/test_void.mjs --only "stage pack e"` (one section for the whole pack, every effect on one page in turn; `P.p.emulateMedia({ reducedMotion: 'reduce' })` for the still case).
- `node tools/ask.mjs "<three near misses>" "<the asks>"`: the near misses must still print the route they had before (`article fallback`, `short topic`), the asks `skill:<name>`.
- `node tools/deps.mjs; node tools/families.mjs; node tools/guide.mjs` (the five go in a family in `tools/families.mjs` first), `node --test tools/map-coverage.test.mjs`, one `docs/MAP.md` line, `VOID_SKIP_BENCH=1 node tools/checks.mjs`.

## How to tell it worked
The saved state's `x,y` of every thing is identical before, during and after the riot while at least two elements carry a `translate(` transform; the gen tag reads `gen 7 · locked` a second after the lock; the state has one thing fewer after sudden death and the same number after a cancel; 24 `.overload-card` elements and none in the saved state; the extinction card refuses a wrong word with nothing removed and leaves exactly one thing, marked `survivor`.

## Mistakes made
- Letting a kind word in the ask ("mutate the selected card") reach the page's `targetKind`: "card" means a link there. Words like card, thing, one, selected mean the picked thing; map them before looking a kind up.
- Running the fast checks in the foreground on a machine shared with other agents' browser jobs: they can take longer than ten minutes. Run them in the background with the log in the scratchpad.
