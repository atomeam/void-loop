# F-223 WebGPU Neural Kernel Competition

**Novel combination:** WebGPU compute shader hosts a shared population of tiny MLPs (4-8-4) that perform on-GPU inference to emit forces on a particle field. Inputs are local particle state + global causal signals (pointer attractor + DeviceOrientation tilt). Agents compete on system energy reduction / cohesion; weakest is replaced by a mutated copy of the leader. Leader weights sealed to IndexedDB. Hybrid embodiment: GPU-readback Canvas2D particle viz + absolutely positioned DOM agent cards. Fully offline after load; Canvas2D CPU fallback if no WebGPU.

**Branches away from:** residual prediction oracles (F216), spatial attention lattices (F219), orientation-RNN softbody competitions (F218), screen-grazing predictors (F222), main-thread MLP physics (F221), acoustic/spectral foragers, pure NCA, volumetric injection, and pointer-history fields. Moves the neural kernel into the compute shader itself so inference is GPU-resident and directly causal for physics.

**Architecture:** single self-contained index.html; WebGPU compute for particle integration + per-agent MLP force kernels (storage buffers for positions, velocities, and agent weight sets); main-thread pointer/orientation injection and competition logic; Canvas2D visualization; IndexedDB seal; progressive Canvas2D fallback. No external dependencies.

**Expected:** Particles respond to pointer and device tilt under competing on-GPU MLP force policies. DOM cards show live ranks and glow for the leader. Competition mutates weak agents. Seal persists best genome across reloads.

**Failure modes:** no WebGPU (Canvas2D fallback works); DeviceOrientation denied (pointer only); IndexedDB blocked (in-memory only); low-end devices (reduce particle count).

**Building blocks:** GPU-resident neural inference kernel as primary force generator; competitive sealed genome transfer on a pure physics substrate; DeviceOrientation as causal global input; hybrid canvas+DOM without residual or attention machinery. Next: full multi-head kernels in shader, WebXR gaze ray as additional attractor, or WebRTC DataChannel for cross-device weight sharing.

V01D landing: local-AI GPU neural kernel skill under void-live-deploy/skills/; testable by energy drop under simulated pointer/orientation and weight round-trip via IndexedDB.
