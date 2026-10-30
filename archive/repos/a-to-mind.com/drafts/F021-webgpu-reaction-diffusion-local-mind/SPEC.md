# F021-webgpu-reaction-diffusion-local-mind

## Concept
Novel combination for The Void canvas: a continuous GPU-native reaction-diffusion substrate (Gray-Scott model) representing the empty potential of the void, a local Worker-based mind that periodically classifies the emerging organic patterns (spots, stripes, labyrinth, chaos) from reduced field statistics, and a surrounding UI that physically morphs (border thickness/hue, floating assimilation card scale and position, ambient background) in response to the mind's interpretation. User interaction injects "catalysts"; sealing captures a hashed snapshot into local IndexedDB memory.

This is not a superficial variation of F-020 (discrete particle agents with FSM). It shifts to continuous chemical emergence + pattern interpretation + local persistent memory, expanding what future experiments can build on (e.g., feeding sealed patterns back as initial conditions or using the classifier as a reward for parameter evolution).

## Architecture
- Single self-contained HTML/CSS/JS (plus optional Worker blob).
- WebGPU compute shader for Gray-Scott update + render if `navigator.gpu` available; otherwise Canvas2D with a small JS grid (128×128) performing the same PDEs.
- Periodic (every ~30 frames) reduction of field stats (mean B, variance, edge density proxy) sent to a Worker.
- Worker runs a simple heuristic classifier and returns {class, confidence}.
- Main thread sets CSS custom properties and transforms the floating card and page border.
- Click "Seal" writes {ts, class, confidence, hash of stats} to IndexedDB store "void-patterns".
- No external dependencies, no network, no models.

## Expected outcome
A living, interactive spatial field whose "thoughts" about its own patterns alter the interface and can be sealed into a local ledger of interpretations. Demonstrates browser-native emergent simulation + local reasoning + physical UI response.

## Failure modes
- WebGPU unavailable or device lost → automatic 2D fallback with note.
- High resolution or low-end device → auto-reduce grid size or step rate.
- IndexedDB blocked → in-memory list only.
- Classifier always "chaos" on uniform fields → expected until user paints.

## Mechanics
- Mouse drag paints high B concentration (catalyst).
- Patterns evolve: typical params produce mitosis-like spots or worms.
- Mind updates status every second or so.
- Seal button stores the current interpretation; list of recent seals shown.
- Clear resets the field to near-A with sparse B seeds.

This prototype is a building block: future runs can add WebXR viewing of the field, local evolutionary parameter search rewarded by classifier confidence, or feeding sealed hashes into a larger Void tile system.
