# F-184 WebGPU SPH Vortex Mind with Orbiting Portals

## Architecture
- Simplified SPH-inspired particle fluid (Canvas2D primary; WebGPU compute path noted for neighbor forces and density) where particles interact via pressure, viscosity, and cohesion forces.
- Local genetic algorithm evolves fluid parameters (viscosity, pressure strength, swirl bias) under selection for persistent vortex formation measured from user "swirl" gestures (circular pointer velocity correlation).
- DOM "vortex portal" cards are bound to emergent high-curl cluster centroids: they orbit, scale, and recolor according to local angular momentum and density.
- User pointer injects radial/swirl forces on drag; "Evolve" triggers generation; "Seal" persists best genome + snapshot to localStorage.
- Novel combination: free-particle SPH fluid dynamics + gesture-driven vortex fitness + UI elements that are physical extensions of emergent rotational structures (not spring soft-bodies, not lattice cells, not discrete FSM agents).

Not a superficial variation of F-020 (FSM agents), F-021 (orientation density), F-183 (spring softbody portals), F-182 (spectral NCA), or prior swarm/lattice drafts: particles are unbound with pressure/viscosity, fitness rewards curl/vortex stability from circular input, portals orbit specific vortex centers.

## Expected outcome
Interactive canvas where particles form flowing clusters and vortices under pointer swirls; evolution improves vortex persistence; portal cards orbit and pulse with the fluid. Runnable in modern browsers with Canvas2D; WebGPU noted for scale-up.

## Mechanics
- 120 particles with position/velocity; neighbor forces approximated by grid binning.
- Swirl detection: high cross-product of velocity vectors over short window rewards fitness.
- Generation every ~10s or button; top genomes mutate.
- 3 portals bound to highest-density rotating clusters; CSS orbit via transform.
- Seal: JSON to localStorage `void-f184-seal`.

## Failure modes
- Low-end devices: drop particle count.
- No circular input: fitness stays low, portals static.
- localStorage blocked: seal fails silently.

Building block for future: true WebGPU SPH with spatial hash, WebXR fluid embodiment, sealed vortex genomes transferred across sessions.
