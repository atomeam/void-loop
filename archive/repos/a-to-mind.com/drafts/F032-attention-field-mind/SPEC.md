# F-032: Local Attention Field Mind

## Concept
A continuous spatial field of token-particles on Canvas2D whose inter-particle forces are computed by a local Web Worker implementing simplified multi-head attention over particle embeddings (position + velocity + local density). Attention weights drive attractive/repulsive forces, producing emergent clusters and streams. Global attention entropy, head diversity, and cluster count morph the surrounding Void UI chrome (hue, blur, scale, CSS filters, HUD transforms) and drive a Web Audio spectrum synthesizer. Pointer injects a persistent query particle that biases attention; optional DeviceOrientationEvent supplies a spatial embedding bias. Seal hashes current attention params + morph into IndexedDB.

Not a superficial variation of prior frontier work:
- F-020: discrete FSM agents
- F-021: reaction-diffusion / orientation density
- F-022: fluid simulation with fixed params
- F-023: evolutionary lattice rules
- F-024: volumetric noise + evo controller
- F-025: boids with evolutionary param mind
- F-026–F-031: graph rewiring, spectral phase, competitive minds, spatial attention lattice, trajectory memory, resonant attention graph

Here the mind is the attention computation itself acting as the force law on a continuous particle field; selection is implicit in the dynamics rather than an outer evolutionary loop.

## Architecture
Single self-contained `index.html`. Blob Worker maintains particle state (N≈180), runs simplified attention (2 heads, low-dim embeddings) at ~20 Hz, returns positions + high-attention edges + metrics. Main thread renders particles + edges, applies CSS custom properties for morph, generates audio from attention spectrum. Graceful fallbacks: no Worker → fixed spring forces; no WebGPU (noted only); audio after gesture; orientation ignored if denied.

## Expected outcome
Interactive spatial attention field that forms and dissolves clusters in response to pointer and orientation, warps the page according to attention entropy, and produces a generative drone whose partials track the attention spectrum. Sealed snapshots form local memory of interesting states.

## Mechanics
- 180 particles, embeddings 6D (pos, vel, density)
- Attention: scaled dot-product, 2 heads, temperature evolved lightly by entropy
- Morph 0–1 maps entropy → hue-rotate, filter, transform
- Seal: SHA-256 of params + metrics, truncated, IndexedDB

## Failure modes
CSP blocks blob Worker → static forces; audio blocked until user gesture; low-end drops N; orientation requires HTTPS + permission; high N may drop frames.

## Building block
True WebGPU compute attention for larger N, multi-layer residual attention, WebXR head-tracked query, sealed attention trajectories as training data for next mind.

## Lands in V01D
Spatial stage skill (`skills/mini/attention-field-mind.js`); testable via `tools/attention-field.test.mjs` for entropy→morph mapping and seal integrity.
