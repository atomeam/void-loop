# F173-webgpu-mlp-orientation-physics

## Concept
Novel combination: a local tiny MLP (JS) maps DeviceOrientation (or pointer fallback) + time into force multipliers that drive a WebGPU compute-shader particle physics kernel. Particles experience orientation-derived gravity plus attraction to draggable hybrid DOM orbs. Weights persist via IndexedDB (Seal). This expands the building blocks: true compute-shader physics kernel, local model controlling GPU state, DeviceOrientation as causal input, hybrid DOM+canvas embodiment.

Deliberately branches away from the recent dominant cluster (attention lattices, residual predictors, volumetric injection, pure NCA, spectral/audio residuals, pointer-history fields, and the immediately prior multi-agent genome and pure orientation-MLP UI). Under-explored axes: WebGPU compute shaders for physics, local tiny models that control physical (GPU) elements, DeviceOrientation as causal input, hybrid DOM+canvas.

## Architecture
- Single self-contained index.html
- TinyMLP: 6→8→3 (orientation 3 + pointer 2 + time 1 → force multipliers)
- WebGPU compute pipeline updates N=2048 particles (pos/vel storage buffers) with orientation force + 2 DOM attractors
- Fallback Canvas2D physics if no WebGPU
- IndexedDB persistence of weights; Reward nudges MLP; Seal commits
- Draggable DOM attractors whose screen positions become force centers each frame
- Offline-capable

## Expected outcome
Interactive spatial field where tilting the device (or moving pointer) steers particle flow via the MLP-modulated forces, and dragging the orbs creates local attractors. Rewarding improves the mapping over time; sealed weights survive reloads. Failure modes: no WebGPU → CPU fallback (fewer particles); no DeviceOrientation → pointer; no IndexedDB → in-memory only.

## Mechanics
Tilt / move to drive forces. Drag α/β orbs. Reward current mapping. Seal to persist. Reset particles.

## V01D landing
Spatial/physics stage skill (`skills/mini/webgpu-mlp-physics.js`); testable via MLP forward → uniform write and compute dispatch bounds.
