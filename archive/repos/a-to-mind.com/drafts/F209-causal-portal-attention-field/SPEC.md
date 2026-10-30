# F-209 Causal Portal Attention Field

**Novel combination:** Tiny local causal attention mechanism (over a sliding window of DeviceOrientation + pointer history) that predicts next sensor state and uses residual error to spawn/strength dynamic "portals" (attractors/repulsors) in a particle field. Portals are temporary spatial structures whose lifetime and force scale with attention residual. Particles cluster into portals; portal stability (low residual, high density) morphs the surrounding DOM UI (scale, hue, blur via CSS vars). Attention weights lightly evolve based on portal occupancy fitness and can be sealed to IndexedDB. Hybrid embodiment: Canvas2D field + floating DOM portal markers.

**Branches away from:** pure evolutionary competition (F208), residual predictors alone, attention lattices without portals, sequence transformers, NCA, softbody clusters, pure orientation MLPs.

**Architecture:** single index.html; Canvas2D particle simulation (WebGPU compute path noted for next); short-history attention kernel in main thread (no worker needed for tiny size); DeviceOrientation + pointer as causal inputs; IndexedDB for sealed weights; no external deps; offline-capable.

**Expected:** living field where tilting the device or moving the pointer seeds attention history; residual errors open glowing portals that suck particles in; stable portals cause the page chrome to morph (hue shift, soft scale); best attention configs persist across reloads.

**Failure modes:** no DeviceOrientation (desktop runs with pointer + synthetic tilt); IndexedDB blocked (seal fails gracefully); high particle count on low-end (auto-reduce).

**Building blocks:** residual-driven spatial portals, causal attention over sensor history, hybrid canvas+DOM portal embodiments, sealed local attention weights. Next: WebGPU compute for portal force field + true multi-tab BroadcastChannel or WebRTC sharing of sealed weights.
