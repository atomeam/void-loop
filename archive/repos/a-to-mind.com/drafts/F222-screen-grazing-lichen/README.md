# F-222 — Screen-Grazing Lichen

Open `index.html` (serve the folder, e.g. `python3 -m http.server`). Press "Let it graze my screen" and share any tab or window, or watch the built-in demo screen. Green line: prediction error when the colony decides where the learning budget goes. Pink line: the same budget spent on random cells. "Pick a color it avoids" uses the EyeDropper API (falls back to a color input).

- `core.js` — per-cell online next-frame predictor (normalized LMS, 7 features) with a learning mask; surprise-seeking colony; deterministic synthetic screens.
- `bench.cjs` → `bench-node.json` — 4 scenes × 4 allocation modes × 3 seeds, 1,500 frames, plus an all-cells ceiling.
- `browser-test.cjs` → `bench-browser.json`, `shot-*.png` — headless Chrome run (demo, tab-capture attempt, color avoidance).

Ledger entry: `ledger/frontier/F-222-screen-grazing-lichen.md`.
