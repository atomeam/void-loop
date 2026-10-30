# F-049 Predictive Swarm Residual Mind

## Concept

Novel combination of:

- Canvas2D particle swarm with local cohesion/separation rules modulated by residual error
- Web Worker evolutionary population of linear predictors of pointer velocity from short history
- Residual of the best predictor controls swarm cohesion, particle hue drift, and global page hue / glow
- Draggable DOM "memory orbs" act as spatial attractors that seed the swarm and provide embodied interaction
- Seal button persists best genes to localStorage for cross-session continuity

Not a superficial variation of prior frontier work:

- F-020 WebGPU agents (discrete FSM, not continuous residual-modulated swarm)
- F-021 spatial orientation + density + morph (no predictor residual)
- F-043 predictive residual lattice (lattice RD, not particle swarm; no orbs)
- F-047 causal attention lattice (attention kernel on lattice, not swarm + linear predictor)

Mind is an evolutionary residual minimizer whose error is the spatial control signal for the swarm and the chrome.

## Architecture

Single self-contained `index.html`.

- Main thread: particle simulation, pointer history, residual computation, DOM orbs, Canvas2D render, CSS variable morphing
- Blob Worker: population of 10 linear predictors (4 genes each), fitness from residual + coherence, mutation of elite, returns best genes ~2 Hz
- Fallback: if Worker blocked, uses static genes

## Expected outcome

Interactive spatial swarm that anticipates gesture via residual, warps its own dynamics, and morphs the page. Draggable orbs inject attractors. Runnable offline. Seal persists genome.

## Mechanics

- Pointer history (16 samples) feeds residual calculation
- Residual (0-1) scales cohesion vs separation and hue
- Orbs within range pull particles
- Fitness rewards low residual and high coherence
- Evolution replaces worst individual with mutated elite

## Failure modes

- CSP blocks blob Worker → static genes, still interactive
- Low pointer movement → residual stays high, swarm more chaotic
- Very small screens crowd orbs
- localStorage quota or private mode → seal fails gracefully

## Building blocks for future

- Replace linear predictor with tiny MLP or WebGPU compute residual
- WebXR hand rays as additional causal input
- Multi-agent genomes competing for orb proximity
- Sealed genome breeding across sessions or users

## Lands in V01D

Spatial stage skill (`skills/mini/predictive-swarm-residual.js`). Testable via residual→cohesion and conf→morph mapping.
