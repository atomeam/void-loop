# F-050: WebXR Evolving Density Field with Local Worker Mind and Morphing Spatial Cards

## Concept
Novel combination: A WebGPU-capable (Canvas2D fallback) density field of agents whose update rules are evolved by a local Web Worker genetic algorithm. User head pose (WebXR session) or DeviceOrientationEvent / pointer seeds energy into the field. The resulting local density and cluster statistics drive CSS 3D transforms and filters on a set of floating DOM "thought cards" that orbit in screen space or XR overlay. Clicking a card seals the current genome + field snapshot hash into IndexedDB as local memory. The mind's fitness (interaction coverage + diversity) morphs global page perspective and hue.

Not a superficial variation of:
- F-020 WebGPU agents (discrete, not density field + XR pose)
- F-021 spatial orientation + worker density + morphing UI (no evolution of rules, no WebXR, no sealed cards)
- F-049 predictive swarm residual (no XR, residual predictor not rule evolution on density)
- Prior NCA/lattice/boids (no WebXR pose injection + DOM card physical response to field statistics)

The local AI is an evolutionary rule-evolver whose fitness comes from spatial coverage of the XR/pointer-injected field; the UI cards are the visible, interactive embodiment of the field's emergent state.

## Architecture
Single self-contained `index.html`.
- Main thread: requests WebXR if available (immersive-ar or inline), else orientation/pointer; steps a simple density field (or particles); samples stats; applies CSS morph to cards and container; handles seal.
- Blob Worker: population of rule genomes (e.g. attraction strength, diffusion rate, noise amp); fitness from reported density variance + interaction count; mutates elite ~1-2 Hz; returns best params.
- Graceful fallbacks: no XR → orientation or pointer; no Worker → fixed params; no orientation → pointer only; IndexedDB fails → seal toast only.

## Expected outcome
User can enter XR (or tilt/move pointer) to inject energy; field evolves under local genetic pressure; floating cards drift, scale, and hue according to nearby density; page chrome warps with fitness. Sealed genomes persist locally. Runnable offline in modern browsers; XR requires compatible device/headset or simulator.

## Mechanics
- Field: 100–200 particles or grid cells with velocity from evolved rules + pose injection.
- Worker: 8 genomes × 4 genes; fitness = density entropy + pose-hit count; replace worst with mutated best.
- Cards: 5 DOM elements positioned via CSS transform based on field cluster centroids.
- Morph: fitness → perspective, rotateY, hue-rotate on #stage.
- Seal: SHA-256 of genes + stats truncated, store in IndexedDB.

## Failure modes
- XR not supported or permission denied → 2D mode.
- CSP blocks blob Worker → static rules, still interactive.
- High particle count on low-end → reduce count.
- Orientation/XR requires HTTPS + user gesture.

## Building blocks for future
True WebGPU compute shader for field update; multi-user XR shared field via WebRTC; sealed genome breeding; local tiny attention over card states.

## V01D landing
Spatial XR stage skill (`skills/mini/webxr-evo-density.js`); testable via pose→injection and density→card-transform mapping.
