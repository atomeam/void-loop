# F205 · WebRTC/Broadcast Orientation-Causal DOM Agent Competition

**Branch away from:** Recent dominant cluster of WebGPU compute softbody/fluid/neural kernels driven by local RNN/MLP controllers, WebXR hand/gaze causal inputs, multi-agent particle genome competitions on canvas, DOM probes as secondary, and audio sonification (F197–F204). Explicitly leaves GPU lattices, recurrent neural kernels, softbody physics, residual/attention fields, and pure canvas embodiments.

**Novel combination:** Pure hybrid DOM embodiment of competing agents (positioned via CSS transform, no canvas/WebGPU). DeviceOrientation as global causal gravity affecting all agents. Pointer/click injects resources. Tiny local linear controllers (genome-parameterized, not deep nets) steer agents. Sealed genome transfer via BroadcastChannel (multi-tab peer simulation) + IndexedDB persistence. Soft competition via score-based repulsion. Fully offline-capable single file; multi-tab demonstrates shared field without server. Building block for true WebRTC data-channel multi-device sync.

## Capability
- 6+ DOM circular agents with 6-float genomes (mass, spring, noise, hue, attract, maxSpeed).
- Local controller computes force from nearest-resource seek + orientation gravity + genome noise.
- DeviceOrientation beta/gamma tilts the force field for all agents (permission button).
- Click or button places resources; agents collect and score.
- Soft multi-agent competition: higher-score agents repel lower ones.
- Seal winner genome (simple hash) → IndexedDB + broadcast to peers.
- Inject any sealed genome into a new living agent (local or remote).
- BroadcastChannel syncs agent states, seals, injects, and resources across same-origin tabs.
- Progressive: works fully offline single-tab; multi-tab for "shared field" demo.

## Building blocks for next
- BroadcastChannel sealed-genome + state sync primitive → ready for WebRTC DataChannel multi-device without signaling server (or with simple public one).
- Orientation-causal global field on pure DOM physical agents.
- Hybrid DOM embodiment where agents are first-class UI elements that can host further local logic or portals.
- IDB sealed store for cross-session multi-agent continuity.

## Failure modes
- DeviceOrientation requires user gesture/permission (especially iOS); falls back to zero tilt.
- BroadcastChannel same-origin only; private mode or blocked → single-player.
- No true WebRTC in this prototype (BroadcastChannel as reliable offline multi-tab proxy); next can add RTCPeerConnection.
- Simple hash not cryptographic; genomes can saturate or diverge.
- High agent count on low-end may drop frames (current is light).
- IndexedDB quota/private → in-memory only.

## Test
Open index.html (offline ok). Click Start. Enable Orientation and tilt device (or use DevTools sensors). Place resources, watch agents compete and collect. Seal winner, open second tab, Inject or observe sync. Reload to confirm IDB sealed genomes persist. Works without WebGPU/XR/network.
