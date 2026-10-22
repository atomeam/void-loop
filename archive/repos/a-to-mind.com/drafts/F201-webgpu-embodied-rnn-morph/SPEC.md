# F-201 WebGPU Embodied RNN Morph Interface

## Concept
Local recurrent mind (simple tanh RNN) integrates pointer, orientation, and sensory feedback from CSS-embodied limbs. Hidden state drives particle field dynamics, limb morphology (length/angle), and global chrome morph (hue/energy/scale). Closed-loop interaction: touching limbs feeds the mind.

## Architecture
- Single self-contained `index.html`
- Canvas2D particle substrate (WebGPU path reserved)
- Pure JS RNN (hidden dim 4)
- 6 absolute-positioned DOM limbs
- CSS custom properties for morph
- IndexedDB seal of hidden state
- Optional DeviceOrientationEvent

## Expected Outcome
Interactive spatial embodiment: limbs grow and move with the mind's state; user touch reinforces sensory input; particles respond; page chrome breathes. Offline runnable with graceful fallbacks.

## Mechanics
Input → RNN step → hidden → limb CSS + particle attraction + CSS vars. Sensory from pointer events on limbs.

## Failure Modes
Orientation denied → zero bias; low-end → fewer particles; IDB unavailable → seal alert only.

## Building Block
Recurrent controller + bidirectional DOM embodiment. Next: WebGPU particles + Worker RNN + WebXR.

Lands in V01D as spatial embodied skill.
