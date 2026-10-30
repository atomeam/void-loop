# F-038: Living Spatial Cards Mind

## Concept
Novel combination: A continuous Canvas2D spatial field (parameterized reaction-diffusion / logistic lattice) whose local update rule is evolved by a Web Worker genetic algorithm. Fitness rewards field complexity (spatial variance + entropy proxy), sustained activity, and *co-location responsiveness* to a small population of real DOM "cards" that inhabit the space. The cards are positioned, scaled, hue-rotated, and blurred by sampling regional field statistics; dragging a card seeds energy bursts into the field at its location and biases selection. Overall page chrome also morphs. Pointer or multi-touch seeds additional energy. Seal hashes current best genome + metrics into IndexedDB.

Not a superficial variation of prior F-series (discrete agents, pure field observers, fluid/RD/evo lattices, volumetric audio, boids, trajectory memory, attention graphs, vector fields, spectral resonance, neural swarms, evolving NCA, voice resonance): here the spatial mind and the document itself co-evolve — DOM elements are first-class spatial participants whose layout is driven by the field they help shape, rather than passive chrome overlays or particle-only agents.

## Architecture
Single self-contained `index.html`. Blob Worker maintains a small population of parameter vectors (diffusion, reaction rate, decay, attractor strength), receives reduced metrics + card positions every ~0.5s, evaluates fitness, mutates, returns best. Main thread steps an 80×50 float grid, renders as HSL, samples regional means to drive CSS custom properties and absolute positioning of 5 living cards, applies global morph. Graceful fallbacks: no Worker → fixed params; no WebGPU needed (Canvas2D); audio optional drone from regional activity after gesture.

## Expected outcome
Interactive "living document" where content cards drift, pulse, and recolor according to an evolving spatial field, while dragging them sculpts the field and steers evolution toward more interesting co-located patterns. Page chrome warps with collective complexity. Sealed genomes form local memory of successful living-layout rules. Runnable with graceful fallbacks.

## Mechanics
- Grid: 80×50 cells, state ∈ [0,1]
- Rule: diffusion + reaction * state*(1-state) - decay, plus local attractors from cards
- Cards: 5 absolute-positioned DOM nodes; regional average → translate/scale/hue/opacity
- Mind/evolution ~0.5 Hz; drag injects seed + fitness bonus for responsiveness
- Morph: field variance → CSS filter/hue/blur/scale on body
- Seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
CSP blocks blob Worker → static params; low-end drops resolution or skips readback; orientation/audio ignored if unavailable; cards may overlap on small viewports.

## Building block for future
True WebGPU compute lattice with multi-channel states + parallel card sampling, WebXR where cards float in 3D space, sealed genome breeding that transfers living-layout policies, local tiny MLP transition instead of parametric RD.

## V01D landing
Spatial stage skill (`skills/mini/living-spatial-cards.js`); testable via `tools/living-spatial-cards.test.mjs` for regional-sample → card-transform mapping and genome → field response.
