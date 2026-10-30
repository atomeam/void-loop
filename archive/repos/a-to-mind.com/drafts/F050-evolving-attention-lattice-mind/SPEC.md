# F-050: Evolving Local Attention Lattice with Emergent Portals and Morphing Spatial Chrome

## Concept
Novel combination of a spatial attention lattice whose parameters are evolved by a local Web Worker, emergent interactive DOM portals at high-attention loci, and a surrounding UI chrome that physically morphs (CSS filters, scale, perspective, hue) in response to the attention field's entropy and peak activation. Pointer interaction and optional DeviceOrientationEvent provide the fitness signal. Builds on prior spatial and agent work without repeating fixed boids, NCA rules, or pure wavefields — the novel core is the evolving attention mechanism that co-generates both the visual field and the responsive interface geometry.

## Architecture
- Self-contained `index.html` (no external deps).
- Main thread owns the lattice (32×32), computes simplified local attention scores from evolved weights, renders heatmap + agents on Canvas2D, spawns/manages portal DOM nodes, and writes CSS custom properties that drive chrome morph.
- Blob Worker runs a small evolutionary strategy (population of weight vectors) evaluating fitness from recent pointer dwell + field coherence; posts best weights back ~every 2 s.
- Graceful degradation: missing Worker → static random weights; orientation unavailable → pointer-only; WebGPU compute path left as documented upgrade.

## Expected outcome
Interactive lattice that concentrates attention near the pointer or device tilt, portals that appear and can be clicked to reinforce or perturb, and a page whose background, HUD, and overall perspective warp and recolor with the mind's learning progress. Sealed genomes persist locally via IndexedDB. Fully runnable offline in any modern browser.

## Mechanics
- Each cell holds a small feature vector; attention is a local dot-product score modulated by evolved weight matrix (reduced to a few scalar gains for the prototype).
- Portals spawn when a cell's score exceeds a dynamic threshold and local density is high; click injects a temporary bias into nearby weights.
- Fitness accumulates pointer proximity (higher near cursor) plus a coherence term (low spatial entropy of the attention map).
- Morph mapping: field entropy → backdrop-filter blur and scale; peak attention → hue-rotate and rotateX/Y on the container.
- Seal button hashes the current best weights + fitness and stores in IndexedDB.

## Failure modes
- Strict CSP may block blob: Worker URLs — falls back to fixed weights.
- Low-end devices: reduce grid or sampling rate automatically.
- Orientation requires secure context + user gesture/permission.
- Portals may accumulate; capped at a small number with auto-fade.

## Building block for future
True WebGPU compute shaders for the attention matrix, WebXR controllers as spatial attention injectors, multi-head attention stacks, or transfer of sealed genomes into larger local transformer-like minds on the Void canvas.
