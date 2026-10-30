# F-022 WebGPU Fluid Mind Morph

## Concept
Novel combination for The Void canvas: a WebGPU compute-shader driven 2D particle-fluid field (velocity advection + simple pressure-like damping) representing the empty potential of the void, where user pointer and DeviceOrientationEvent inject forces. A local Web Worker periodically samples field statistics (mean velocity, divergence proxy, cluster density) and runs a lightweight rule-based "assimilation mind" that classifies the dominant regime (swirl, stream, pulse, chaos) and proposes a parameter bias (e.g., viscosity, attraction). The main thread applies this bias to the simulation and morphs the surrounding UI (canvas border radius/thickness/hue, floating mind-card scale/rotation/position, page background gradient) so the interface physically responds to the field's emergent state. Sealing captures a hashed snapshot of the current regime + stats into IndexedDB for local persistent memory; on next load the last seal can lightly bias initial conditions.

This is not a superficial variation of F-020 (discrete WebGPU agents with FSM) or F-021 (orientation + density worker + morphing, or reaction-diffusion + pattern classifier). It shifts to continuous fluid dynamics + temporal regime classification that closes a feedback loop into simulation parameters + UI morphing driven by that loop, plus sealed local memory of regimes. Expands the frontier by making the mind an active controller of the substrate rather than a passive observer.

## Architecture
- Single self-contained HTML/CSS/JS (Worker via blob).
- WebGPU compute pass updates particle positions/velocities; render pass draws as points or short trails. Fallback to Canvas2D particle loop if no GPU.
- Every ~15 frames, main thread computes coarse stats and posts to Worker.
- Worker returns {regime, confidence, bias: {viscosity, attract}}.
- Main applies bias and sets CSS custom properties / transforms.
- Seal button: SHA-256 of regime+stats+ts written to IndexedDB "void-fluid-seals".
- Optional: last seal biases initial particle velocities on reload.
- No external dependencies, no network, no ML models.

## Expected outcome
An interactive spatial fluid canvas that "thinks" about its own dynamics, adjusts its own parameters, and warps the page chrome in response. User tilting or dragging seeds structures; sealing builds a local ledger of assimilated regimes. Runnable in modern browsers with WebGPU (Chrome/Edge); graceful 2D fallback elsewhere.

## Mechanics
- Particles: ~1024, velocity from user force + neighbor attraction (simple) + damping.
- Orientation: beta/gamma map to gravity vector.
- Mind updates ~2 Hz.
- Morph: border-radius 8–48px, hue shift, card rotate ±15deg, scale 0.9–1.15.
- Clear resets particles; Seal stores; list of recent seals shown.
- Fallback note if no WebGPU.

## Failure modes
- WebGPU unavailable / adapter lost → Canvas2D fallback with note.
- Orientation permission denied → pointer + optional keyboard gravity.
- High particle count on low-end → auto-reduce to 512 or lower step rate.
- IndexedDB blocked → in-memory seals only.
- Worker blob blocked by CSP → inline fallback classification.

This prototype is a building block: future runs can add WebXR viewing of the fluid, evolutionary search over bias parameters rewarded by regime confidence, or feeding sealed hashes as initial seeds into larger Void tile systems.
