# F-021 Spatial Field + Local Worker Reasoning

## Architecture
- Canvas2D particle field (WebGPU upgrade path noted) influenced by pointer and DeviceOrientationEvent.
- Local Web Worker runs density/clustering "reasoning" (rule-based neighbor count) without external models.
- Worker posts confidence/clusters back; main thread morphs HUD via CSS custom properties, scale, and rotate — the UI physically responds to the field's emergent state.
- Novel combination: spatial input (orientation) + GPU-like particle sim + local AI worker + responsive physical UI chrome.

## Expected outcome
Interactive spatial canvas where tilting device or moving pointer seeds the field; worker detects clusters and the surrounding interface scales/rotates/hues in response. Runnable in any modern browser; orientation requires permission on some devices.

## Mechanics
- 200 particles with velocity damping and attraction.
- Worker samples every ~10 frames for performance.
- Fallback: pointer-only if no orientation.
- No external deps, single HTML.

## Failure modes
- Orientation permission denied → pointer only.
- High particle count on low-end → drop sampling rate.
- Worker blob URL may need CSP allow in production.

This expands the frontier by adding device spatial input and worker-mediated UI morphing to previous agent simulations.
