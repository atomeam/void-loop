# F181 WebGPU Compute Genome Physics

## Concept
True WebGPU compute shaders implement both particle physics and per-agent tiny MLP evaluation for a multi-agent competitive swarm. Each agent's genome (MLP weights) lives in a storage buffer; the compute kernel evaluates forces from local features + DeviceOrientation causal bias. Highest-fitness genomes are sealed and transferred (mutated) periodically via CPU round-trip. Persistence via IndexedDB. Hybrid DOM fitness cards + canvas/WebGPU render. Offline-capable.

Deliberately branches from F173–F180 cluster (JS MLP/RNN controlling Canvas or hybrid DOM, WebXR gaze/hand, softbody, audio residuals, probe swarms). New axis: full neural kernel and physics on WebGPU compute, sealed multi-agent genome transfer on GPU buffers.

## Architecture
- Single self-contained index.html
- WebGPU: compute pipeline for N agents (pos/vel + weights buffer)
- Tiny MLP: 4→6→2 evaluated in shader
- OrientationEvent as uniform force bias
- Transfer: sort fitness, mutate best, update buffer
- IndexedDB seal of champion weights
- Fallback: Canvas2D if no WebGPU
- DOM overlay cards for top agents

## Interaction
Tilt device or move pointer. Agents compete for energy. Seal persists best genome. Force transfer button.

## Offline
Fully local, no network. IndexedDB for genomes.

## Failure modes
- No WebGPU → Canvas2D reduced agents
- No orientation → pointer proxy
- No IndexedDB → in-memory

## Building blocks
WebGPU neural compute kernels, GPU-resident genomes, sealed transfer protocol.
