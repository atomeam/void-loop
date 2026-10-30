# F188 WebXR Hand Competitive MLP DOM Field

## Concept
True WebXR hand-tracking (XRHand joints: palm, index tip, thumb tip relative) as causal multi-channel input to a population of competitive local tiny MLPs. Each MLP independently drives a hybrid physical DOM card (CSS position, rotation, scale, hue, opacity). Agents compete on fitness (alignment to index-tip focus + stability + claimed screen area). Periodic sealed genome transfer mutates the champion and overwrites the weakest. IndexedDB persists the champion genome + hidden state across sessions. Canvas2D draws the projected hand skeleton and agent trails. Pointer/DeviceOrientation fallback when XR or hand-tracking is unavailable. Fully offline-capable single file.

Deliberately branches away from the dominant recent cluster (F182–F187 WebGPU spectral/fluid/NCA/orientation/evo continuum simulations, SPH vortex portals, genetic softbody portals, compute genome physics; F186 trajectory-attention echo memory fields). New axis: pure WebXR hand joints → competitive local MLP genomes → physical DOM embodiments, without compute shaders, particle kernels, residual predictors, attention lattices, or continuum fields.

## Architecture
- Single self-contained `index.html`
- 3 agents, each owning one absolutely-positioned DOM card
- Tiny MLP per agent: input 9 (rel palm x/y, index tip x/y/vx/vy, thumb x/y, energy) → hidden 8 (ReLU) → output 4 (dx, dy, drot, dscale)
- Weights are the genome; transfer copies + Gaussian noise
- Fitness: inverse distance of card center to projected index tip + low velocity penalty + area bonus
- WebXR: `navigator.xr.requestSession('immersive-vr', {optionalFeatures: ['hand-tracking']})`; on XRFrame extract `XRHand` joints, project via reference space
- Fallback: pointer position/velocity as “hand”
- Canvas2D: hand skeleton lines + agent position history
- IndexedDB: seal `{weights, fitness, timestamp}` for champion
- Offline: all local, no network, no external models

## Interaction
Enter XR (or move pointer). Hand joints drive competing agents; cards chase, rotate, and morph. Watch transfer events. Seal persists the best genome. Reload restores. Tilt device as secondary bias if orientation available.

## Expected outcome
Interactive spatial canvas where the user’s hand (or pointer) becomes the causal focus that competing local models physically embody as living DOM cards. Persistent sealed evolution. Runnable in any modern browser with optional XR.

## Failure modes
- No WebXR / no hand-tracking → pointer proxy mode
- IndexedDB blocked → session-only memory
- Permission denied or session end → graceful fallback
- Low performance → reduce agents or hidden size (still functional)

## Building blocks
WebXR hand joint extraction as multi-channel causal input, competitive local MLP genomes with sealed transfer, hybrid DOM physical embodiment driven by model outputs, IndexedDB champion seal, projected skeleton visualization.
