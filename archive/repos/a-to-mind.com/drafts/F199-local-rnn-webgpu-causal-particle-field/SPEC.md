# F199 — Local RNN WebGPU Causal Particle Field

## Concept
Novel combination: Multi-agent competition where each agent is a local tiny RNN (hidden state recurrent, pure JS) that receives DeviceOrientationEvent components + local particle density and outputs force biases. These biases are uploaded as a uniform/storage buffer to a WebGPU compute shader that advances a shared particle field under simple Newtonian physics (orientation-derived gravity, damping, bounds). Fitness accrues from particle accumulation near agent anchors. Genomes (RNN weights + initial hidden) sealed by SHA-256, persisted in IndexedDB. Hybrid embodiment: WebGPU canvas for the particle field + absolute DOM cards for agents (display seal, energy, allow drag to inject local force or paste genome). Offline-first, no external deps, WebGPU optional (JS particle fallback).

## Branch
Deliberately leaves the dominant recent cluster (F190–F198): WebGPU attention/embedding lattices, neural kernel competition fields, sonified/spectral thought fields, orientation MLP DOM gravity swarms, WebXR gaze/hand causal lattices or sculpt, DeviceOrientation spring-mass hybrids, trajectory-attention echoes, pure NCA or residual predictors. New axis: recurrent (RNN) controllers rather than feedforward MLP, causal orientation into recurrent hidden state, WebGPU compute for particle physics kernel (not attention or volumetric), hybrid DOM agent cards that causally inject into the field, sealed IndexedDB genome (weights+state) without WebRTC or pointer-history.

## Files
- index.html — single self-contained interactive offline prototype
- SPEC.md — this document

## Mechanics
- 6 agents, each a tiny RNN: input 4 (orient_x, orient_y, local_density, energy) → hidden 6 → output 2 (force_x, force_y). Recurrent: h_t = tanh(W_h h_{t-1} + W_x x + b).
- Forward pass pure JS; weights ~50 floats.
- WebGPU compute: particles (pos, vel) updated with global orientation gravity + per-agent force fields (nearest or radial) + damping + bounds bounce. Workgroup dispatch.
- If no WebGPU: canvas 2D particle fallback with same rules.
- DeviceOrientation (iOS permission on first gesture) or pointer tilt simulation.
- Competition: evolve replaces lowest-fitness half with mutated copies of highest; fitness += particles in agent radius.
- Seal: SHA-256 of concatenated weights + hidden snapshot; short hex on DOM card.
- IndexedDB: save/load array of sealed genomes.
- Hybrid: DOM cards positionable; drag injects temporary force into nearby particles; click to select for transfer.
- Transfer: copy seal|base64, paste into input to inject new agent.
- rAF loop, status panel.

## Failure modes
- No WebGPU → 2D canvas particles still fully interactive and evolve.
- Orientation denied/desktop → pointer-as-tilt fallback, status notes.
- No IndexedDB → in-memory only, warn on save.
- High particle count → throttle or reduce count on low FPS.
- RNN explosion → clamp hidden and outputs.

## Building blocks for next
Recurrent hidden-state controllers feeding WebGPU storage buffers, orientation-causal into RNN, hybrid DOM force-injection into GPU particle field, sealed (weights+state) IndexedDB protocol. Next: full WGSL RNN unrolling, WebXR hand to grasp particle clusters, or BroadcastChannel shared sealed genomes.

## V01D landing
Spatial/local-AI skill under void-live-deploy/skills/; testable by seal persistence after reload, particle response to orientation, and fitness ranking after evolve.
