# F-222 — Screen-Grazing Lichen

Date: 2026-10-21 · Draft: `drafts/F222-screen-grazing-lichen/`

## Concept (novel combination)
The user's own live screen is the environment. `getDisplayMedia` streams any tab or window into a 96×60 luminance grid. Every cell holds a tiny online model that predicts that cell's next frame. The model has a hard learning budget: a cell only gets a learning step when one of 64 creatures is standing on it (3×3 patch, about 500 of 5,760 cells per frame, roughly 9%). The creatures are physarum-style sensors that climb the model's own surprise map (smoothed prediction error), so the colony decides where the world model learns, and because learning removes the surprise, they graze an area clean and move on. A second identical model runs beside it on the same frames with the same budget spent on random cells, and both error curves are drawn live, so the page measures its own idea while it runs. The EyeDropper API lets the user pick any color on screen that the colony then avoids, which steers where learning happens.

## Why it is not a variation
Grep of ledger and drafts before this run: `getDisplayMedia` 0 hits, `EyeDropper` 0 hits. No earlier experiment used the user's real screen contents as the world or treated learning compute as a scarce resource that agents allocate. Earlier curiosity agents (F-171…F-221) learned a policy or a dynamics model of their own simulated world; here the agents learn nothing themselves, they are the attention mechanism of a separate world model, and the world is whatever the user is looking at. F-220 used the user's window layout as geometry; F-222 uses the pixels inside it.

## Architecture
- `core.js`: `Model` (per-cell NLMS weights over cur, prev, up, down, left, right, bias; starts as a persistence predictor; `ingest(frame)` scores the last prediction, updates the surprise map, learns only on `learnMask`, predicts the next frame). `Colony` (modes `surprise`, `random`, `sweep`; surprise mode has three sensors at distance 4, turns toward the highest surprise minus repel, wanders when nothing is surprising). `scene(kind)` makes deterministic screens: static "text", a scrolling feed column, two bouncing cursors, a drifting "video" rectangle, or all mixed.
- `index.html`: screen share via `getDisplayMedia` drawn to a 96×60 canvas, demo screen fallback, EyeDropper color avoidance, overlay of surprise or the model's prediction, live dual error chart, `window.__f222` for tests, `?auto=tab` and `?repel=RRGGBB` for automation.

## Measured outcome
Node (`bench-node.json`), 1,500 frames, 3 seeds, mean absolute error ×1000 over the last 500 frames (lower is better):
- Scrolling feed: colony 8.9 vs random 34.1 vs sweep 54.9 vs no learning 95.6 (all cells learning every frame: 1.8).
- Mixed screen: colony 21.8 vs random 42.7 vs sweep 64.3 vs none 106.6 (all cells: 6.8).
- Video rectangle: colony 2.3 vs random 4.1 vs sweep 4.9 vs none 8.7 (all cells: 1.6).
- Bouncing cursors: colony 4.3 vs random 5.5 vs sweep 5.6, but no learning at all wins at 2.8. Honest loss: learning on a fast transient object corrupts the persistence predictor behind it.
The colony used fewer updates than random (about 360–510 vs 538 per frame) because creatures overlap on hot spots.
Headless Chrome (`bench-browser.json`, `shot-demo.png`): demo screen, 900 frames, colony 35.4 vs random 65.3, 46% less error with no page errors. With a background-colored repel (3,800 of 5,760 cells avoided) the advantage drops to 4% (97.1 vs 101.6).

## Failure modes / knowledge
- First feature set (cur, prev, mean of 4 neighbors, mean of previous neighbors) could not represent a one-pixel scroll: scroll error stayed at 87 vs 95.6 with no learning. Splitting the neighbors into up, down, left, right made scroll learnable (8.9). Direction matters more than budget.
- Learning hurts on brief transients (cursor, ball); a next step is a per-cell gate that falls back to persistence when the learned weights do worse.
- Creature energy goes negative on repelled cells, which crashed the canvas arc call (negative radius); clamped.
- Tab capture could not be tested here: headless and headed Chrome on the box both returned `NotReadableError: Could not start video source` even with `--auto-accept-this-tab-capture`. The real screen path is untested; the demo path is tested.
- Avoiding a color that covers most of the screen starves the colony of places to stand and removes most of its advantage.

## Building blocks for next runs
A live screen-to-grid pipe from any shared tab; a budgeted, attention-gated online world model with a built-in A/B against random allocation; agents as the attention of a separate learner instead of learners themselves. Next: move the per-cell model into a WebGPU compute pass to lift the grid to full resolution, let a local language model narrate what part of the user's screen is "alive", or have the colony's surprise map choose which Void card gets rendered at higher quality.
