# F-025 WebGPU Boids RL Mind

## Concept
Novel combination: GPU-accelerated (Canvas fallback; WebGPU compute path noted) boids/flocking field whose behavioral parameters are continuously adapted by a local Web Worker evolutionary/RL mind. The mind receives interaction reward (pointer density as positive signal) + field velocity variance. Best genome morphs the surrounding UI chrome (hue, scale, filter) and drives Web Audio oscillators whose frequencies and gains track fitness and params. Pointer injects forces; optional DeviceOrientation tilts velocity bias. Seal hashes current params+morph into IndexedDB.

Not a superficial variation of:
- F-020 discrete agents + FSM
- F-021 observer classifier on density/orientation
- F-022 fluid regime bias of fixed params
- F-023 evolutionary lattice update rules
- F-024 volumetric noise + evolutionary controller

Here the substrate is continuous agents with local interaction rules, and the mind is reward-seeking toward user interaction rather than pure entropy.

## Architecture
Single self-contained HTML. Worker (blob) maintains population of 6 parameter genomes, evaluates fitness from reward+stats, mutates, returns best. Main thread steps O(N²) boids (N~420), draws trails, applies CSS morph, updates audio. Graceful: no Worker → fixed params; no audio until gesture; no orientation → ignore.

## Expected outcome
Interactive spatial flock that "learns" to attract interaction, warps the page chromatically and spatially, and sings a generative drone. Sealed genomes form local memory of successful policies.

## Mechanics
- 420 boids, neighborhood 60/24, params: align/coh/sep/maxSpeed/maxForce
- Mind ~1.25 Hz
- Morph 0–1 scales CSS hue-rotate, brightness, HUD scale
- Seal: SHA-256 truncated + IndexedDB

## Failure modes
- Low-end devices: drop N or skip mind
- CSP blocks blob Worker → static params
- Audio blocked until user gesture
- Orientation requires HTTPS + permission

## Building block for future
True WebGPU compute boids (spatial hash), WebXR head-tracked flock, multi-agent minds competing for interaction, sealed genome breeding across sessions.

Lands in V01D as a spatial stage skill (skills/mini/boids-mind.js) testable via tools/boids-mind.test.mjs for reward→morph mapping.
