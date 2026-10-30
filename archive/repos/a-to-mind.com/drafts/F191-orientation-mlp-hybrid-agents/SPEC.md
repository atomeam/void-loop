# F191 — Orientation-Driven MLP Hybrid DOM-Canvas Agents

## Concept
Local tiny MLPs (pure JS) take DeviceOrientation (beta/gamma) as causal input and output velocity biases for competitive DOM agent cards. Each agent is a hybrid embodiment: a physical DOM element that also acts as an attractor/repulsor in a Canvas2D particle field (WebGPU compute path attempted, Canvas2D fallback). Agents compete on fitness (particle capture + central stability). Periodic sealed genome transfer: champion MLP weights are hashed, stored in IndexedDB, and can be exported/imported. Offline-first single file.

## Branch
Leaves the dominant recent cluster (F183–F190): WebGPU softbody/SPH/vortex portals, genetic portals, sealed pure-DOM MLP/RNN agents, trajectory-attention echoes, lattice autopoiesis, WebXR hand competitive MLP DOM fields, spectral/NCA/fluid orientation hybrids, and pure WebGPU neural-particle kernels. New combination: DeviceOrientation causal MLP controlling hybrid DOM+canvas particle embodiment + sealed competitive genome transfer + IndexedDB, without pure continuum fields or residual predictors.

## Files
- index.html — single self-contained interactive prototype

## Mechanics
- 3 agents, each with a small MLP (4 inputs: orientation + relative pos → 2 outputs: dx/dy).
- Step: orientation (or mouse proxy) → MLP forward → move DOM card; cards attract nearby particles.
- Fitness: particles captured + time near center.
- Seal/transfer: champion weights + hash → IndexedDB; base64 export/import verifies hash.
- Fallback: mouse as orientation proxy; no WebGPU required (Canvas2D particles).
- Offline-capable.

## Failure modes
- No DeviceOrientation permission or desktop → mouse proxy.
- IndexedDB blocked → session-only memory.
- High particle count → auto-throttle.

## Building blocks for next
Hybrid DOM-as-agent + canvas field embodiment driven by local models, DeviceOrientation→MLP, sealed genome protocol for competitive agents, IndexedDB persistence of hybrid state.
