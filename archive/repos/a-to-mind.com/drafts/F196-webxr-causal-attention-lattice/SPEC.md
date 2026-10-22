# F-196 WebXR Causal Attention Lattice

## Concept
Novel combination: Canvas2D (WebGPU compute path noted for next) causal energy lattice that receives pointer / XR-ray deposits. Local Web Worker samples the field and runs residual velocity prediction + multi-sample attention to produce a continuous thought vector. Thought and residual continuously morph page chrome via CSS custom properties (hue, contrast, filter, scale of probes) and drive floating DOM orbs that query local energy. Optional WebXR session for immersive entry; field remains interactive in flat mode.

Not a superficial variation of F-020 (FSM agents), F-021 (orientation density), F-190 (causal memory orbs), or F-195 (GPU attention swarm): the substrate is a diffusing causal deposit field whose residual prediction error and attention-weighted samples become the physical control signal for both DOM embodiment and chrome distortion, with progressive WebXR.

## Architecture
- Single `index.html`
- Main thread: grid diffusion/decay + deposit, ImageData render, orb positioning
- Blob Worker: residual predictor + crude attention over 16 random samples → thought/residual
- CSS vars driven live; localStorage seal of mind state
- Progressive XR button (session request; full layer integration future)

## Expected outcome
Interactive spatial field that remembers recent paths as glowing traces, anticipates gesture via residual, and manifests local mind state as morphing chrome and floating probes. Runnable offline. XR entry when supported.

## Mechanics
deposit → diffusion/decay; worker residual + attention; orbs lerp by energy + mind; CSS vars map thought/residual/energy.

## Failure modes
No Worker (static params), XR unsupported (flat ok), low GPU (Canvas2D fine).

## Building blocks
Causal spatial deposit, residual-attention mind, embodied DOM probes, progressive WebXR. Next: WebGPU compute kernel for lattice + XR projection layer.
