# F-048 Evolving Particle-Life Mind

## Concept
Novel combination: Canvas2D particle-life simulation (multi-species attraction/repulsion forces) whose interaction matrix is continuously evolved by a local Web Worker genetic algorithm. Floating DOM "species cards" act as embodied attractors that users can drag; particle density feeds back into card motion and evolutionary fitness (diversity + energy + engagement proxy). Global chrome hue morphs with field energy. Seal persists best matrix to localStorage.

Not a variation of:
- F-020 FSM agents
- F-022 gravity wells
- F-023/F-025 evolved substrate or boids params
- F-038 living cards (field-driven DOM)
- F-043 predictive residual lattice
- F-047 causal attention lattice
- F-046 volumetric injection

Mind is evolutionary search over social force rules, embodied by movable species cards.

## Architecture
Single index.html + blob Worker. 4 species, 400 particles. Cards are real DOM elements. Main thread steps physics ~60 Hz, Worker evolves population of 6 matrices ~ every few seconds.

## Expected outcome
Interactive spatial field of colored particles that form clusters and streams in response to dragged cards; cards gently migrate toward their own species; page hue shifts with activity. Offline runnable.

## Mechanics
- Particle-particle forces via evolved matrix (subsampled for perf).
- Card attractors stronger for matching species.
- Fitness: species diversity + clamped energy.
- Evolution mutates one entry; best matrix replaces current.
- Hue via CSS filter.

## Failure modes
- CSP blocks blob Worker → static random matrix.
- High particle count on low-end devices → slow.
- No pointer → pure evolution from initial diversity.

## Building blocks
True WebGPU compute particle forces, multi-species semantic embeddings, WebXR hand as card controller, sealed genome transfer across sessions.

## Lands in V01D
Spatial stage skill (skills/mini/evolving-particle-life.js). Testable via tools/particle-life.test.mjs for matrix→force and diversity→fitness mapping.
