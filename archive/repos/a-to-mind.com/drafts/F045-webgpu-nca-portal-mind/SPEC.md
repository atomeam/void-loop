# F-045: WebGPU Compute NCA Portal Mind

**Ledger ID:** F-045  
**Slug:** F045-webgpu-nca-portal-mind  
**Date:** 2026-10-17  
**Status:** Prototype (runnable)

## Concept
Novel combination of a large-scale Neural Cellular Automaton (NCA) updated via WebGPU compute (with Canvas2D fallback), a local Worker evolutionary mind that mutates the shared update-rule genome for pattern complexity, spatial activity portals that materialize at high-energy regions as clickable DOM fragments, and CSS morphing of the Void chrome driven by global field entropy and fitness. Pointer seeds the lattice; orientation (if granted) adds a global bias. Seal persists the best genome.

Not a superficial variation of prior experiments:
- Not F-036 local JS NCA (here compute-scale + portals as feedback)
- Not F-044 implicit vector field or spectral lattice (NCA discrete state evolution with emergent patterns)
- Not F-020 discrete agents or F-025 boids
- Not F-038 living cards (portals are transient activity embodiments, not persistent co-evolving cards)
The mind evolves the rule that generates the spatial field; portals close the loop by letting the user reinforce local regimes.

## Architecture
Single self-contained `index.html`.
- Main thread: initializes WebGPU device if available for compute + render of the NCA grid (~256x256), else Canvas2D particle/cell simulation (~80x60 effective); samples field for entropy proxy and high-activity cells; manages portal DOM; applies CSS morph; handles pointer seeding and optional DeviceOrientation.
- Blob Worker: population of 8 rule genomes (e.g. 12–16 float parameters for neighbor weights, activation, decay), evaluates fitness from reported diversity + pointer activity + moderate energy, mutates, returns best ~1 Hz.
- Fallbacks: no WebGPU → Canvas; no Worker → fixed rules; orientation denied → pointer only; storage blocked → visual seal only.

## Expected outcome
Interactive spatial lattice that grows complex patterns from pointer seeds under evolving rules; page hue/contrast morph with field complexity; floating portals appear at activity hotspots and can be clicked to bias the mind; sealed genomes remember successful NCA policies. Fully offline-runnable.

## Mechanics
- NCA update: each cell state (multi-channel or scalar energy) updated by weighted neighbor sum + nonlinear activation + decay; parameters from genome.
- WebGPU path: compute shader dispatches grid update into storage texture/buffer, render to canvas.
- Portals: spawn when local energy > threshold, max 5, auto-expire 6s; click injects positive fitness bias for current genes.
- Morph: entropy + fitness → hue-rotate, contrast, slight scale.
- Seal: truncated SHA-256 of genome + fitness + timestamp → IndexedDB or localStorage.

## Failure modes
WebGPU unavailable or adapter fail → Canvas fallback; Worker CSP block → static rules; low resolution on small screens reduces pattern richness; portals may overlap.

## Building block for future
Full neural NCA in WGSL with learned perception kernels; WebXR volume rendering of the field; multi-agent minds competing on shared lattice; sealed genome transfer and cross-session resonance.

## V01D landing
Spatial stage skill (`skills/mini/nca-portal-mind.js`); testable via `tools/nca-portal-mind.test.mjs` for genome → rule application and activity → portal spawn mapping.
