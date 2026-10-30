# F-043: Evolving Parameter Reaction-Diffusion Mind with Spatial Seeding and Morphing Chrome

## Concept
Novel combination of a continuous Gray-Scott reaction-diffusion field (spatial emergent patterns), a local Web Worker evolutionary mind that evolves the global feed/kill parameters to maximize pattern complexity and response to user seeds, pointer interaction that injects local chemical seeds as teaching signals, Canvas2D (WebGPU compute path sketched) visualization of the field, and CSS morphing of the Void chrome driven by field entropy and fitness. Seal persists the best parameter genome to IndexedDB.

Not a superficial variation of prior experiments:
- Not F-020 discrete agents
- Not F-021/022 fluid/field observers or fixed regimes
- Not F-025 boids or F-040 neural probe swarm (no free agents)
- Not F-036/039 pure lattice evolution or multichannel without parameter genome
- Not F-042 predictive audio particles (no residual sensory prediction; here the mind controls the generative physics itself)
The core is an evolutionary controller of a generative spatial physics system, with user spatial acts as fitness signals.

## Architecture
Single self-contained `index.html`.
- Main thread: 64x64 (or 128) grid RD update in JS (double buffer), pointer click/drag injects B chemical, samples entropy/variance for fitness, draws to Canvas2D, applies CSS morph, handles seal.
- Blob Worker: population of 8 parameter genomes (feed, kill pairs), evaluates from reported fitness + seed success, mutates, returns best every ~2s.
- Fallbacks: no Worker → fixed interesting params (0.055/0.062); no canvas → still evolves; IndexedDB fail → localStorage.

## Expected outcome
Organic spots, worms, or coral patterns that the local mind evolves toward higher complexity in response to where the user seeds the field; page hue, contrast, and blur morph with the living field's activity; sealed genomes remember successful generative regimes. Fully offline-runnable, expands to true WebGPU compute next.

## Mechanics
- Grid: A=1, B=0 initial; Laplacian 3x3; da = Du*lapA - A*B*B + F*(1-A); db = Dv*lapB + A*B*B - (K+F)*B; Du=0.16, Dv=0.08, dt=1.
- Mind: genomes [F, K]; fitness = field variance + entropy proxy + bonus if recent seeds grew patterns.
- Pointer: adds B=1 in radius ~5 at click pos (normalized to grid).
- Evolution ~0.5 Hz; morph = clamp(fitness) → hue-rotate, contrast, blur on body.
- Seal: truncated hash of best [F,K] + fitness + timestamp → IndexedDB.

## Failure modes
Worker blocked → static params; low-end → smaller grid 32x32; RD may die out (reseed periodically or clamp); canvas size mismatch handled by scaling.

## Building block for future
True WebGPU compute RD with multi-param spatial fields; WebXR hand-seeded volumes; multi-mind competition on different regions; sealed genome breeding; local tiny model predicting next pattern class.

## V01D landing
Spatial stage skill (`skills/mini/evolving-rd-mind.js`); testable via `tools/evolving-rd-mind.test.mjs` for param→pattern variance and seed→fitness.
