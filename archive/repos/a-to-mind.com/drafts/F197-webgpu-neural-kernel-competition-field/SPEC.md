# F197 — WebGPU Neural Kernel Competition Field

## Concept
Novel combination: Multiple competing agents whose tiny MLP controllers run as a local neural kernel (JS batched forward passes, WebGPU compute stub prepared for full GPU dispatch). Agents apply forces into a shared particle/resource field; fitness from resource consumption drives selection. Genomes (weight vectors) are sealed by SHA-256, persisted and transferable via IndexedDB. DeviceOrientationEvent supplies a causal global bias vector into the MLP inputs. Hybrid embodiment: Canvas for the spatial field + selectable DOM agent cards that display seals and allow transfer/clone. Offline-first.

## Branch
Deliberately leaves the dominant recent cluster (F185–F196): WebGPU attention/particle swarms morphing chrome, sealed RNN/MLP pure-DOM agents, WebXR hand/gaze force injection or sculpt, DeviceOrientation spring-mass chains, causal memory orbs, embedding lattices, spectral/fluid, trajectory-attention echoes, pure genome DOM swarm. New axis: neural kernels as the competition controllers inside a shared physics/resource field + sealed IndexedDB genome transfer + orientation as causal MLP input + hybrid canvas/DOM, without attention lattices, residual predictors, NCA, volumetric injection, or pure pointer-history fields.

## Files
- index.html — single self-contained interactive offline prototype

## Mechanics
- 8 agents, each a 4→4→2 MLP (~30 weights). Inputs: local resource density, own energy, orientation bias x/y. Outputs: force x/y.
- Forward pass pure JS (tanh). WebGPU detected and noted as expansion point for storage-buffer weight upload + compute dispatch of batched MLPs.
- Resources drift; agents consume on overlap → energy + fitness.
- Evolve step: sort by fitness, replace bottom half with mutated copies of top genome.
- Seal: SHA-256 of weight ArrayBuffer, short id displayed.
- IndexedDB: save/load all genomes with seals.
- DeviceOrientation (permission on gesture) or pointer as bias; added directly to MLP inputs.
- Hybrid UI: canvas field + DOM cards (click select, dblclick transfer selected genome to a lower agent).
- No external deps, runs offline.

## Failure modes
- No IndexedDB (private mode) → in-memory only, status warn.
- Orientation denied or desktop → pointer bias fallback.
- WebGPU absent → JS kernel continues fully functional.
- High agent count → rAF throttles naturally.

## Building blocks for next
GPU-resident batched MLP kernels (weights in storage buffers), sealed genome transfer protocol via IndexedDB, orientation-causal neural controllers, competition selection on shared field, hybrid canvas+DOM agent embodiment. Next: full WGSL MLP dispatch, WebRTC sealed transfer, or WebXR hand injecting into the field.

## V01D landing
Spatial/local-AI skill under void-live-deploy/skills/; testable by fitness ranking stability and seal persistence after reload.
