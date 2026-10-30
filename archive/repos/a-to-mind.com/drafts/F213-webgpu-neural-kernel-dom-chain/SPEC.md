# F-213 WebGPU Neural Kernel DOM Chain

**Novel combination:** A WebGPU compute shader implements a tiny multi-agent MLP kernel (weights in storage buffer) whose inputs are relative neighbor vectors + DeviceOrientation (beta/gamma) as global causal gravity. Kernel outputs target offsets that drive a pure DOM chain of linked cards (absolutely positioned divs with CSS transitions). No canvas particles, no residual attention portals, no main-thread MLP loop, no spectral residual. Multi-agent competition: fitness = chain coherence + energy capture; weakest genome mutated. Leader sealed to IndexedDB + BroadcastChannel.

**Branches away from:** the recent cluster of orientation-MLP/RNN on main-thread or canvas particle fields, WebXR hand DOM curators, causal portal attention, compression-oracle particle worlds, sequence transformers, and softbody swarms (F205–F212). Explicitly moves the neural kernel onto WebGPU compute while keeping pure hybrid DOM embodiment.

**Architecture:** single self-contained index.html; WebGPU compute pipeline (WGSL MLP kernel); DeviceOrientation + pointer as causal inputs; CSS-transformed DOM cards; IndexedDB seal; BroadcastChannel transfer; Canvas2D-free; offline-capable, no external deps. Progressive fallback to JS kernel if no WebGPU.

**Expected:** living chain of DOM cards that undulate and reconfigure under GPU neural policy driven by device tilt and pointer. Competition visible as hue/fitness labels. Seal persists and shares leader across tabs.

**Failure modes:** no WebGPU (JS fallback works); no DeviceOrientation (pointer + zero tilt); IndexedDB blocked (in-memory only); low-end (4–6 agents fine).

**Building blocks:** WebGPU compute as neural policy kernel for pure DOM physical embodiments, orientation-as-causal-gravity into GPU kernel, sealed genome transfer for multi-agent DOM chain. Next: true WebXR hand poses as additional kernel inputs or WebRTC DataChannel for cross-device genome sync.

V01D landing: spatial DOM chain skill under void-live-deploy/skills/; testable by fitness under simulated tilt and genome round-trip via BroadcastChannel.
