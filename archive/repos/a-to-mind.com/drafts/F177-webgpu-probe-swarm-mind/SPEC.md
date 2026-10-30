# F177 WebGPU Probe Swarm Mind

## Concept
Novel combination: a GPU-targeted spatial probe swarm (particles that actively sample and track a decaying user-intent density field deposited by pointer motion) whose global attraction and decay parameters are continuously evolved by a local Web Worker mind. The swarm's collective centroid and energy physically relocate and recolor a floating DOM "mind card" that serves as both status and an additional interactive attractor. This expands The Void canvas with an embodied local AI whose reasoning (evolutionary search for better tracking of user gesture) changes the interface geometry itself.

Not a superficial variation of prior F- work (F-020 FSM agents, F-021 spatial + density morph, particle-life matrix evo, boids, NCA lattices, residual predictors, etc.). Here the agents are pure spatial probes, the mind optimizes a tracking fitness against pointer history, and the primary UI element moves with the swarm.

## Architecture
- Single index.html.
- Main thread: Canvas2D particle integration (WebGPU compute shader path documented for future lift: storage buffers for positions/velocities, compute for attraction to density texture).
- Pointer deposits decaying density (simple array or texture proxy).
- Blob Web Worker: small population evolutionary algorithm (mutate attraction strength, decay rate; fitness = inverse mean distance of probes to recent pointer samples + low energy bonus).
- DOM mind card: position lerped to swarm centroid, border/hue from fitness and energy. Draggable to seed extra attractor.
- Seal persists best params to localStorage.

## Expected outcome
Interactive field where probes gather along user strokes; the mind card drifts toward the action and changes appearance as the local mind finds better tracking parameters. Fully offline, no external models or network.

## Mechanics
- Density field: circular deposits on pointer move, exponential decay.
- Probes: integrate velocity toward local density gradient + noise, damped.
- Evolution: every ~2s, evaluate fitness, mutate, replace worst.
- UI morph: card.left/top = centroid; filter hue = energy * 360; opacity/fitness badge.
- Click seal stores JSON.

## Failure modes
- No Web Worker (CSP) → static params.
- High probe count → reduce N.
- WebGPU not yet wired (CPU baseline); next experiment can replace the update loop with a compute pass.

## Building blocks for next
True WebGPU compute + 3D density texture, WebXR controller as probe emitter, multi-swarm competitive minds, sealed genome export as V01D skill input.

## Lands in V01D
Spatial stage mini under skills/mini/probe-swarm-mind.js. Test: pointer path of length 100 produces centroid shift > 50px within 1s and fitness increase over 10s of evolution.
