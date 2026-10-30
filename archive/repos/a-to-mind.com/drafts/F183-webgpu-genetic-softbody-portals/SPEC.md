# F-183 WebGPU Genetic Softbody Agents with Self-Morphing DOM Portals

## Architecture
- WebGPU compute shader (with Canvas2D fallback) updates a soft-body particle system: particles connected by springs with damping, attracted to user-injected energy points.
- Local genetic algorithm (main thread) evolves a small population of agent genomes (attraction radius, spring stiffness, exploration noise). Fitness = cluster cohesion + energy absorption.
- DOM "portal" cards are physically bound to high-fitness agent centroids: their CSS transform (translate, scale, rotate), opacity, and border color are driven directly by agent state and residual energy.
- User pointer injects energy; "Evolve" button forces a generation; "Seal" persists best genome + field snapshot to localStorage.
- Novel combination: GPU soft-body physics + on-device evolutionary optimization + UI elements that are literal physical extensions of the agents (not merely styled by a global metric).

Not a superficial variation of F-020 (FSM agents), F-021 (orientation density morph), F-041 (resonance wave agents), F-182 (spectral NCA orientation), or prior swarm/NCA drafts: the agents are evolved genomes controlling soft-body parameters, and the portals are individually positioned and transformed by specific agent centroids rather than a global field statistic.

## Expected outcome
Interactive canvas where particles form soft clusters; agents evolve to better absorb injected energy; portal cards fly, grow, and recolor as agents claim space. Runnable in modern browsers; WebGPU preferred, Canvas2D always available.

## Mechanics
- 100 particles, 6 agents, genomes as plain objects.
- Generation every ~8 seconds or on button; selection by fitness, multiplicative mutation.
- Portals created for top 3 agents; removed/recreated on generation.
- Seal writes JSON to localStorage under key `void-f183-seal`.

## Failure modes
- No WebGPU → Canvas2D path (still fully interactive).
- High particle count on low-end devices → reduce N.
- localStorage quota or private mode → seal fails gracefully.

Building block for: WebXR embodiment of the same soft-body agents or Worker-isolated GA with SharedArrayBuffer.
