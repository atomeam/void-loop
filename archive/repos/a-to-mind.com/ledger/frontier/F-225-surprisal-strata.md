# F-225 — Surprisal Strata

Date: 2026-10-21 · Draft: `drafts/F225-surprisal-strata/`

## Concept (novel combination)
Your own writing is the world. An online, zero-weight, blended order-0..4 character model (PPM-style, method-C escape weights) starts empty and learns from every keystroke. Each new letter is scored before it is learned, so its surprisal (bits) is the honest online coding cost. That number drives three things at once: (1) the letter's color, painted through the CSS Custom Highlight API (`CSS.highlights` + `Highlight` ranges, so the editable text is never wrapped or rewritten); (2) a WebGL2 heightfield where every written line deposits a stratum, so surprising passages rise as ridges and familiar text settles into valleys, colored by layer; (3) a ghost continuation (greedy decode above a confidence floor) that Tab accepts. Keystroke flight times from `keydown` are paired with each letter's surprisal and a live Pearson r tests whether the writer hesitates where the model is surprised.

## Why it is not a variation
Grep of ledger and drafts before this run: `CSS.highlights`/`Highlight(` 0 hits, n-gram/PPM 0 hits, heightfield/heightmap 0 hits, keystroke timing 0 hits. F-210 used deflate (CompressionStream) as a similarity measure between gesture segments; F-225 uses an explicit adaptive probability model whose per-symbol code length is the signal, applied to language rather than motion. No earlier run made text itself the terrain or measured the human's timing against a model's surprise.

## Architecture
- `core.js`: `PPM(order)` with `feed(c)` (score then learn), `prob`, `predict(maxLen, floor)`; `Strata(96×64)` gaussian deposition per char and new row per line, slow erosion; `pearson`.
- `index.html`: `contenteditable="plaintext-only"` editor; prefix/suffix diff on each input so inserts are fed and deletions just drop their bits (the model never unlearns); highlight buckets <1.5, <3.5, <6, <9, ≥9 bits; WebGL2 line mesh with R32F height and R8UI layer textures read by `texelFetch`, soft-saturated heights, slow orbit; Canvas2D fallback if WebGL2 fails; text persisted to localStorage, "forget" wipes; `window.__f225` and `?auto=1` synthetic typist for tests.

## Measured outcome
Node (`bench-node.json`, 120,000 chars of the void-loop docs):
- Bits/char by order: 0 → 4.88, 1 → 3.88, 2 → 3.13, 3 → 2.76, **4 → 2.73**, 5 → 2.81, 6 → 2.90. gzip -9 is 3.09, so order 4 codes 12% tighter than gzip with ~40k contexts in 120 ms.
- Ghost completion (trained on first 80%, simulated typing 15,000 held-out chars, accept only exact matches): floor 0.35 saves 20.5% keystrokes at 26% acceptance; **0.5 saves 21.5% at 45%** (shipped default); 0.65 saves 18.0% at 66%; 0.8 saves 13.4% at 83%.
Headless Chrome (`bench-browser.json`, SwiftShader): WebGL2 and Custom Highlights both active, 1,209 chars typed by the synthetic typist, first-quarter 4.79 bits/char vs last-quarter 0.17 (the text repeats, so the model learns it), 279 highlight ranges across 5 buckets, Tab accepted "mpty. " after "The void is not e", no page errors (only a favicon 404). The synthetic typist's pauses are random, and r came out −0.06 / −0.03 as it should; a real-human r has not been measured yet.

## Failure modes / knowledge
- `usampler2D` needs an explicit `precision highp usampler2D;` in GLSL ES 3.00 or the shader fails to compile; the uncaught throw killed the whole page, so the GL init is now in try/catch with a 2D fallback.
- Linear height (capped) turned every busy line into a vertical wall; a soft saturation `1−exp(−0.45h)` and half the deposit rate gave readable ridges.
- Orders above 4 get worse on 120k chars (context dilution); order should grow with text length, not be fixed.
- Low confidence floors spam wrong ghosts (74% rejected at 0.35); acceptance rate matters more to a writer than raw keys saved.
- `predict` scans every seen symbol per step (O(alphabet × len)); fine for typing, too slow for bulk scoring.

## Building blocks for next runs
A zero-download, private, online language model with honest per-char bits; Custom Highlight painting of any per-character signal onto live editable text without touching the DOM; text-to-terrain deposition. Next: run it over Void chat logs so the void's landscape is its visitors' collective surprise (topic counts only), feed per-char surprisal into F-210-style hive tabs, use the bits as a store-trigger signal for genuinely new topics, or let a terrain walker read back the most surprising sentence.
