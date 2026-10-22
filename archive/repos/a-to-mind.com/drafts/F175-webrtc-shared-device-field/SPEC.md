# F175-webrtc-shared-device-field

## Concept
Novel combination: multi-peer WebRTC DataChannels for sharing a live spatial particle field, with DeviceOrientation (or pointer fallback) as causal input that injects local energy/forces into the shared field. Field snapshots persist via IndexedDB. Hybrid DOM controls for signaling/connection status + Canvas2D embodiment. Offline-capable for local simulation; peers connect for shared mind field.

Deliberately branches away from the recent dominant cluster (attention lattices, residual predictors, volumetric injection, pure NCA, spectral/audio residuals, pointer-history fields, WebXR-hand-MLP-swarms, WebGPU-MLP-orientation-physics, competitive-genome-agents, orientation-MLP-UI-controllers). Under-explored axes: persistent IndexedDB/WebRTC shared fields, DeviceOrientation as causal input, hybrid DOM+canvas embodiments. Expands building blocks toward multi-user local-AI spatial stages.

## Architecture
- Single self-contained index.html
- Canvas2D particle field (N≈180 particles) with simple attract/repel + energy injection
- DeviceOrientationEvent (or mouse) updates local injection point and force strength
- WebRTC: RTCPeerConnection + DataChannel; manual SDP copy-paste signaling for demo (no external server)
- IndexedDB: store/load last field snapshot (positions, velocities, energy)
- DOM: connection status, Offer/Answer buttons, Seal snapshot, Reset
- Offline: local mode works fully; shared when peers connect

## Expected outcome
Interactive shared field where tilting the device (or moving pointer) causes particles to respond and the effect can propagate to connected peers. Sealed snapshots survive reload. Failure modes: no WebRTC support → local only; no DeviceOrientation → pointer; no IndexedDB → memory; signaling requires manual exchange.

## Mechanics
Request orientation permission if needed. Generate Offer or paste Answer to connect. Tilt/move to inject. Seal to persist local view. Reset clears.

## V01D landing
Spatial stage skill (`skills/mini/webrtc-shared-device-field.js`); testable via orientation→injection mapping and DataChannel message roundtrip.
