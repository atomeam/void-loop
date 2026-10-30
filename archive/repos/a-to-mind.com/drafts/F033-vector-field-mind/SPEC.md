# F-033: Local Evolutionary Vector Field Mind

## Concept
Novel combination: Continuous particles advect under a coarse spatial vector field (grid of control vectors). A local Web Worker evolutionary mind adapts the field parameters (vector magnitudes, angles, decay) under fitness for trajectory diversity (path entropy / spread), moderate energy, and pointer interaction density. Global divergence, curl, and particle dispersion morph the surrounding Void UI chrome (hue-rotate, scale, blur, CSS filters, HUD transforms) and drive Web Audio oscillators whose frequencies/gains track field statistics. Pointer injects temporary local attractors or force biases; optional DeviceOrientationEvent supplies a global field rotation bias. Seal hashes the current best field genome + morph metrics into IndexedDB.

Not a superficial variation of prior frontier work:
- F-020: discrete FSM agents
- F-021: reaction-diffusion / orientation density
- F-022: fluid with fixed params
- F-023: evolutionary lattice update rules
- F-024: volumetric noise + evo controller
- F-025: boids with evolutionary behavioral params
- F-026–F-032: trajectory/spatial graphs, spectral phase, competitive minds, attention lattices/graphs/fields

Here the mind *is* the evolving vector field that governs continuous particle transport; selection optimizes emergent flow patterns rather than discrete rules, attention, or oscillator coupling.

## Architecture
Single self-contained `index.html`. Blob Worker maintains a population of 6 field genomes, receives metrics, evaluates fitness, mutates, returns best. Main thread steps ~320 particles (bilinear sample of field + small noise), draws trails/particles, applies CSS custom properties for morph, sonifies. Graceful fallbacks: no Worker → fixed moderate field; no audio until gesture; orientation ignored if denied; Canvas2D (WebGPU path noted for future).

## Expected outcome
Interactive spatial vector field that discovers swirling or channeling flows which attract and disperse particles around the pointer, warps the page according to field complexity, and produces a generative drone. Sealed genomes form local memory of successful flow policies. Runnable with graceful fallbacks.

## Mechanics
- ~320 particles, 8×6 control grid (48 vectors)
- params: per-cell angle/magnitude + global scale/decay (compact genome)
- mind ~1 Hz
- morph 0–1 maps divergence/curl/dispersion → CSS
- seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
CSP blocks blob Worker → static field; audio blocked until user gesture; low-end drops N or grid resolution; orientation requires HTTPS + permission; high particle count may drop frames.

## Building block
True WebGPU compute particle advection with spatial hash / texture field, WebXR head-tracked field bias, multi-scale hierarchical fields, sealed genome breeding across sessions, spectral analysis of flow for richer sonification.

## Lands in V01D
Spatial stage skill (`skills/mini/vector-field-mind.js`); testable via `tools/vector-field-mind.test.mjs` for fitness→morph and genome→divergence mapping.
