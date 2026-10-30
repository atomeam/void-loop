# F-040: Evolved Neural Spatial Probe Swarm with Graph Overlay and Morphing Chrome

## Concept
Novel combination: A swarm of absolute-positioned DOM probe agents that navigate a 2D spatial stage. Their velocities and inter-probe connection strengths are controlled by a local Web Worker evolutionary neural mind (small shared MLP weights evolved under selection for pointer-interaction reward, spatial diversity, and graph activity). A Canvas2D (WebGPU path noted) overlays dynamic edges whose opacity and color track connection strengths. Global Void chrome morphs (filters, perspective, hue) with the mind's fitness and activation entropy. Pointer attracts or repels; optional DeviceOrientationEvent biases drift. Web Audio tones per probe roughly spatialized by x-position. Seal stores best neural genome in IndexedDB.

Not a variation of prior field/lattice/boids/NCA/cards experiments: the substrate is free-moving DOM agents whose behavior is the direct output of an evolved neural controller, with an explicit dynamic graph overlay as the visible reasoning trace, and fitness that rewards both interaction and structural diversity of the graph.

## Architecture
Single self-contained `index.html`.
- Main thread: steps probe positions (simple Euler), samples local features for the mind, draws graph edges on canvas, applies CSS morph and audio.
- Blob Worker: maintains population of neural weight genomes (MLP: inputs→hidden→outputs), evaluates fitness from reduced observations ~1 Hz, mutates, returns best weights.
- Graceful fallbacks: no Worker → fixed random weights; no canvas → probes only; audio after gesture; orientation ignored if denied.

## Expected outcome
Interactive swarm of probes that learn to orbit the pointer or form interesting graphs, edges that pulse with connection strength, page that warps chromatically and perspectively with learning progress, and generative multi-tone audio. Sealed genomes form local memory of successful neural policies. Runnable offline.

## Mechanics
- Probes: 8–12 DOM nodes, positions in viewport, velocities from neural net.
- Neural: shared MLP (e.g. 6 inputs, 8 hidden, 3 outputs: vx bias, vy bias, connect strength); weights evolved.
- Graph: edges drawn when strength > threshold; color/alpha from strength.
- Mind/evolution ~1 Hz; pointer proximity boosts fitness.
- Morph: fitness + activation variance → CSS hue-rotate, contrast, perspective, scale on container.
- Seal: SHA-256 truncated of weights + fitness + IndexedDB.

## Failure modes
CSP blocks blob Worker → static weights; low-end drops probe count; audio blocked until gesture; orientation requires HTTPS + permission; probes may overlap or leave viewport (clamped).

## Building block for future
True WebGPU compute for the graph force simulation, WebXR head-tracked probes, multi-mind competition, sealed neural genome transfer across sessions, local tiny attention layer over probe states.

## V01D landing
Spatial stage skill (`skills/mini/neural-probe-swarm.js`); testable via `tools/neural-probe-swarm.test.mjs` for observation→velocity mapping and fitness→morph.
