# F-030 Trajectory Memory Field Mind

## Concept
Continuous spatial field (Canvas2D; WebGPU compute path noted) that retains pointer trajectories as decaying activation trails. A local Web Worker evolves the memory kernel (decay rate, diffusion strength, injection gain, noise floor) via a small evolutionary population under fitness for structured persistence (trail coherence + variance) under continuous noise while remaining responsive to new pointer input. Field centroid and fitness morph the surrounding UI chrome (position, scale, hue) and drive spatially panned Web Audio. Optional DeviceOrientationEvent biases diffusion direction. Seal hashes the current kernel into IndexedDB as local memory of successful memory policies.

## Architecture
Single self-contained HTML. Worker via Blob URL holds evolutionary population of 5 kernels, receives field stats (centroid, variance, trail energy), returns best kernel. Main thread steps the lattice at ~60 Hz, draws the field with color mapped to activation age, applies CSS custom properties and absolute positioning to the HUD so it physically tracks the memory centroid, and sonifies with PannerNode. Not a superficial variation of prior frontier experiments (F-020 discrete agents, F-021 density classifier + morph, F-022 fluid regimes, F-023 rule evolution, F-024 volumetric, F-025 boids RL, F-026 trajectory lattice, F-027 spectral, F-028 competitive, F-029 attention lattice). Here the mind *is* the parameters of a memory substrate that learns to keep useful spatial histories; the UI and sound physically follow the remembered center of mass.

## Expected outcome
Interactive spatial memory canvas where drawing with the pointer leaves persistent trails that the mind optimizes to retain structure; the HUD floats toward the current memory centroid and the drone pans with it. Runnable with graceful fallbacks (Worker blocked → fixed kernel; audio until gesture; orientation ignored if unavailable).

## Mechanics
64×64 float grid; kernel of 4 parameters; local  diffusion + decay + pointer Gaussian injection from last 8 trail points; mind ~8 Hz; morph driven by fitness 0–1 and centroid; seal SHA-256 truncated + IndexedDB.

## Failure modes
CSP blocks blob Worker → fixed kernel; audio requires user gesture; low-end may drop GRID; orientation needs HTTPS + permission; high trail density can saturate field.

## Building block
True WebGPU compute memory field with spatial hash of trajectories, WebXR controller ray injection, multi-memory minds competing for different timescales, sealed memory genomes bred across sessions.

## Lands in V01D
Spatial stage skill (`skills/mini/trajectory-memory-mind.js`); testable via `tools/trajectory-memory-mind.test.mjs` for fitness→morph and kernel→trail persistence mapping.
