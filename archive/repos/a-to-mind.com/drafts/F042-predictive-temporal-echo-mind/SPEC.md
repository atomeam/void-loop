# F-042: Predictive Temporal Echo Mind

## Concept
Novel combination of a spatial particle field (pointer + optional DeviceOrientation), decaying temporal echo maps written by agent trajectories, and a local Web Worker that performs lightweight predictive coding (exponential smoothing + linear velocity extrapolation over density hotspots) to forecast where the field will concentrate next. Morphing DOM portals and chrome physically relocate and style themselves to the predicted loci. User clicks on portals act as confirmation/correction signals that update the predictor's bias parameters on-device. Web Audio generates tones whose pitch tracks prediction confidence/error. IndexedDB seals the echo field + predictor state.

Distinct from F-021 (reactive density morph), F-041 (phase-locking resonance agents), F-040 (evolved neural probe swarm), and F-186 (attention over trajectory embeddings): here the local mind is explicitly forecasting future spatial density and the UI is an embodied prediction surface that the user can train by interaction.

## Architecture
Single self-contained `index.html`.
- Main thread: Canvas2D particle simulation with velocity damping + attraction to pointer/orientation bias; maintains a low-res temporal echo grid (decay + additive stamps); positions morphing portals at worker-predicted peaks; drives CSS custom properties for chrome morph (hue, scale, blur) from prediction error and field energy; optional AudioContext oscillator bank.
- Blob Worker: receives density snapshots ~10 Hz, maintains short history of hotspot centroids, computes predicted next positions via velocity estimate + bias, returns top-K forecasts + confidence. Updates bias from click rewards.
- Fallbacks: no Worker → simple local extrapolation on main; no orientation → pointer only; audio after user gesture; IndexedDB optional.

## Expected outcome
Interactive spatial canvas where particles leave glowing temporal echoes. Portals appear ahead of the action at predicted locations and drift as forecasts update. Clicking a portal reinforces or corrects the mind (visible confidence shift). Page chrome morphs with prediction quality. Seal button persists the local mind offline. Runnable in modern browsers without external dependencies.

## Mechanics
- ~120 particles, simple Euler integration, soft boundaries.
- Echo grid 32×24, exponential decay 0.92 per step, stamps from particle positions.
- Predictor: track last 8 centroids, estimate vx/vy, extrapolate 0.8–1.5s ahead, apply learned bias.
- Portals: absolute DOM elements, opacity/scale from confidence, click → reward message to worker.
- Morph: `--error` and `--energy` CSS vars control filter and transform on #chrome and body.
- Seal: JSON of grid summary + predictor params into IndexedDB.

## Failure modes
- Worker blocked by CSP → main-thread predictor.
- Low frame rate → reduce particle count or echo resolution.
- Orientation permission denied or non-HTTPS → pointer fallback.
- Audio suspended until gesture.
- Prediction can lag on abrupt direction changes (user corrections train it).

## Building blocks
Forecast-driven UI materialization, on-device predictor bias update from spatial interaction, temporal echo density as memory substrate, hybrid canvas/DOM predictive interface. Extensible to true WebGPU density field or tiny neural forecaster.

## V01D landing
Spatial predictive skill (`skills/mini/predictive-echo-mind.js`); testable via observation→forecast mapping and click→bias update.
