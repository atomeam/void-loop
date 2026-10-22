# F-023 WebGPU/Canvas Evolutionary Lattice Mind

## Concept
Novel combination for The Void canvas: a continuous lattice (grid) substrate simulated on Canvas2D (WebGPU compute path noted for scaling), where each cell evolves under a parameterized local rule. A local Web Worker maintains a small population of rule-parameter genomes and evolves them via selection and mutation, using field entropy/variance as fitness. The current best genome is applied to the substrate. The surrounding UI (border radius/hue/thickness, floating assimilation card transform and color) physically morphs according to the mind's fitness and diversity. Web Audio API sonifies the field: cell activity drives oscillator frequency and gain, so the interface is audiovisual. User pointer injects energy; optional DeviceOrientationEvent tilts a gravity bias into the rule. Seal button hashes the current genome + stats into IndexedDB for local persistent memory of successful rules.

This is not a superficial variation of prior frontier work:
- F-020: discrete particle agents + simple FSM (no evolution, no audio).
- F-021: orientation + density worker or reaction-diffusion + pattern classifier (observer, not evolver of rules).
- F-022: fluid advection + regime classifier that biases fixed params (no evolutionary search over rule space).

The mind is an active evolutionary controller of the substrate's local rules, closing a feedback loop that discovers new dynamics, with audiovisual morphing and sealed rule memory. Expands the frontier by turning the local AI into a search process over the physics itself.

## Architecture
- Single self-contained HTML/CSS/JS (Worker via Blob URL).
- Canvas2D 64×64 (or 128×128) float grid; update loop applies current rule params.
- Every ~20 frames, main posts recent field stats (mean, variance, entropy proxy) to Worker.
- Worker maintains population of 8 genomes (each a small float vector: diffusion, reaction rates, bias). Fitness = entropy * diversity. Selection, crossover, mutation; returns best genome + generation + fitness.
- Main applies genome to next steps, sets CSS custom properties and transforms.
- Web Audio: Analyser or direct mapping of field mean/delta to OscillatorNode frequency (200–800 Hz) and GainNode.
- Seal: SHA-256 of genome+stats+ts written to IndexedDB store "void-evo-rules".
- Fallback: no Worker → fixed rule; no AudioContext → silent visual only; no orientation → pointer only.
- No external dependencies, no network, no large models.

## Expected outcome
An interactive spatial lattice that continuously evolves its own update rules under local selection pressure for interesting dynamics. The page chrome warps and a generative tone follows the field's activity. User can seed structures; sealing builds a local ledger of assimilated rule genomes. Runnable in any modern browser; graceful degradation.

## Mechanics
- Grid initialized near 0.5 with noise.
- Pointer drag sets cells to high value (catalyst).
- Orientation beta/gamma (if granted) adds a directional bias term to the rule.
- Mind updates ~2–3 Hz.
- Morph: border-radius 4–40px, hue from fitness, card scale 0.85–1.2 and slight rotation.
- Clear resets grid; Seal stores; recent seals listed.
- Generation counter and fitness shown in HUD.

## Failure modes
- Worker blob blocked by CSP → inline fixed-rule fallback with note.
- AudioContext blocked or user gesture required → start on first pointer.
- High grid size on low-end → auto drop to 48×48 or lower step rate.
- IndexedDB blocked → in-memory seals.
- Orientation denied → pointer + optional keyboard arrows for bias.

This prototype is a building block: future runs can move the lattice update to a WebGPU compute shader for larger grids, feed sealed genomes as initial populations into multi-tile Void systems, or couple the evolutionary mind to a WebXR view of the lattice as a 3D volume.
