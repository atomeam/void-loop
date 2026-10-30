# F-195: WebGPU Attention Swarm Mind with Morphing Spatial Chrome

## Concept
Novel combination: WebGPU compute shader drives a swarm of GPU particles whose positions and velocities are updated on the GPU. A local Web Worker samples particle states (reduced via readback or approximation) and runs a small multi-head attention "mind" (matrix multiplies on sampled agents) to compute emergent thought vectors. These thoughts continuously morph the surrounding CSS chrome (perspective, filter, hue, scale, rotate) of the page, modulate Web Audio synthesis (oscillator frequencies and gains driven by attention outputs), and feed parameters back into the WebGPU field (attraction strength, noise). DeviceOrientationEvent and pointer provide spatial bias. Seal persists the attention weight matrices to IndexedDB.

Branches from prior work: not a simple lattice, boids, NCA, probe DOM swarm, or gaze-RNN. The core is GPU-resident agents whose inter-agent attention is computed off-GPU in a worker, with the attention residuals physically distorting the browser UI chrome and generating audio.

## Architecture
Single self-contained `index.html`.
- Main: WebGPU device, compute pipeline for particle update (storage buffers for pos/vel), canvas render (or points), CSS morph application, AudioContext.
- Worker (blob): maintains attention weight matrices (fixed or lightly evolved), receives sampled particle features every ~200ms, computes attention scores, returns thought vector + updated params.
- Fallbacks: no WebGPU → Canvas2D particle fallback; no Worker → fixed attention; orientation denied → pointer only; audio after user gesture.

## Expected outcome
Interactive GPU swarm that forms clusters under pointer/orientation influence; the page chrome warps and recolors in real time according to the local attention mind; generative tones pulse with swarm coherence; sealed weights allow continuity. Runnable in modern Chromium-based browsers with WebGPU.

## Mechanics
- Particles: 1024 GPU agents, simple flocking + noise + pointer attraction in compute shader.
- Attention mind: sample 16 agents, 4-head attention over features (pos, vel, energy), produce 8-dim thought vector.
- Morph: thought dims map to CSS custom properties (hue-rotate, contrast, blur, perspective, rotateX/Y).
- Audio: 3 oscillators, frequencies from thought, panned by swarm centroid.
- Seal: store weight hashes + fitness in IndexedDB.

## Failure modes
WebGPU unsupported → 2D canvas fallback; readback latency on some devices; Worker blocked by CSP; audio autoplay policy; orientation permission.

## Building block for future
True WebGPU attention kernels, multi-mind competition across tabs, WebXR gaze as additional input channel, sealed weight transfer.

## V01D landing
Spatial GPU skill under `void-live-deploy/skills/`; testable via particle count stability and thought→CSS mapping.
