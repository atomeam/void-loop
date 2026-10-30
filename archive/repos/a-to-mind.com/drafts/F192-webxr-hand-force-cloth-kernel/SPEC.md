# F192 — WebXR Hand Force Injection into WebGPU Cloth Kernel

## Concept
True WebXR hand-tracking (palm and index-tip joints) injects localized forces directly into a WebGPU compute mass-spring cloth simulation. No intervening local neural net (MLP/RNN). The cloth is the spatial embodiment: particles connected by springs updated entirely in a compute shader. Pointer and DeviceOrientation serve as force proxies when XR is unavailable. IndexedDB persists a cloth snapshot (positions + velocities). Single self-contained offline-capable file with Canvas2D fallback renderer if WebGPU is missing.

## Branch
Leaves the dominant recent cluster (F184–F191): WebGPU SPH/vortex/softbody/genetic portals, spectral/NCA/fluid orientation hybrids, sealed RNN/MLP physical DOM cards, trajectory-attention echoes, lattice autopoiesis, WebXR hand competitive MLP DOM fields, orientation-MLP hybrid agents, and neural-particle kernels. New combination: direct WebXR hand joint → force injection into a pure WebGPU compute mass-spring cloth kernel + IndexedDB spatial snapshot, without neural controllers, residual predictors, attention lattices, NCA, or DOM-card embodiments.

## Files
- index.html — single self-contained interactive prototype

## Mechanics
- Cloth grid (e.g. 16×16 or 32×32) of particles with rest lengths and spring forces computed in WGSL compute shader.
- Hand joints projected into the simulation plane; nearest particles receive impulse proportional to joint velocity or proximity.
- Render: WebGPU point/line draw or Canvas2D points.
- Controls: Start XR, Reset cloth, Save/Load snapshot, stiffness/damping sliders.
- Fallback: mouse drag injects force; orientation tilt biases gravity or wind.
- Offline: all local, IndexedDB for persistence.

## Failure modes
- No WebGPU → Canvas2D particle fallback with JS physics (reduced size).
- No WebXR / no hand-tracking → pointer + orientation proxy.
- IndexedDB blocked → session memory only.
- High resolution on low-end device → auto-reduce grid.

## Building blocks for next
WebGPU mass-spring cloth compute kernel, direct XRHand joint force injection, IndexedDB spatial field snapshot protocol, hybrid force proxies (pointer/orientation).
