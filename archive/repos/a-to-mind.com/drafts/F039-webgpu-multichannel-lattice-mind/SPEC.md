# F-039: Multi-Channel WebGPU Lattice Mind with Embodied Spatial Cards

## Concept
Novel combination: A multi-channel continuous lattice (activator / inhibitor / catalyst) stepped by a WebGPU compute shader (Canvas2D multi-buffer fallback). A local Web Worker evolutionary mind searches the reaction parameter space for fitness that rewards multi-channel complexity (channel-wise variance + cross-channel mutual information proxy), persistent structures, and responsiveness to a small population of embodied DOM "cards". The cards float in CSS 3D space, sample regional multi-channel statistics to drive their position/scale/hue/blur, and inject channel-specific energy when dragged. Global field metrics morph the surrounding Void chrome. Pointer and optional DeviceOrientationEvent seed additional energy or bias. Web Audio drones track channel means. Seal hashes best genome + metrics into IndexedDB.

Not a superficial variation of prior F-series (discrete agents, pure RD/fluid/evo lattices, boids, spectral oscillators, attention graphs, single-channel NCA, living cards on Canvas2D): here the substrate is a true multi-channel GPU lattice, the cards are first-class embodied agents that co-evolve with the field (sensing multi-channel regions and acting by injection), and the mind optimizes cross-channel structure rather than single-field entropy.

## Architecture
Single self-contained `index.html`. 
- WebGPU path: compute shader for Gray-Scott-like multi-channel update on storage textures / buffers; render pass to canvas.
- Fallback: JS stepped Float32Arrays + Canvas2D.
- Blob Worker holds population of parameter genomes (reaction rates, diffusion coeffs, injection strengths), receives reduced multi-channel metrics + card positions ~0.5 Hz, evaluates fitness, mutates, returns best.
- Main samples regional stats via readback or canvas getImageData, positions 4–5 absolute cards with CSS 3D transforms, applies global morph, sonifies.
Graceful: no WebGPU → Canvas2D; no Worker → fixed params; audio after gesture; orientation ignored if denied.

## Expected outcome
Interactive multi-channel living field that discovers structures spanning channels, embodied cards that drift and recolor according to local multi-channel activity while sculpting the lattice by drag, page chrome that warps with collective complexity, and generative audio. Sealed genomes form local memory of successful multi-channel rules. Runnable with full fallbacks.

## Mechanics
- Grid: 128×128 (WebGPU) or 64×40 (fallback), 3 channels ∈ [0,1]
- Rule: multi-species reaction-diffusion (diffusion + nonlinear reaction terms evolved)
- Cards: 5 DOM nodes; regional channel means → translateZ / scale / hue / filter
- Mind/evolution ~0.5 Hz; drag injects channel energy + fitness bonus for co-location response
- Morph: channel variance / cross-correlation → CSS hue, blur, contrast, perspective
- Seal: SHA-256 truncated of genome + metrics + IndexedDB

## Failure modes
WebGPU unavailable or compute not supported → Canvas2D; CSP blocks blob Worker → static params; readback expensive on low-end → reduced sample rate; audio blocked until gesture; orientation requires HTTPS + permission; cards may clip on small viewports.

## Building block for future
WebXR where cards and lattice are head-tracked 3D volumes, true sparse multi-channel NCA on GPU, sealed genome breeding that transfers multi-channel policies, local tiny MLP as the reaction function itself.

## V01D landing
Spatial stage skill (`skills/mini/webgpu-multichannel-lattice.js`); testable via `tools/webgpu-multichannel-lattice.test.mjs` for regional multi-channel sample → card-transform mapping and genome → cross-channel complexity.
