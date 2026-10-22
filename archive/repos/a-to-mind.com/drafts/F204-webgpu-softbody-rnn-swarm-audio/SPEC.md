# F204 · WebGPU Softbody Lattice Driven by Local Worker RNN Swarm with Spatial Audio Sonification

**Branch away from:** F203's gaze-driven WebGPU neural kernel grid + IDB persistence + DOM probes. Avoids pure kernel recurrence, gaze-as-energy deposit, and genome sealing as primary. Leaves hand-tracking, multiagent genome competitions, orientation gravity, and residual predictors.

**Novel combination:** A WebGPU-accelerated spring-mass softbody lattice (compute shader updates positions/velocities). A dedicated Web Worker hosts a swarm of tiny RNNs (one per softbody node cluster) that output forces based on local density, pointer trajectory memory, and inter-agent competition. DOM morphing cards act as "portals" that sample lattice strain and scale/hue/position accordingly. Web Audio API spatializes oscillators whose frequency/gain map to lattice kinetic energy and agent activity. Fully client-side, progressive (CPU fallback), offline-capable after load.

## Capability
- Pointer trajectory (last 32 samples) is fed as context to RNNs in the Worker.
- Worker RNNs (simple Elman-style, 6-in → 2-out force) run at ~30 Hz; main thread samples outputs to apply forces to lattice.
- WebGPU compute: updates 32×32 softbody grid (positions, velocities, constraints). Canvas2D fallback for visualization and simple Euler integration.
- 4 floating DOM "portal" cards morph (scale, border-radius, hue, opacity) based on local lattice strain and agent force magnitude.
- Spatial audio: 3 PannerNodes + oscillators driven by peak kinetic energy regions; gain follows total agent activity.
- No persistence this run (building block for later IDB/WebRTC sync of lattice + RNN weights).
- Interactive: click to inject energy pulse; pointer drag influences trajectory memory.

## Building blocks for next
- Worker-isolated RNN swarm → force vector upload pattern for GPU softbody.
- Softbody strain → DOM morph mapping primitive.
- Lattice kinetic energy → Web Audio spatial sonification loop.
- Ready for WebXR hand forces or multi-device lattice sync.

## Failure modes
- WebGPU unavailable → pure CPU softbody + Canvas2D (still runs).
- Worker creation fail → inline RNN fallback on main thread.
- AudioContext requires user gesture; starts muted until click.
- High node count may hitch on low-end devices; 32×32 is conservative.
- RNN saturation → simple noise injection on force outputs.

## Test
Open index.html. Click to start audio. Move/drag pointer to build trajectory. Observe softbody deform, portals morph, and hear spatial tones shift with energy. Confirm Worker status in console. Works offline.
