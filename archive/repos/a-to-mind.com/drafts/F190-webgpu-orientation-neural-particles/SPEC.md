# F190 — WebGPU Orientation Competitive Neural Particles

## Concept
WebGPU compute shaders implement multiple competitive local agents as neural-particle kernels. DeviceOrientation (or pointer proxy) is injected as a causal uniform. Each agent owns a tiny MLP-like weight buffer that modulates particle forces and cohesion. Agents compete on fitness (particle density near the orientation focus + stability). Periodic sealed genome transfer mutates the champion and overwrites the weakest. IndexedDB persists the sealed champion genome and particle snapshot. Canvas/WebGPU render is the embodiment; offline-first single file.

## Branch
Leaves the dominant recent cluster (F182–F189): pure-DOM MLP/RNN physical cards, WebXR hand/gaze competitive DOM fields, spectral/NCA/fluid orientation hybrids, SPH vortex portals, genetic softbody portals, trajectory-attention echoes, and residual predictors. New combination: WebGPU compute neural-particle kernels + DeviceOrientation causality + sealed multi-agent genome transfer + IndexedDB persistence, without DOM embodiment or continuum lattice fields.

## Files
- index.html — single self-contained interactive prototype

## Mechanics
- 3–4 agents, each with a weight buffer (small MLP: orientation/focus → force bias).
- Compute pass: particles updated by orientation vector + agent-specific neural bias + inter-particle forces.
- Fitness: inverse distance of agent particle centroid to current orientation focus.
- Seal/transfer: champion weights hashed and stored; transfer applies mutation.
- Fallback: pointer as orientation proxy; WebGPU unavailable → Canvas2D particle sim.
- Offline-capable.

## Failure modes
- No WebGPU → Canvas2D fallback.
- IndexedDB blocked → session memory.
- No orientation sensor → pointer proxy.
- High particle count on low-end GPU → auto-reduce.

## Building blocks for next
WebGPU compute neural kernels as agent controllers, DeviceOrientation→uniform injection, sealed competitive particle genomes, IndexedDB snapshot of spatial field.
