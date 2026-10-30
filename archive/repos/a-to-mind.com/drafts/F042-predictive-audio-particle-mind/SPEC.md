# F-042: Predictive Audio Particle Anticipation Mind

## Concept
Novel combination of local Web Audio spectrum analysis, a Web Worker evolutionary predictive MLP mind, Canvas2D particle residual visualization, and morphing global UI chrome. The mind learns to anticipate the next audio frame; prediction residuals drive particle motion forming visible "echo structures"; pointer interaction near particles supplies corrective fitness that rewards accurate anticipation; chrome (hue-rotate, blur, scale, filter) morphs with prediction accuracy and fitness. Seal persists the best genome to IndexedDB.

Not a superficial variation of prior experiments:
- Not F-020 discrete agents+FSM
- Not F-021/022 field/fluid observers or fixed-param regimes
- Not F-025 boids RL (no continuous agent flock rules)
- Not F-037 voice lattice or F-040 neural probe swarm (particles are residual of sensory prediction, not free agents or probes)
- Not F-038 living cards or pure lattice evolution
The core is a predictive sensory model whose error becomes spatial structure, with user interaction as teaching signal.

## Architecture
Single self-contained `index.html`.
- Main thread: getUserMedia (or oscillator fallback), AnalyserNode → 8-bin spectrum features, steps ~80 particles whose velocity is biased by prediction residual, draws on Canvas2D, applies CSS morph, handles pointer for local reward, seal button.
- Blob Worker: population of 6 MLP genomes (8→12→8), evaluates fitness from reported error + interaction, mutates, returns best weights every ~1 s.
- Fallbacks: no mic → synthetic drifting spectrum; no Worker → fixed random weights; audio after gesture; CSP blob Worker block → static.

## Expected outcome
Particles that cluster or stream according to how well the local mind anticipates the sound; user can point near particles to reward good predictions; page chromatically and spatially warps as accuracy improves; sealed genomes form local memory of successful predictive policies. Fully offline-runnable.

## Mechanics
- Spectrum: 8 frequency bins (low to high), normalized 0–1.
- Mind: shared MLP weights evolved; forward pass predicts next bin vector from current + recent mean.
- Particles: position/velocity updated with residual vector (predicted − actual) scaled and rotated into 2D force; pointer proximity adds positive fitness.
- Evolution ~1 Hz; morph 0–1 from (1 − mean error) drives CSS.
- Seal: truncated SHA-256 of weights + fitness + timestamp → IndexedDB.

## Failure modes
getUserMedia denied → synthetic audio; blob Worker blocked by CSP → static weights; high particle count on low-end → drop to 40; audio context suspended until user gesture; particles may clump (clamped + mild repulsion).

## Building block for future
True WebGPU compute for particle residual + spectral texture; WebXR head-tracked anticipation field; multi-mind competition on different frequency bands; sealed genome transfer and breeding across sessions; local tiny RNN instead of MLP.

## V01D landing
Spatial stage skill (`skills/mini/predictive-audio-mind.js`); testable via `tools/predictive-audio-mind.test.mjs` for spectrum→prediction residual and fitness→morph mapping.
