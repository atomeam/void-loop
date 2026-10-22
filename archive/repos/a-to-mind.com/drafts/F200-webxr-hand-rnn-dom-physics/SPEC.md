# F200-webxr-hand-rnn-dom-physics

**Concept:** True WebXR hand tracking supplies joint velocities as causal input to a local pure-JS tiny RNN. The RNN outputs force multipliers and mode (attract/repel/damp) that drive a spring-mass particle system. Each particle has a hybrid DOM embodiment (positioned div with content). Physics runs in WebGPU compute shader when available, else Canvas2D. RNN weights ("genome") seal to IndexedDB. Progressive: flat mouse/touch + DeviceOrientation fallback fully interactive without XR.

**Branches away from:** recent WebGPU attention/particle/embedding lattices, residual predictors, pure NCA, spectral residuals, pointer-history fields (F196–F199 cluster).

**Axes used:** true WebXR hand, local tiny model controlling physical UI elements, hybrid DOM+canvas, WebGPU physics kernel, persistent IndexedDB sealed genome, DeviceOrientation causal input.

**Runnable:** single index.html, offline-capable after first load, no external deps.

**Failure modes:** no WebXR (flat mode), no WebGPU (Canvas2D), no Worker needed (inline), orientation permission prompt, hand tracking unavailable on some devices.
