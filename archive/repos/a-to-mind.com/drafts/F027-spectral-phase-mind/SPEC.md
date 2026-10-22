# F-027 Spectral Phase Resonance Mind

## Concept
Novel combination: Continuous phase-oscillator field (particles with phase θ and natural frequency ω, local Kuramoto-style coupling) whose coupling strength K and frequency range are adapted by a local Web Worker evolutionary mind. Fitness rewards spectral resonance with user pointer motion (dominant frequency estimated from recent velocity zero-crossings and short lag autocorrelation) plus field order parameter r = |mean exp(iθ)|. Dominant spectral peak and order morph the surrounding UI (CSS hue-rotate, scale, brightness, HUD transform) and drive Web Audio oscillators whose frequencies track the locked spectral band. Pointer injects instantaneous phase kicks; Seal hashes best params + current order into IndexedDB.

Not a superficial variation of:
- F-020 discrete agents + FSM
- F-021 observer classifier on density/orientation or reaction-diffusion
- F-022 fluid regime bias of fixed params
- F-023 evolutionary lattice update rules
- F-024 volumetric noise + evolutionary controller
- F-025 boids flocking with RL on behavioral params
- F-026 trajectory-prediction intent lattice

Here the substrate is a continuous phase field seeking synchronization, the mind performs lightweight spectral analysis of input rhythm, and evolution tunes coupling for resonance rather than behavioral or lattice parameters.

## Architecture
Single self-contained HTML. Worker (blob) maintains population of 5 genomes encoding {K, freqLo, freqHi, noise}, evaluates fitness, mutates top, returns best. Main thread steps ~280 phase particles with local neighbor coupling, draws phase-colored points with trails, applies CSS morph, updates audio. Graceful: no Worker → fixed moderate K; no audio until gesture.

## Expected outcome
Interactive spatial phase field that entrains to the rhythm of pointer motion, warps the page chromatically and spatially according to spectral energy and coherence, and generates a generative drone locked to the interaction frequency. Sealed genomes form local memory of successful resonance policies.

## Mechanics
- ~280 oscillators, neighborhood radius ~48 px
- params: coupling K, natural freq range
- mind ~1.5 Hz
- morph 0–1 drives CSS custom properties
- seal: SHA-256 truncated of params+order + IndexedDB

## Failure modes
- CSP blocks blob Worker → static coupling
- Audio blocked until user gesture
- Low-end devices: reduce N
- Spectral estimate unreliable for very slow or erratic pointers

## Building block for future
True WebGPU compute of the phase field with spatial hashing, full FFT-based spectral mind in Worker, WebXR head-tracked motion resonance, multi-band morphing, sealed genome breeding across sessions.

Lands in V01D as a spatial stage skill (skills/mini/spectral-phase.js) testable via tools/spectral-phase.test.mjs for spectral-match → morph mapping.
