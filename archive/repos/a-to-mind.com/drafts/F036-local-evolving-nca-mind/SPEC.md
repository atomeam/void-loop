# F-036: Local Evolving Neural Cellular Automaton Spatial Mind

## Concept
Novel combination: A continuous 2D cellular field on Canvas2D whose local update rule is a shared tiny multi-layer perceptron (NCA-style). A Web Worker runs a genetic algorithm that evolves the network weights for fitness that rewards pattern complexity (spatial entropy proxy), persistent activity, and localized response to pointer stimulus without global homogenization. Emergent structures (traveling waves, oscillators, clusters) form around the pointer. Global metrics (entropy, activity variance, mean |Δstate|) drive CSS morph of the surrounding Void chrome (hue, blur, contrast, scale). Regional activity drives a simple Web Audio drone. Pointer injects energy; optional DeviceOrientationEvent biases a global drift. Seal hashes best genome + metrics into IndexedDB.

Not a superficial variation of prior frontier work (F-020 discrete agents, F-021 density worker, F-022–F-024 fluid/RD/evo lattices, F-025 parametric boids, F-026–F-034 attention/spectral/vector/resonance fields, F-035 neural swarm policy): here the mind is an evolved local transition function operating on a dense spatial field rather than particle agents or fixed lattices.

## Architecture
Single self-contained `index.html`. Blob Worker holds a small population of genomes (flattened MLP weights for neighbor→state), receives reduced metrics + pointer bias every few frames, evaluates fitness, mutates, returns current best weights. Main thread steps the grid (~60×40 cells, 3×3 neighborhood sampling), renders state as HSL, applies morph, sonifies regional means. Graceful fallbacks: no Worker → static random weights; audio after gesture; orientation ignored if denied. Canvas2D (WebGPU compute noted for future larger grids).

## Expected outcome
Interactive evolving field that discovers local rules producing swirling or pulsing structures that track and amplify the pointer, warps the page chromatically and spatially according to collective complexity, and emits a generative low drone. Sealed genomes form local memory of successful transition rules. Runnable with graceful fallbacks.

## Mechanics
- Grid: 60×40 cells, state ∈ [-1,1]
- Sensors: 8 neighbors + self + pointer dx/dy (normalized)
- Tiny MLP: 11 → 8 ReLU → 1 (Δstate), genome ~ (11*8 + 8*1) weights
- Mind/evolution ~0.5 Hz
- Morph 0–1 maps entropy / variance → CSS custom properties
- Seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
CSP blocks blob Worker → fixed random rule; audio blocked until user gesture; low-end drops resolution or neighbor samples; orientation requires HTTPS + permission; high resolution may drop frames.

## Building block
True WebGPU compute for larger grids + parallel NCA eval, multi-channel residual states, WebXR head-tracked stimulus injection, sealed genome breeding across sessions, richer fitness from Fourier spatial analysis.

## Lands in V01D
Spatial stage skill (`skills/mini/evo-nca-field.js`); testable via `tools/evo-nca-field.test.mjs` for fitness→morph and genome→transition mapping.
