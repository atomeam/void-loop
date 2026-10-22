# F201 · WebGPU Multi-Agent Sealed Genome Competition

**Branch away from:** WebGPU/WebXR neural/particle/attention lattices + local RNN/MLP causal fields (F196–F200 cluster).

**Novel combination:** Multi-agent spatial competition + sealed genome transfer via IndexedDB + optional DeviceOrientation causal tilt. Hybrid canvas embodiment (WebGPU path reserved for next iteration; current is canvas2d for immediate offline runnability).

## Capability
- 8–16 agents with compact 6-float genomes control attraction, speed, noise, etc.
- Compete for click-placed (or auto) resources on a 2D field.
- Winner can **seal** genome (simple hash) and persist to IndexedDB.
- Sealed genomes can be **injected** into living agents (transfer without network).
- Optional DeviceOrientation tilts the force field.
- Fully offline after load; no external deps.

## Building blocks for next
- Genome sealing + IDB store can host true WebGPU compute particle kernels.
- Sealed transfer is the primitive for multi-agent competition with privacy-preserving genome exchange.
- Ready for WebXR gaze/hand overlay or WebRTC shared field in a follow-on.

## Failure modes / notes
- Hash is demo-quality (FNV-like), not cryptographic.
- No true WebGPU yet (canvas fallback for universal run); next run can add compute shader path.
- DeviceOrientation requires user gesture / permission on some browsers.
- Competition is soft (score + occasional gene fragment copy); not zero-sum elimination.

## Test
Open index.html offline. Click Start, place resources, Seal winner, reload, Inject. Confirm IDB persistence across reloads.
