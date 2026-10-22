# F-052 Spatial Causal Portal Lattice

## Concept

Novel combination of:

- WebGPU compute path (Canvas2D fallback) for a spatial energy lattice
- Dynamic portal formation from high-energy deposits (pointer trajectories)
- Local Web Worker running a lightweight predictive attention over portal states to form transport links
- Simulated agents that teleport across predicted portal links
- Morphing page chrome (CSS custom properties for perspective, filter, scale, hue) driven by portal graph entropy and transport rate
- Spatial Web Audio: oscillators panned and filtered by portal activity
- Optional DeviceOrientationEvent bias on lattice drift
- Seal: persist adapted parameters to IndexedDB

Not a superficial variation of:

- F-020 WebGPU agents (no free agents; transport is portal-gated)
- F-021 spatial orientation + worker density + morphing UI (portals + predictive links are the core)
- F-190 causal memory field orbs (memory is portal graph, not orb probes)
- F-195 attention swarm (attention is over discrete portals, not continuous swarm)

## Architecture

Single self-contained `index.html`.

- Main thread: lattice update (diffusion + deposit + decay), portal extraction, agent transport, render, CSS morph, audio.
- Blob Web Worker: receives portal feature vectors, runs small multi-head-style attention (matrix multiplies on small N), returns predicted link strengths and adapted parameters.
- Fallback: if Worker blocked or WebGPU unavailable, use Canvas2D and static parameters.

## Expected Outcome

User draws with pointer to create glowing temporary portals. Portals form predicted connections; particles stream between them. Page chrome warps and colors shift with network activity. Spatial audio responds. Runnable offline. Persistent adaptation across reloads.

## Mechanics

1. Pointer deposits energy into lattice grid.
2. Local maxima above threshold become portals (position, energy, age).
3. Worker computes attention over portal embeddings → link matrix.
4. Agents sample links and teleport or flow.
5. Graph entropy + transport count → CSS vars and audio params.
6. Seal button hashes current params into IndexedDB.

## Failure Modes

- No WebGPU: Canvas2D path works.
- Worker unavailable: fixed links, still interactive.
- Orientation denied: no bias.
- Low FPS: reduce grid resolution.

## Building Blocks for Next

Portal graph as spatial memory; predictive transport; embodied chrome warp from discrete structure. Next experiments can add WebXR portal entry or GPU-resident attention.
