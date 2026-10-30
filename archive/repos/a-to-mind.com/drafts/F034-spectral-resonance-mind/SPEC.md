# F-034: Spectral Resonance Evolutionary Mind

## Concept
Novel combination: A continuous field of coupled phase oscillators on a coarse grid whose coupling matrix and natural frequencies are evolved by a local Web Worker evolutionary mind. Fitness selects for spectral diversity (entropy of instantaneous frequencies), phase coherence clusters, and energy injected by pointer trajectories. Particles advect along instantaneous phase gradients; the resulting flow statistics (coherence, spectral entropy, particle dispersion) morph the surrounding Void UI chrome (hue-rotate, contrast, scale, blur) and directly drive a bank of Web Audio oscillators whose frequencies and gains track the field's dominant modes. Pointer seeds phase kicks and energy; optional DeviceOrientationEvent supplies a global frequency bias. Seal hashes the current best genome + field metrics into IndexedDB.

Not a superficial variation of prior frontier work:
- F-020 discrete FSM agents
- F-021 reaction-diffusion / orientation
- F-022 fluid regime
- F-023 evolutionary lattice rules
- F-024 volumetric noise
- F-025 boids behavioral params
- F-026–F-033 trajectory graphs, spectral phase, competitive minds, attention lattices/graphs/fields, vector fields

Here the substrate is a resonant oscillator lattice whose rules (couplings) are themselves under evolutionary selection; the mind optimizes emergent spectral structure rather than transport rules, attention weights, or discrete agent parameters.

## Architecture
Single self-contained `index.html`. Blob Worker maintains a population of 6 genomes (compact coupling + frequency params), receives metrics, evaluates fitness, mutates, returns best. Main thread steps ~48 oscillators (Kuramoto-like with local coupling), samples phase gradients to advect ~240 particles, draws trails, applies CSS custom properties for morph, sonifies dominant frequencies. Graceful fallbacks: no Worker → fixed moderate coupling; no audio until gesture; orientation ignored if denied; Canvas2D (WebGPU compute path noted for future).

## Expected outcome
Interactive spectral field that discovers resonant clusters and traveling waves which guide particle streams around the pointer, warps the page according to spectral complexity, and produces a generative multi-tone drone that evolves. Sealed genomes form local memory of successful resonance policies. Runnable with graceful fallbacks.

## Mechanics
- 8×6 oscillator grid
- params: global coupling K, frequency spread, local kernel width (compact genome)
- ~240 particles advected by ∇phase
- mind ~1 Hz
- morph 0–1 maps spectral entropy / coherence → CSS
- seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
CSP blocks blob Worker → static params; audio blocked until user gesture; low-end drops particle or grid resolution; orientation requires HTTPS + permission; high N may drop frames.

## Building block
True WebGPU compute oscillator lattice with spatial hash, WebXR head-tracked frequency bias, multi-scale hierarchical resonance, sealed genome breeding across sessions, richer spectral analysis for sonification.

## Lands in V01D
Spatial stage skill (`skills/mini/spectral-resonance-mind.js`); testable via `tools/spectral-resonance-mind.test.mjs` for fitness→morph and genome→spectral-entropy mapping.
