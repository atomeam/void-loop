# F194 WebXR Gaze RNN Hybrid Sculpt

## Concept
True WebXR gaze (with pointer fallback) as causal input to a local tiny RNN that sculpts hybrid DOM+canvas embodiments. Energy seeds from gaze diffuse on canvas; RNN state evolves and drives positions/scales/colors of floating DOM cards. State persisted in IndexedDB for continuity across sessions. Offline-capable single file.

## Branch
Deliberately leaves recent cluster of WebGPU compute shaders, sealed genome multi-agents, orientation/hand MLP hybrids, WebRTC fields, attention lattices, residual predictors, volumetric injection, pure NCA, spectral/audio residuals, pointer-history fields.

## Interactive
- Click canvas or "Seed" to inject energy.
- Enter WebXR if available (immersive-vr).
- Watch RNN-driven hybrid cards morph in real time.
- Auto-saves to IndexedDB every 5s; loads on open.
- Reset clears mind state.

## Failure modes
- WebXR may be unavailable; falls back to pointer.
- IndexedDB private mode may fail silently.
- Simple RNN may saturate; weights fixed for prototype.

## Building blocks for next
Local RNN controller + hybrid DOM/canvas + IndexedDB persist + XR gaze input.
