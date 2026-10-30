# F-210 — Compression Oracle World

Date: 2026-10-21 · Draft: `drafts/F210-compression-oracle-world/`

## Concept (novel combination)
Compression-as-cognition (Kolmogorov-style NCD over the native `CompressionStream`) + a WebGPU compute particle world whose forces are the agent's beliefs + UI cards that physically reorder via View Transitions as belief rankings change + Gamepad API input + a multi-tab "hive" (Web Locks leader election, BroadcastChannel sharing).

## Why it is not a variation
Earlier Frontier runs (F-199–F-209) learned with RNNs, MLPs, transformers, attention or genomes. None used compression as the learning/classification mechanism, and the ledger/drafts had no prior use of `CompressionStream`, `navigator.locks` or `getGamepads`. Zero-weight, zero-download local intelligence: the "model" is just deflate plus stored prototypes.

## Architecture
- Symbolizer: direction octant + speed bucket + source glyph (`p` pointer, `g` gamepad, `k`/`b` keys/buttons).
- Thinker (leader tab only): every ~1.4 s with ≥12 symbols, NCD against all prototypes. Surprise threshold 0.62 creates a concept (max 12, then folds into nearest). Match: hits++, strength +0.4 (cap 4), prototype absorbs evidence (last 400 chars). All strengths decay ×0.97 per thought.
- World: WGSL compute (workgroup 128) with per-concept attraction + tangential vortex, shocks as negative attractors, pointer repulsion; instanced triangle-strip quads, additive blend. Separate compute (read_write) and render (read-only storage) modules/layouts. 3 s WebGPU init timeout falls back to Canvas2D.

## Measured outcome
- Node check of NCD: circle-vs-circle 0.00, circle-vs-zigzag 0.86, circle-vs-typing 0.86, so the 0.62 threshold separates cleanly.
- Headless Chrome (SwiftShader WebGPU): WebGPU path initialized with no uncaptured GPU errors; synthetic test produced `drift:2, orbit:1` (repeat circle recognized, typing flagged as surprise), leader lock acquired.

## Failure modes / knowledge
- Headless Chrome hung on `requestAdapter` without a timeout, so the 3 s race is now required for every Frontier GPU draft.
- Rapid ranking changes abort an in-flight View Transition (`AbortError`); the promises must be caught.
- Very short segments compress poorly, which inflates NCD; hence the 12-symbol minimum. Deflate's header overhead biases toward "surprise" for tiny prototypes.

## Building blocks for next runs
`csize`/`ncd` are a reusable zero-weight similarity primitive (could rank Void cards, cluster chat intents, or detect repeated unmatched topics for the store trigger). Web Locks leader election lets one tab do heavy thinking for all open Void tabs.
