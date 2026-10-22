# F-221 WebGPU MLP Physics Learner

**Novel combination:** WebGPU compute shader integrates a shared 256-particle field under simple spring + pointer-attractor forces. A population of 6 tiny MLPs (input: local density/velocity/pointer delta → 4-12-4 → predicted force) runs on the main thread. Prediction error vs. actual integration step is the fitness signal. Weakest agent is periodically replaced by a mutated copy of the leader. Leader weights are sealed to IndexedDB and can be reloaded. Canvas visualizes particles colored by nearest MLP; DOM HUD shows ranks. Fully offline after load; Canvas2D fallback if no WebGPU.

**Branches away from:** residual prediction oracles (F216), spatial attention lattices (F219), orientation-RNN softbody competitions (F218), acoustic/spectral foragers (F214/F217), WebXR hand residual DOM oracles, neural-kernel DOM chains (F213), and window-spanning SharedWorker organisms (F220). Moves to pure WebGPU particle physics substrate driven by competitive online MLP force predictors with sealed genome transfer.

**Architecture:** single self-contained index.html; WebGPU compute for particle integration (storage buffers); main-thread MLPs; Canvas2D readback viz; IndexedDB seal; progressive fallback to pure Canvas2D CPU integration. No external dependencies.

**Expected:** Particles swarm toward the pointer. MLPs compete to better predict the resulting forces. Leader’s sealed weights persist across reloads. Drag or click to set attractor.

**Failure modes:** no WebGPU (Canvas2D fallback works); IndexedDB blocked (in-memory only); low-end devices (reduce particle count).

**Building blocks:** WebGPU compute particle integrator + competitive local MLP force predictors + sealed weight transfer. Next: full MLP inference inside the compute shader, or WebRTC DataChannel for cross-device genome sharing, or true WebXR gaze as additional attractor ray.

V01D landing: local-AI physics skill under void-live-deploy/skills/; testable by error drop under simulated pointer and weight round-trip via IndexedDB.
