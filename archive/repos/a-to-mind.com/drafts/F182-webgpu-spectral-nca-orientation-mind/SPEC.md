# F-182 WebGPU Spectral NCA Orientation Mind

Novel combination: WebGPU compute Neural Cellular Automaton / reaction-diffusion lattice whose update is biased by real-time microphone spectral energy and device orientation (beta/gamma). Floating DOM "thought nodes" are positioned and scaled by the field's global energy and orientation tilt. Global CSS hue morphs with energy + gamma.

Not a superficial variation of F-020 (FSM agents), F-021 (orientation density), F-049 (predictive residual swarm), or later spectral/NCA drafts: the mind is the spectral+orientation injection into the GPU NCA rule itself, with embodied DOM nodes as physical proxies of field activation.

Expected outcome: Interactive spatial field that reacts to voice/sound and device tilt, warps its dynamics, moves thought nodes, and morphs page chrome. Runnable with WebGPU; graceful degradation noted.

Mechanics: AnalyserNode → energy uniform; DeviceOrientationEvent → tilt bias in compute shader; nodes driven by energy + time; seal to localStorage.

Failure modes: no WebGPU, mic permission denied, no orientation support (desktop).

Building block: later WebXR view of the same lattice or Worker-evolved NCA kernels.
