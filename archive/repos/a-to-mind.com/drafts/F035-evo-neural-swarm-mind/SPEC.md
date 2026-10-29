# F-035: Local Evolutionary Neural Swarm Controller

## Concept
Novel combination: Continuous spatial agents on Canvas2D whose acceleration is produced by a shared tiny neural network (MLP). A local Web Worker runs a genetic algorithm that evolves the network weights. Fitness selects for trajectory diversity (path entropy proxy), responsive interaction with the pointer (local density increase without global collapse), and moderate energy use. Global swarm entropy and mean activation morph the surrounding Void UI chrome via CSS custom properties (hue-rotate, blur, scale, filter). Simple Web Audio oscillators are driven by speed statistics. Pointer movement seeds attraction bias; optional DeviceOrientationEvent can bias sensors. Seal hashes the current best genome + metrics into IndexedDB.

Not a superficial variation of prior frontier work (F-020 discrete FSM agents, F-021 density/orientation worker, F-022–F-024 fluid/RD/evo lattices, F-025 boids parametric RL, F-026–F-034 attention/spectral/vector/oscillator/resonance minds): here the mind is an evolved neural policy that directly computes the force law from local sensors.

## Architecture
Single self-contained `index.html`. Blob Worker maintains a population of 5 compact genomes (flattened MLP weights), receives reduced metrics, evaluates fitness, mutates, returns best. Main thread steps ~280 agents (local neighbor sampling for sensors), draws fading trails, applies morph, sonifies. Graceful fallbacks: no Worker → fixed random weights; audio after user gesture; orientation ignored if denied. Canvas2D (WebGPU compute path noted for future).

## Expected outcome
Interactive neural swarm that discovers steering policies producing swirling clusters and exploratory streams around the pointer, warps the page chromatically and spatially according to collective state, and produces a generative drone. Sealed genomes form local memory of successful policies. Runnable with graceful fallbacks.

## Mechanics
- ~280 agents
- Sensors (normalized): local density, pointer dx, pointer dy, velocity alignment
- Tiny MLP: 4 → 6 ReLU → 2 (ax, ay), genome ~ (4*6 + 6*2) weights
- Mind ~1 Hz
- Morph 0–1 maps entropy / mean |activation| → CSS
- Seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
CSP blocks blob Worker → static random policy; audio blocked until user gesture; low-end drops N or neighbor samples; orientation requires HTTPS + permission; high N may drop frames.

## Building block
True WebGPU compute for larger N + neural eval, multi-layer residual policies, WebXR head-tracked sensor bias, sealed genome breeding across sessions, richer fitness from spectral analysis.

## Lands in V01D
Spatial stage skill (`skills/mini/evo-neural-swarm.js`); testable via `tools/evo-neural-swarm.test.mjs` for fitness→morph and genome→policy mapping.
