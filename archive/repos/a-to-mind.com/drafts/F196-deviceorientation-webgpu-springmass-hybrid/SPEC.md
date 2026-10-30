# F196 DeviceOrientation WebGPU Spring-Mass Hybrid

## Concept
DeviceOrientationEvent as the sole causal gravity/force vector into a WebGPU-resident (JS Verlet fallback) multi-body spring-mass chain. Hybrid DOM beads overlay the canvas and can be pinned/unpinned by click. Two independent chains compete by exchanging sealed impulse packets via IndexedDB. No neural model, no attention, no genome, no cloth mesh, no hand/gaze.

## Branch
Away from recent cluster of WebXR hand/gaze + MLP/RNN hybrid agents + sealed genomes + attention/particle swarms + orientation-MLP.

## Files
- index.html (single self-contained, offline-capable)

## Mechanics
- Request orientation permission on gesture
- Gravity vector from beta/gamma
- Verlet integration of N masses with springs
- Canvas render
- Absolute-positioned DOM divs as interactive pins
- IndexedDB persist state + impulse transfer
- WebGPU detect + compute stub for future kernel

## Failure modes
- No orientation support (mouse tilt sim)
- No IndexedDB (in-memory)
- WebGPU unavailable (JS path)

## Building blocks
Orientation-as-physics-input, hybrid DOM-over-sim, sealed local impulse exchange. Next: full WGSL constraint kernel or WebRTC shared field.
