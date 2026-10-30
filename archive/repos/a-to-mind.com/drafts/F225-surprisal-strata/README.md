# F-225 — Surprisal Strata

Open `index.html` (any static server). Type anything. A character language model that starts knowing nothing learns your writing live, entirely in the page. Every letter is colored by how surprised the model was (CSS Custom Highlight API, no DOM wrapping), every line lays down a stratum of terrain whose height is that line's surprise (WebGL2), Tab accepts the model's ghost continuation, and the stats bar shows the live correlation between your hesitation before a key and the model's surprise at it.

- `core.js` — `PPM` (blended order-0..4, method-C escapes, online), `Strata` (heightfield deposition), `pearson`. Node + browser.
- `bench-node.mjs` → `bench-node.json` — bits/char by order vs gzip, ghost-completion floor sweep.
- `browser-test.cjs` → `bench-browser.json`, `shot-auto.png` — headless Chrome synthetic typist (`?auto=1`).
- "forget" wipes the model and the saved text (kept only in this browser's localStorage).
