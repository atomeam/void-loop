# F174-webxr-hand-mlp-swarm

## Concept
Novel combination: true WebXR hand-tracking (or pointer/DeviceOrientation fallback) as causal input to a local tiny MLP that outputs force multipliers for a Canvas2D particle swarm. Hand joints (palm, index tip relative) feed the MLP; particles are attracted/repelled accordingly. Hybrid DOM controls (enter XR, reward, seal) + canvas embodiment. Weights persist in IndexedDB. Offline-capable.

Deliberately branches away from the recent dominant cluster (attention lattices, residual predictors, volumetric injection, pure NCA, spectral/audio residuals, pointer-history fields, WebGPU orientation-MLP physics, competitive genome agents). Under-explored axis: true WebXR hand as causal input to local model controlling spatial swarm, hybrid DOM+canvas.

## Architecture
- Single self-contained index.html
- TinyMLP: 8→6→3 (hand relative pos/vel 6 + time 1 + energy 1 → force x/y/scale)
- Particles: 256, updated by MLP-modulated forces from hand position
- WebXR: navigator.xr.requestSession('immersive-vr', {optionalFeatures: ['hand-tracking']}); extract XRHand joints if available
- Fallback: pointer as hand, or DeviceOrientation
- IndexedDB for weights; Reward nudges toward current hand-swarm alignment; Seal commits
- Offline, no external deps

## Expected outcome
Interactive swarm that follows or orbits the user's hand in XR (or mouse). Tilt device as alt input. Rewarding improves mapping. Sealed weights persist. Failure modes: no WebXR → pointer mode; no hand-tracking → controller or pointer; no IDB → memory only.

## Mechanics
Enter XR or use mouse. Move hand/pointer to drive swarm via MLP. Reward good clustering. Seal to persist. Reset.

## V01D landing
Spatial stage skill (`skills/mini/webxr-hand-mlp.js`); testable via joint→MLP→force and session enter/exit.
