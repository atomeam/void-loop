# F190-webgpu-causal-memory-field-orbs

## Concept
Novel combination: A WebGPU compute-driven causal memory field (pointer trajectories deposit decaying energy into a 2D grid that diffuses on the GPU), a local Web Worker that runs a residual velocity predictor + parameter evolution on field samples to adapt diffusion/decay/attraction, and morphing spatial DOM orbs whose transforms, scale, and filters are driven by local field queries and the worker's predicted intent vector. Device orientation injects a tilt bias into the field. Page chrome (background filter, status) morphs with global energy and residual confidence.

Not a variation of F-020 (FSM agents), F-021 (orientation density morph), F-182 (spectral NCA), or F-186 (trajectory attention echoes). The causal field is the primary spatial memory; the worker is a predictive adapter; the orbs are embodied field probes that physically respond.

## Architecture
- Single self-contained HTML: WebGPU compute for field update (fallback Canvas2D diffusion), Web Worker for predictor/evolution, absolute DOM orbs, CSS filter morph.
- Pointer history deposits into field; orientation tilts diffusion bias.
- Worker receives energy samples + velocity history every ~100ms, outputs adapted params and a predicted next position.
- Orbs lerp toward high-energy loci or predicted point; scale/opacity/hue from local energy and residual.
- localStorage seals best parameters.

## Expected outcome
Runnable offline interactive spatial field that remembers recent paths as glowing causal traces, anticipates gesture via local prediction, and manifests that memory as floating morphing orbs that move and glow with the field. WebGPU primary path; graceful CPU fallback. Persistent adaptation across reloads.

## Mechanics
- Field: GPU (or CPU) grid, source term at pointer, Laplacian diffusion + exponential decay, orientation bias.
- Worker: simple exponential smoothing residual predictor + hill-climbing on fitness (low residual + coherent energy).
- Orbs: 6 divs, positions updated via transform, styles from field sample + residual.
- Morph: documentElement CSS vars for hue-rotate, contrast, and a status pill.

## Failure modes
No WebGPU → Canvas2D fallback (slower but functional). Orientation denied → pointer-only. Worker blocked → static params. High resolution → downsampled grid.

## Building blocks
Causal spatial memory field, local predictive parameter adaptation, embodied DOM orbs as field probes, hybrid GPU/DOM spatial UI. Next experiments can immerse the same field in WebXR or evolve the worker kernel itself.
