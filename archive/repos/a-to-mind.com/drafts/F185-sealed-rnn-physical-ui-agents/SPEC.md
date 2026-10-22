# F185 Sealed RNN Physical UI Agents

## Concept
Local tiny RNN (recurrent state) agents compete to control hybrid DOM physical UI cards. DeviceOrientation (or pointer proxy) is the causal input. Agents evolve/mutate via sealed genome transfer. Best genome persists in IndexedDB across sessions. Hybrid canvas visualization of agent fields + DOM embodiment. Offline-capable. No particle physics, no WebGPU, no SPH/softbody/portals.

Deliberately branches from recent cluster F177–F184 (WebGPU probe swarms, RNN softbody, WebXR gaze competition, orientation MLP fields, compute genome physics, spectral NCA, genetic softbody portals, SPH vortex portals). New axis: pure local recurrent models driving physical CSS UI elements with persistent sealed multi-agent transfer and DeviceOrientation causality, without simulation kernels or fluid dynamics.

## Architecture
- Single self-contained index.html
- 4 agents, each owning a DOM card
- Tiny RNN: hidden state + weights (input 4 → hidden 6 → output 3: dx, dy, scale)
- Inputs: norm orientation/pointer, own fitness, time sine
- Fitness: proximity to high-energy user injection points + low velocity (stability) + claimed area
- Transfer: every ~8s or button, sort fitness, mutate champion, overwrite worst
- Seal: IndexedDB store champion weights + hidden states
- Canvas2D draws agent trajectories and energy field
- Offline: fully local, IndexedDB fallback to memory

## Interaction
Tilt device or move pointer to inject energy and bias agents. Cards move, scale, recolor under agent control. Seal persists winner. Transfer forces genome competition. Reload restores sealed champion.

## Expected outcome
Interactive spatial UI where competing recurrent agents physically move and morph DOM cards in response to device orientation or pointer. Persistent sealed evolution. Runnable offline in modern browsers.

## Failure modes
- No DeviceOrientation: pointer proxy
- IndexedDB blocked: in-memory only
- Low motion: agents stabilize near start
- Small screen: cards overlap, still functional

## Building blocks
Sealed multi-agent RNN genomes, IndexedDB persistence protocol, hybrid DOM+canvas physical embodiment driven by local models, DeviceOrientation as causal control signal.
