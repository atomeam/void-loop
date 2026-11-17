---
name: verse-skills-and-3d
description: How to add a routable card skill in void-live-deploy/skills/ and how to build a card's 3D miniature, in atomeam/void-loop (Verse). Use when creating a new skill, widening a skill's phrasing, adding a 3D miniature, or working with the shared scene engine, three.js meshes, or make.js solid shapes.
triggers:
  - new skill
  - add a skill
  - skills/index.json
  - routing order
  - miniature
  - scene3d
  - three.js
  - 3d model
  - mesh winding
  - make.js
---

# Skills and 3D miniatures in Verse

## Add a skill (the five steps)

1. **Pick what to build**, in this order: what Verse asked for (`node tools/reflect.mjs`), a real miss (`node tools/next-skill.mjs`), the top of `domains/void.growth.md`.
2. **Scaffold:** `node tools/new-skill.mjs <name> --ask "an ask it answers" --ask "another" --near "a look-alike it must not take"`. Writes `void-live-deploy/skills/<name>.js` (a working card on exactly your examples), its routing-order file, the generated index, and runs the collision check.
3. **Edit the new file.** Widen `WHEN` to the phrasings people type; replace `ANSWER` with real work using `api.showPage` and `api.esc` (see `skills/tip.js`, `skills/sleep.js`). Name the source on the card.
4. **`node tools/merge-main.mjs`**, then `VOID_SKIP_BENCH=1 node tools/checks.mjs`; fix what it names.
5. **`node tools/grow.mjs grow "what Verse can do now"`**, one line in `docs/MAP.md`, `node tools/push.mjs`, open the PR, `node tools/automerge.mjs <pr> --label`.

**Registration.** A new file that lands in `skills/` without its order file is adopted at the end of the routing order by `node tools/skills-index.mjs --adopt` (finish.mjs runs it before committing). A skill kept out on purpose is named in `OFF` in `tools/skills-index.mjs` with why — that single list is the retirement policy; do not keep another.

After adding or retiring: `node tools/skills-index.mjs --check` and `node tools/skills-check.mjs`; then `node tools/refresh.mjs --only index,first,deps,families,guide,what` and `--check` the same. Routing and overlap read `skills/order/`, not the deploy copy of `index.json`. **Never hand-edit `skills/index.json`.**

## 3D miniatures

Every card can show a small, detailed 3D version of itself that behaves like the real thing. Engine: `void-live-deploy/skills/scene3d.js`. Template: `void-live-deploy/skills/mini/sample.js`. Full API: `docs/miniatures.md`.

1. Copy `skills/mini/sample.js` to `skills/mini/<kind>.js` (`<kind>` = lowercase letters, digits, dashes, matching the card's kind). Its default export is the build function.
2. In the card's mount code, give the miniature a host and mount it:

```js
stageApi.miniature(slotEl, 'clock', { tz: th.tz }, { key: th.id, place: 'inside' })
  .catch(() => { /* no WebGL: keep the card's 2D look */ });
```

   Pass the card's **id as `key`**: the stage re-renders often and the same key moves the live miniature instead of rebuilding it. Do **not** keep the returned handle on `th` (`th._mini = mini`): the stage saves cards with `JSON.stringify` and the handle holds the canvas, so every save would throw.

3. The build function returns `{ update, tick, dispose }`. On a data change the next render mounts with the same key and calls `update(newData)`. A miniature whose element stays off the page for ~1.5 s frees itself; call `dispose()` only to remove it on purpose.

`ctx` gives `THREE` (three.js r180, vendored at `/vendor/three-r180a/`), `lib` (GLTFLoader, OrbitControls, RoomEnvironment, …), the scene/camera/controls, `frame(obj, opts)`, `loadGLTF`, `loadTexture`, `addContactShadow`, `requestRender()`, `animate`, `onTap`, `pick`, and flags `still` (less motion) and `phone` (load lighter assets). From a skill it is `api.stage.miniature(...)`.

## The winding gotcha (make.js, not scene3d)

`void-live-deploy/skills/make.js` is the solid-shape builder whose output a specific viewer draws. That viewer draws a part of a **closed solid wound inward** — its face normals point into the solid. `make.js`'s `wind(s, cx, cy, cz)` turns each face around when its normal points out from the part's centre; a raw cube built the other way shows its far walls (inside-out). If you add a shape there, wind it inward about the part's centre.

This is **not** the rule for `scene3d.js` miniatures: three.js expects outward-facing normals. Match the convention of the engine you are in.

## Never

- Hand-edit `skills/index.json` (it is generated).
- Leave a new skill file in `skills/` without adopting it (`--adopt`) or naming it in `OFF`.
- Copy a competitor's card or site; do the job our own way, as good or better.
