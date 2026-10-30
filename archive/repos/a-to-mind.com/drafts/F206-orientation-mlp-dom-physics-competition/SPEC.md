# F206 · Orientation-Causal Local MLP Controlling Hybrid DOM Physics Agents in Competition

**Branch away from:** Dominant recent cluster (F195–F205) of WebGPU compute lattices/softbody/fluid/neural kernels, WebXR hand/gaze causal inputs, RNN/MLP on canvas or GPU fields, spectral/audio residuals, pointer-history fields, multi-agent particle genome competitions on canvas, and residual/attention predictors. Explicitly leaves GPU compute shaders, canvas embodiments, WebXR sessions, audio sonification, and recurrent kernel grids.

**Novel combination:** Pure hybrid DOM physical embodiment. Multiple agents are first-class UI elements (absolutely positioned divs) whose positions are updated by simple Euler physics. Each agent is controlled by a tiny local MLP (genome-parameterized weights) whose inputs are relative vector to nearest resource plus DeviceOrientation (beta/gamma) as global causal gravity. Soft competition via score-based repulsion. Sealed genomes (simple hash) persisted to IndexedDB and broadcast via BroadcastChannel for multi-tab peer injection. Fully offline-capable single-file prototype; progressive (mouse works without sensors).

## Capability
- 5+ DOM circular agents, each with a ~12-weight tiny MLP (4-in → 4-hidden → 2-force-out).
- Inputs: normalized dx/dy to nearest resource, orientation beta/gamma.
- Outputs: force components applied each frame; orientation adds tilt gravity to all.
- Click or button places yellow resource orbs; agents collect for score.
- Higher-score agents softly repel lower-score ones.
- Seal current highest-score genome → IndexedDB + BroadcastChannel.
- Inject any sealed genome as a new living agent.
- Multi-tab: open second tab, seals sync, injects appear.
- No canvas, no WebGPU, no WebXR, no Web Audio — pure DOM + local AI + orientation causal field.

## Building blocks for next
- Orientation-as-causal-gravity on physical DOM agents.
- Tiny MLP genome → force controller primitive for hybrid UI embodiments.
- IDB + BroadcastChannel sealed-genome transfer for multi-session/multi-tab continuity.
- Ready for true WebRTC DataChannel multi-device genome/state sync or WebGPU acceleration of the physics step.

## Failure modes
- DeviceOrientation requires user gesture and permission (iOS); falls back to zero tilt (still interactive via resources).
- BroadcastChannel same-origin only; private/incognito may block.
- IndexedDB unavailable → in-memory genomes only, lost on reload.
- Tiny MLP may saturate or produce weak forces; genomes are random-init so diversity exists.
- High agent count or many resources may cause minor layout thrash (current is light).
- No cryptographic seal (demo hash only).

## Test
Open index.html (works offline). Click Enable Orientation and tilt device (or DevTools → Sensors). Place resources by clicking arena or button. Watch agents move, collect, and compete (repulsion visible). Seal winner, open second tab, Inject. Reload to confirm IDB persistence of sealed genomes. Works without any special APIs beyond DOM + optional sensors.
