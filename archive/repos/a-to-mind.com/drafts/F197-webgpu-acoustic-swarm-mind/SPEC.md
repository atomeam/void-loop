# F197 — WebGPU Acoustic Swarm Mind

**Frontier ID:** F-197  
**Slug:** F197-webgpu-acoustic-swarm-mind  
**Date:** 2026-10-21  
**Series:** Frontier Engine (not a ledger run number)

## Concept
WebGPU compute particle swarm whose per-agent forces are biased in real time by microphone spectral energy and device orientation. A Web Worker evolves a lightweight policy on swarm statistics (energy, entropy, centroid) to modulate global parameters. Cluster centroids position generative DOM thought nodes; page chrome morphs via CSS variables driven by energy + residual. Progressive WebXR. Not a variation of F-020 (FSM agents), F-025 (boids RL), F-182 (spectral NCA bias), or F-196 (causal deposit lattice): the substrate is pure GPU agents with sensor-injected forces + Worker-evolved control + generative text embodiment.

## Architecture
- Single `index.html` (self-contained).
- WebGPU compute shader for swarm update (positions, velocities, local energy).
- AnalyserNode → spectral centroid/energy uniforms.
- DeviceOrientation → tilt vector as wind.
- Blob Worker: evolutionary strategy (pop of simple genomes) on readback stats; returns best params.
- Floating DOM nodes: positioned by cluster samples, content from entropy-biased lexicon.
- CSS custom properties morph hue, blur, scale.
- localStorage seal of last genome + seed.
- Fallback: Canvas2D particle sim if no WebGPU.

## Expected outcome
Interactive spatial swarm that reacts to sound and device tilt, evolves its own dynamics, manifests local “thought” as moving generative cards, and morphs the page. Runnable offline. XR entry when supported.

## Mechanics
1. Mic FFT → energy + spectral peak → attractor force uniform.
2. Orientation beta/gamma → wind vector in compute.
3. Periodic readback → Worker evolves force scales / cohesion.
4. Clusters → DOM nodes with generated phrases.
5. Stats → CSS vars (energy→hue, residual→blur).

## Failure modes
- No WebGPU → Canvas2D fallback (noted in UI).
- Mic/orientation denied → zero-force or mouse-only.
- Low performance → fewer particles.
- CSP / secure context required for sensors.

## Building blocks for next
WebGPU compute swarm + sensor force injection + Worker policy evolution + generative DOM embodiment. Next: full XR projection of the swarm or multi-kernel NCA overlay.

## V01D landing
Spatial sensor-swarm skill under `void-live-deploy/skills/` or tools/. Test: energy→CSS stability and node generation accuracy under tilt/sound.
