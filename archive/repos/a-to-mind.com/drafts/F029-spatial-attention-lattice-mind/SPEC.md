# F-029 Spatial Attention Lattice Mind

## Concept
Continuous spatial lattice (Canvas2D grid; WebGPU compute path noted) whose local update is an attention-weighted aggregation over neighborhood, parameterized by a shared weight vector (the mind). The mind is a small population evolved in a Web Worker under fitness for field variance (diversity) + pointer interaction density. Fitness and weights morph surrounding UI chrome (hue, scale, filter) and drive multi-oscillator Web Audio. Pointer injects energy peaks; optional DeviceOrientationEvent supplies directional bias. Seal hashes current weights into IndexedDB.

## Architecture
Single self-contained HTML. Worker via Blob URL holds evolutionary population of 6 weight vectors, receives global stats, returns best weights. Main thread steps the lattice at ~60 Hz, draws, applies CSS custom properties, and sonifies. Not a superficial variation of prior frontier experiments (F-020 discrete agents/FSM, F-021 density classifier, F-022 fluid regimes, F-023 rule evolution, F-024 volumetric noise, F-025 boids RL, F-026 trajectory lattice, F-027 spectral phase, F-028 prior). Here the mind *is* the attention parameters that the substrate uses for its dynamics; learning is online evolutionary search over the attention mechanism itself.

## Expected outcome
Interactive spatial attention field that adapts its local focusing behavior toward interaction and diversity, warps the page chromatically/spatially, and generates a living drone. Sealed weight genomes form local memory of successful attention policies. Runnable with graceful fallbacks (Worker blocked → static weights; audio until gesture; orientation ignored if unavailable).

## Mechanics
48×48 float grid; local 3×3 attention proxy using softmax-like exp(similarity * w0) weighted by other weights; mind ~5 Hz; morph driven by fitness 0–1; seal SHA-256 truncated + IndexedDB.

## Failure modes
CSP blocks blob Worker → fixed weights; audio requires user gesture; low-end may drop GRID; orientation needs HTTPS + permission.

## Building block
True WebGPU compute attention lattice with spatial hash, WebXR gaze-driven query injection, multi-head minds competing, sealed attention genomes bred across sessions.

## Lands in V01D
Spatial stage skill (`skills/mini/attention-lattice-mind.js`); testable via `tools/attention-lattice-mind.test.mjs` for fitness→morph and weight→field variance mapping.
