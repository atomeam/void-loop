# F-044: Neural Implicit Spatial Vector Field Mind with Particle Tracers

## Concept
Novel combination of a continuous neural implicit vector field (small shared MLP that maps normalized position + pointer proximity to velocity) evolved by a local Web Worker, passive particle tracers advected by sampling the field, Canvas2D visualization of trails, DeviceOrientationEvent global bias, and CSS morphing of Void chrome driven by field curl/variance and fitness. Pointer acts as both attractor query and fitness signal. Seal persists best weight genome to IndexedDB.

Not a superficial variation of prior experiments:
- Not F-020 discrete agents
- Not F-033 discrete grid control vectors (here continuous MLP-generated field)
- Not F-040 free DOM neural probes (particles are passive tracers of the implicit field)
- Not F-043 parameter RD or F-042 residual prediction particles
- Not F-022 rule-based fluid
The mind *is* the generator of a smooth continuous force field; selection optimizes emergent transport structures rather than discrete rules or free agents.

## Architecture
Single self-contained `index.html`.
- Main thread: ~160 particles, each samples MLP(x, y, pointer_dist) for velocity, Euler advection with damping, draws trails on Canvas2D, samples field stats (curl proxy, speed variance), applies CSS morph, handles pointer and orientation.
- Blob Worker: population of 6 MLP weight genomes (inputs 3 → hidden 8 → outputs 2, ~40 weights), evaluates fitness from reported diversity + pointer density + moderate energy, mutates, returns best weights ~1 Hz.
- Fallbacks: no Worker → fixed interesting weights; orientation denied → pointer only; IndexedDB fail → localStorage.

## Expected outcome
Particles stream and swirl according to a learned continuous vector field that develops attractors or channels around the pointer; page hue, contrast, and scale morph with field complexity and learning progress; sealed genomes remember successful neural field policies. Fully offline-runnable.

## Mechanics
- MLP: ReLU hidden, tanh outputs scaled to velocity; inputs [x_norm, y_norm, exp(-dist_to_pointer)].
- Particles: position wrap or bounce, velocity = field + small noise + orientation bias, damp 0.98.
- Fitness: particle position entropy proxy (spread) + count near pointer + (1 - extreme speeds).
- Morph: fitness + speed variance → hue-rotate, contrast, scale, blur.
- Seal: truncated SHA-256 of weights + fitness + timestamp → IndexedDB.

## Failure modes
Worker blocked → static field; high particle count on low-end → drop to 80; orientation requires permission/HTTPS; particles may clump (mild repulsion or noise).

## Building block for future
True WebGPU compute for MLP eval + advection on large particle counts; WebXR head-tracked pointer; multi-resolution neural fields; sealed genome transfer; attention over particle states feeding the field.

## V01D landing
Spatial stage skill (`skills/mini/neural-implicit-vector-mind.js`); testable via `tools/neural-implicit-vector-mind.test.mjs` for position+pointer → velocity and fitness → morph mapping.
