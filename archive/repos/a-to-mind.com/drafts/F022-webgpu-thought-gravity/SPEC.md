# F-022: WebGPU Thought Gravity Wells

## Concept
Novel combination of local AI reasoning (Worker-based hash-embedding + evolutionary attractors), GPU/Canvas particle flow representing association streams, and physically morphing DOM portals + page chrome that respond to the field's coherence and entropy.

Not a superficial variation of F-020 (static agents), F-021 (orientation + density), or F-038 (living cards on RD field).

## Architecture
- Single self-contained `index.html`
- Blob Web Worker for "mind": seeds phrases → 2D attractors (simple vector hash + repulsion), evolves strengths
- Canvas2D particle simulation (WebGPU compute path noted as next block; fallback immediate)
- Floating DOM thought portals pinned to attractor centroids; size/opacity from strength
- Global CSS variables driven by particle variance / entropy for chrome morph
- Seal button stores wells to IndexedDB

## Expected outcome
Typing a thought births a gravity well. Particles stream toward it. Portals float and grow. Chrome hue/intensity shifts with field order. Feels like a spatial mind canvas.

## Mechanics
1. User types phrase → post to Worker → returns attractor {x, y, strength, id}
2. Main loop: particles integrate forces from all wells + noise
3. Sync portals to well positions (CSS transform)
4. Compute entropy → set --entropy, --coherence on :root
5. Seal: JSON of wells + timestamp to IndexedDB

## Failure modes
- No WebGPU / low-end: Canvas2D path (always available)
- Worker blocked by CSP: falls back to main-thread evolution
- Orientation/permission not required
- Small viewports: portals may overlap (mitigated by repulsion)

## Building block for future
True WebGPU compute multi-channel wells, WebXR head-tracked gravity, local embedding model (Transformers.js) replacing hash, multi-agent minds competing for wells.

## V01D landing
Spatial stage skill: `void-live-deploy/skills/mini/thought-gravity.js`
Test: `tools/thought-gravity.test.mjs` asserts well position → portal transform mapping and entropy → CSS var.
