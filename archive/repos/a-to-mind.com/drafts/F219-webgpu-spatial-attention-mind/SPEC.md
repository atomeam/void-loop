# F-219 WebGPU Spatial Attention Mind

**Novel combination:** WebGPU compute shader runs a local spatial attention lattice (simplified multi-scale neighbor attention on a 64x64 grid). A Web Worker maintains a tiny recurrent state that injects "curiosity" bias into the attention kernels based on field entropy and user pointer trajectory history. DeviceOrientationEvent tilts the attention bias globally. Floating DOM cards (positioned with CSS 3D) display live attention peaks as "thought nodes" that can be dragged to reinforce local weights. IndexedDB seals the best attention kernel parameters across sessions. Fully offline after load.

**Branches away from:** orientation RNN softbodies (F218), residual oracles, spectral/audio foragers, pure NCA, WebXR hand curators, and volumetric injection. Moves to GPU-resident spatial attention with worker-mediated recurrent curiosity, hybrid 3D DOM thought nodes that bidirectionally inject into the lattice, and sealed kernel evolution.

**Architecture:** single self-contained index.html; WebGPU compute for lattice update (fallback Canvas2D); main-thread pointer/orientation; worker for entropy + trajectory embedding; CSS 3D thought cards; IndexedDB; BroadcastChannel optional. Progressive: works without WebGPU or orientation.

**Expected:** Interactive lattice that focuses attention under pointer or device tilt. Thought cards appear at high-attention loci and can be dragged to seed new foci. Worker curiosity slowly explores low-entropy regions. Sealed parameters persist.

**Failure modes:** no WebGPU (Canvas2D fallback); orientation denied (pointer only); IndexedDB blocked (in-memory); low-end (reduce grid to 32x32).

**Building blocks:** GPU spatial attention as primary substrate; worker recurrent curiosity bias; bidirectional DOM-to-lattice injection via thought cards; sealed kernel transfer. Next: true multi-head in shader, or WebXR gaze as attention ray, or cross-tab kernel competition.

V01D landing: spatial attention skill under void-live-deploy/skills/; testable by attention peak movement under simulated pointer and kernel round-trip via IndexedDB.
