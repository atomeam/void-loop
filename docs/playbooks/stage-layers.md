# Playbook: a layer on the stage (a figure on the floor, a scene behind the cards)

Written after the walker (`skills/walker.js`, 2026-10-25) and the backdrop (`skills/backdrop.js`, the same day). Both are things that live on the
stage without being cards: one in front of the floor, one behind everything. The same recipe works for the next one (rain, a lamp, a pet).

## What starts it

The owner asks for something that stands on, walks on or sits behind the stage, instead of a card: "drop him onto a solid floor so he actually
walks across a stage", "a static, beautifully lit 2D painted scene ... swap pre-rendered backdrops". Signs it is a layer and not a card: it has no
title, it is not dragged or thrown, it stays across reloads without being one of the stage's `things`.

## The shape

1. **A pure library** in `lib/<name>.js`: the asks (`xOf(text)` -> what to do or `null`), the record kept in this browser (`recordOf`, `parseRecord`,
   its `STORE_KEY` as `a2m.void.<name>.v1`), and any motion or geometry (`step(state, dtMs, width)`, `shadowRect`). Tested in `tools/<name>.test.mjs`
   and listed in `tools/checks.mjs`. Nothing in it touches `document`.
2. **A skill** in `skills/<name>.js` (`node tools/new-skill.mjs <name> --ask ... --near ...` writes the file, its order file and the index):
   - `match`/`run` take the asks; `run` returns the skill's name even when it only whispers (a `'none'` lets the ask fall to the encyclopedia).
   - The DOM: a root element it owns. In front of the floor: `position:absolute` inside `#stage`, **prepended** so the cards stay above it, and a
     `decorate()` export (the page calls every skill's `decorate(stageApi)` after each `render()` and each drag move) that re-attaches the root,
     because `render()` empties `#stage` (`stage.innerHTML = ''`). Behind the cards: `position:fixed; inset:0; z-index:0`, inserted **just before
     `#stage`** in `document.body` so it is over the stars and the drawing backdrop (`#void-backdrop`, also z 0, earlier in the DOM).
   - Motion: one `requestAnimationFrame` loop, the state advanced by the pure `step` from the elapsed time (never a per-frame `setTimeout`),
     `dt` capped so a tab coming back from the background does not leap. Reduced motion is both the media query and `html.a11y-motion`.
   - Restore: at module load, if the record is there and `#stage` exists, mount it (`setTimeout(restore, 0)`, polling a few seconds for the stage);
     guard every DOM touch with `typeof document !== 'undefined'`, because `tools/skills-check.mjs` imports every skill in Node.
   - Clearing: an ask that removes it also `localStorage.removeItem`s the record.
3. **A control on the card it comes from** when there is one (the cartoon card's "Let it walk"): a button with `pointerdown` stopped, or the card's
   drag begins and `render()` replaces the element under the pointer before the click lands.
4. **A browser section** in `tools/test_void.mjs` (`fresh({ phone: true })` for anything near the floor), the family in `tools/families.mjs`, a line in
   `docs/MAP.md`, `node tools/refresh.mjs`, the ledger line (`node tools/grow.mjs grow ... --show ...`).

## How to tell it worked

- `node --test tools/<name>.test.mjs`, `node tools/skills-check.mjs` (the asks reach the skill first; the near misses do not).
- `node tools/heavy.mjs node tools/test_void.mjs --only "<name>"`.
- **Look at it**: a 390 px screenshot with the layer on (a scratch Playwright script that stubs `/api/card-art` with a picture drawn on a canvas in the
  page is enough; nothing is committed). Say what it shows without its name. The first walker screenshot showed the figure standing behind the ask
  bar and its bubble cut off at the edge: both were real bugs the suite had passed.

## Mistakes made, so they are not made twice

- **The floor is not the stage's bottom.** `#stage` ends 72 px above the window, but on a phone `#dock` stands taller than that, so "bottom: 24px"
  put the figure behind the ask bar. The visible floor is `#dock`'s top edge: lift the root by the overlap (`dockLift`), looked up every few frames,
  because the dock grows when a whispered line appears under the input.
- **Keep what you float inside the stage.** A bubble centred over a figure at the right edge was clipped (`#stage` is `overflow:hidden`): clamp its
  left to `[8, width - w - 8]` and point its tail at the figure with a custom property.
- **Never mirror the words.** The flipped figure (`scaleX(-1)`) mirrored its bubble: the bubble is the root's child, not the button's.
- **No `filter` on cards.** A `drop-shadow` filter on `.thing` flattens anything with `preserve-3d` inside (the coin, the game box, the 3D calendar).
  Cast shadows are a synced layer of boxes under the cards (`shadowRect`), re-placed in `decorate()`.
- **A sticky is drawn rotated**: measure a shadow against the card's `offsetTop`, not its bounding box.
- **A new kind in the Art Forge** is a row in `KINDS`/`KIND_ALIAS`, its own key prefix (`backdrop1 `, so it never replaces another kind's picture of the
  same words), a size on the models' grid of 16, a prompt, and `undirected()` so the Art Director is not asked (the kind has its own style).
- **The two asks "clear the backdrop" and "remove my backdrop"**: the page's look handler already takes "remove my backdrop" for the Draw card's
  picture, and skills run before it. The skill takes "clear the backdrop" and fires the page's own `void-backdrop` event with an empty `src`, so a
  drawing backdrop still clears as before; "remove my backdrop" is left to the page.
- **Register the family** (`tools/families.mjs`) before `node tools/refresh.mjs`, or it stops at `families`.
- **A rebase onto main conflicts in generated files** (`skills/deps.json`, `void.growth.json`): take main's copies, re-append the ledger line with
  `tools/grow.mjs`, run `node tools/refresh.mjs`, continue.
