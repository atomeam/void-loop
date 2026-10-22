# F198 — Orientation MLP DOM Gravity Swarm

## Concept
Novel combination: Multi-agent competition embodied purely as hybrid DOM cards (absolute-positioned divs) whose positions obey simple Verlet-like physics under DeviceOrientationEvent as true gravity vector. Each agent has a local tiny MLP (4→8→2) that receives local density + energy + gravity components and outputs jump impulses. Fitness from time spent near a center resource zone drives selection/mutation. Genomes sealed by SHA-256, persisted in IndexedDB, transferable by copy-paste of seal+base64 (manual, no WebRTC). Background canvas only visualizes the gravity vector and resource zone — the agents themselves are DOM. Offline-first, pure JS, no WebGPU.

## Branch
Deliberately leaves the dominant recent cluster (F190–F197): WebGPU neural kernels / attention swarms / embedding lattices / particle fields, WebXR hand/gaze force injection or sculpt, sealed genome DOM swarms with WebRTC, DeviceOrientation spring-mass chains or pure bias into MLPs, causal memory orbs. New axis: orientation-as-gravity on pure DOM embodiments + MLP jump controllers + sealed paste-transfer + hybrid canvas visualization only, without compute shaders, attention lattices, residual predictors, NCA, volumetric, spectral, or pointer-history fields.

## Files
- index.html — single self-contained interactive offline prototype

## Mechanics
- 10 agents as colored DOM rounded cards, positions updated in rAF.
- Gravity from DeviceOrientation beta/gamma (permission on gesture) or pointer as soft bias.
- MLP inputs: local agent density, own energy, gravity x/y. Outputs: vx/vy impulse.
- Bounds bounce, damping.
- Fitness accumulates when near screen center; evolve replaces bottom half with mutated top genomes.
- Seal: SHA-256 of weight buffer, short hex displayed on card.
- IndexedDB save/load of all sealed genomes.
- Transfer: copy seal|base64 of selected; paste into textarea + inject as new agent.
- Canvas overlay draws gravity arrow + center circle only.
- No external dependencies.

## Failure modes
- No DeviceOrientation / permission denied → pointer bias only, status notes.
- No IndexedDB (private mode) → in-memory, warn on save/load.
- Desktop → tilt simulated via pointer.
- High count → still smooth on modern devices.

## Building blocks for next
Orientation-as-gravity on DOM agents, pure-JS MLP impulse controllers, sealed paste genome transfer protocol, hybrid DOM physics + minimal canvas viz, IndexedDB persistence of sealed weights. Next: WebXR hand grasping DOM cards, or WebGPU acceleration of the density query, or BroadcastChannel shared field.

## V01D landing
Spatial/local-AI skill under void-live-deploy/skills/; testable by seal persistence after reload and fitness ranking after evolve step.
