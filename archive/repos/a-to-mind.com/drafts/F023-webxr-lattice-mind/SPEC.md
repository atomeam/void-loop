# F-023 WebXR Lattice Mind Assimilation

## Concept
Novel combination for The Void canvas: a spatial lattice of cells whose growth and density are driven by local Worker-based AI reasoning (simple evolutionary attractor selection on a grid), visualized via Canvas2D (WebGPU compute path noted), influenced by pointer, DeviceOrientation, and WebXR controller/hand pose when available. The surrounding UI consists of physical floating assimilation cards whose CSS transforms (position, scale, rotation, hue) respond in real time to the lattice's emergent density clusters and the AI's confidence. Sealing hashes the current lattice state + spatial input into IndexedDB local memory.

This is not a superficial variation of:
- F-020 (discrete particle agents + FSM entropy morph)
- F-021 (orientation + density worker or reaction-diffusion pattern classifier)
- F-022 (fluid feedback loop or thought-gravity portals)

It introduces a discrete lattice substrate + evolutionary local mind + optional WebXR spatial input that closes into physical multi-card DOM assimilation, expanding the frontier toward immersive spatial AI interfaces.

## Architecture
- Single self-contained HTML/CSS/JS (Worker via blob URL).
- Canvas2D renders a 32×32 lattice with density heat (color by cell value).
- Main thread injects seeds from pointer, orientation tilt, or WebXR pose (if session granted).
- Every ~20 frames, reduced stats (cluster count, mean density, variance) posted to Worker.
- Worker evolves a simple population of "rules" (attraction radii, growth rates) and returns best {clusters, confidence, bias}.
- Main applies bias to lattice update and sets CSS custom properties + absolute transforms on 4–6 floating cards.
- Seal button: SHA-256 of (stats + bias + ts) to IndexedDB store "void-lattice-seals".
- WebXR: button to request immersive-ar or immersive-vr session; controller pose maps to lattice seed position. Fallback if unsupported.
- No external dependencies, no network, no large models.

## Expected outcome
Interactive spatial lattice that grows organic clusters under user spatial input; local mind classifies and biases growth; floating cards physically rearrange and morph in response, creating a living Void canvas. Seals build a local ledger of assimilated spatial states. Runnable in modern browsers; XR optional and progressive.

## Mechanics
- Lattice cells: density 0–1, growth toward neighbors above threshold, decay.
- Pointer drag or click seeds high density.
- Orientation: beta/gamma tilt biases growth direction.
- XR: if available, controller ray or pose seeds at projected point.
- Mind updates ~2–3 Hz; cards lerp to cluster centroids scaled by confidence.
- Clear resets lattice; Seal stores and shows recent list.
- Fallback note if no WebXR / orientation denied.

## Failure modes
- WebXR unavailable or permission denied → pointer + orientation path.
- Orientation denied → pointer only.
- High grid on low-end → reduce to 16×16 or lower update rate.
- IndexedDB blocked → in-memory seals.
- Worker CSP blocked → main-thread fallback classifier.
- XR session ends abruptly → resume 2D.

## Building block
Future experiments can feed sealed lattices as initial conditions, add true WebGPU 3D volume raymarch of the lattice, local tiny neural net in WebGPU for rule evolution, or multi-user shared XR sessions.

## V01D landing
Spatial stage skill under void-live-deploy/skills/lattice-mind.js; test asserts cluster centroid → card transform and seal hash integrity.
