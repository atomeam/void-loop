# F-031 Resonant Spatial Attention Graph Mind

## Concept
Spatial graph of 42 nodes (positions, velocities, energy, phase, feature vectors) whose pairwise interactions are governed by a local Transformer-style multi-dimensional self-attention mechanism. Attention scores (evolved parameters for Q/K/V scales, temperature, force gain, damping) drive edge rendering, node forces (attraction along high-attention pairs), and continuous morphing of surrounding UI chrome (HUD position tracks attention focus centroid, hue/scale/blur/filter respond to focus, entropy, coherence). A Web Worker evolutionary population adapts the attention parameters under fitness for focus strength, moderate entropy, interaction density, and coherence. Pointer injects energy to nearby nodes; optional DeviceOrientationEvent biases phase. Web Audio generates resonant drones whose frequencies track focus/coherence/entropy. Seal hashes current attention parameters into IndexedDB.

## Architecture
Single self-contained HTML. Worker via Blob URL holds evolutionary population of 6 attention parameter sets, receives global attention statistics, returns best. Main thread steps graph dynamics at ~60 Hz (O(N²) attention acceptable for N=42), draws edges/nodes, applies CSS custom properties and filter, and sonifies. Not a superficial variation of prior frontier experiments (F-020 discrete agents/FSM, F-021 density/orientation, F-022 fluid regimes, F-023 rule evolution, F-024 volumetric, F-025 boids RL, F-026 trajectory/spatial graph, F-027 spectral phase, F-028 competitive, F-029 lattice attention, F-030 trajectory memory field). Here the mind *is* the evolving self-attention parameters that both structure the graph topology/forces and drive the morphing interface; learning is online evolutionary search over the attention mechanism on a continuous spatial graph substrate.

## Expected outcome
Interactive spatial attention graph that discovers coherent focusing behaviors, warps the page by tracking its own attention focus, and generates living resonant audio. Sealed attention genomes form local memory of successful policies. Runnable with graceful fallbacks (Worker blocked → static params; audio until user gesture; orientation ignored if unavailable; low-end may reduce N).

## Mechanics
42 nodes with 3D feature vectors; attention = softmax(Q·K / temp - spatial dist); forces from attention-weighted directions; mind ~5 Hz; morph driven by focus/entropy/coherence 0–1; seal SHA-256 truncated + IndexedDB.

## Failure modes
CSP blocks blob Worker → fixed attention params; audio requires user gesture; low-end may drop N or drop frames on dense edges; orientation needs HTTPS + permission; O(N²) may lag on very old devices.

## Building block
True WebGPU compute attention graph with spatial hash / sparse attention, WebXR gaze as query injection, multi-head competing minds, sealed attention genomes bred across sessions, spectral analysis of attention matrix for richer sonification.

## Lands in V01D
Spatial stage skill (`skills/mini/attention-graph-mind.js`); testable via `tools/attention-graph-mind.test.mjs` for fitness→morph and attention-params→focus/coherence mapping.
