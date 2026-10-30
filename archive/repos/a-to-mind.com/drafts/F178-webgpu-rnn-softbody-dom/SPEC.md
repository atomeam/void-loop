# F178 WebGPU RNN Soft-Body DOM Mind

## Concept
Novel combination: a spring-mass soft-body grid (WebGPU compute path documented; Canvas2D baseline) whose rest lengths and damping are continuously modulated by a local Web Worker tiny Elman RNN. The RNN consumes a short sequence of DeviceOrientation (beta/gamma) + pointer velocity and outputs a stretch vector that deforms the body. Soft-body node positions are mapped in real time to CSS transform/scale on floating DOM cards, producing a hybrid canvas+DOM embodiment. Seal persists RNN weights to IndexedDB.

Deliberately leaves the recent cluster of free-particle probes, residual predictors, competitive genome swarms, attention lattices, pure NCA, and spectral/audio residuals (F172–F177 and priors). New axes: soft-body physics kernel, recurrent sequence model, DeviceOrientation as primary causal sequence, hybrid DOM morph, IndexedDB persistence.

## Architecture
- Single self-contained `index.html`.
- Main: Canvas2D spring-mass integration (N=8×8 nodes, structural + shear springs). WebGPU compute shader sketch in comments for future lift (storage buffers for positions/velocities, compute for force accumulation).
- DeviceOrientationEvent (with permission where required) + pointer as sequence inputs.
- Blob Web Worker: tiny RNN (input 4 → hidden 8 recurrent → output 2). Forward pass every frame; optional light online adaptation.
- DOM cards: absolute-positioned elements whose left/top/scale track selected soft-body nodes.
- Seal button: IndexedDB put of weights + hidden state.
- Offline-capable; orientation optional (pointer fallback).

## Expected outcome
Tilt the device or drag the pointer: the soft body deforms, the mind card and satellite cards stretch and drift with it. RNN hidden state carries short-term orientation history. Fully local, no network, no external models.

## Mechanics
- Soft body: Verlet-style or semi-implicit Euler integration, spring forces, damping, optional mouse pin.
- RNN: `h = tanh(W_xh·x + W_hh·h + b_h)`, `y = W_hy·h + b_y`. Output y scales rest lengths on selected springs.
- Mapping: card position = node.pos projected to viewport; scale = local stretch.
- Persistence: IDB database `void-rnn`, store `weights`.

## Failure modes
- No DeviceOrientation / permission denied → pointer-only sequence.
- No Web Worker (CSP) → static stretch.
- IndexedDB blocked → seal fails silently.
- High node count on low-end → reduce grid.
- WebGPU not yet wired (CPU baseline); next can replace force loop with compute pass.

## Building blocks for next
True WebGPU compute soft-body + RNN kernel, WebXR hand as additional sequence channel, sealed genome transfer of RNN weights across agents, multi-body competitive morphs.

## Lands in V01D
Spatial stage mini under `skills/mini/rnn-softbody-dom.js`. Test: orientation sequence of length 30 produces measurable node displacement > 20px and DOM card scale change within 1s; seal round-trips weights via IDB.
