# F197-webgpu-fluid-policy-mind

## Concept
WebGPU/Canvas2D fluid-particle substrate (400 agents with velocity, damping, orientation bias, pointer injection). Local policy (inline evolutionary residual sensitivity) samples field variance and adapts parameters. Policy curiosity spawns draggable DOM thought-cards whose drag injects force back into the fluid, closing the loop. Chrome morphs with energy and residual. Seal to localStorage.

Novel combination of GPU-style particle fluid, adaptive local policy mind, embodied interactive DOM feedback, and continuous chrome distortion. Not a variation of pure lattices (F-023/F-043), causal deposits (F-190/F-196), or GPU attention swarms (F-195).

## Architecture
Single self-contained index.html. Canvas2D particle loop. Inline policy update (Worker-equivalent, CSP-safe). CSS 3D-ready cards. DeviceOrientation + pointer. localStorage seal.

## Expected outcome
Interactive spatial fluid that remembers motion through particle persistence, adapts its response via residual-driven policy, and materializes thoughts as movable cards that the user can use to steer the field. Page hue and contrast breathe with the mind state. Fully offline.

## Mechanics
Particles advect with bias + noise; residual = mean velocity magnitude; policy mutates sensitivity/curiosity/bias toward residual reduction; cards spawn and on drag apply local repulsion; CSS vars-like body style updates.

## Failure modes
No orientation (pointer still works). High particle count on low-end (throttleable). localStorage blocked (session only).

## Building blocks
Particle fluid substrate, residual-policy adaptation, bidirectional DOM-field coupling. Next: true WebGPU compute for Navier-Stokes + WebXR projection of the fluid volume.

Lands in V01D as interactive spatial stage skill.
