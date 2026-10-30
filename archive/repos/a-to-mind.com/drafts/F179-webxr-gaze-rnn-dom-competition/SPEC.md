# F179 WebXR Gaze Competitive RNN DOM Mind

## Concept
Novel combination: true WebXR gaze (XRInputSource targetRayMode 'gaze' or viewer pose) as the primary causal sequence input to a local multi-agent system of tiny Elman RNNs. Each agent controls a hybrid physical DOM card (position, scale, hue) whose motion is the RNN output. Agents compete for alignment with the current gaze target; periodically the highest-fitness sealed genome is transferred (mutated) to lower agents. Field persists via IndexedDB. Canvas2D projects the spatial field. Offline-capable with pointer/orientation fallback.

Deliberately leaves the recent cluster of Canvas2D particle/swarm/soft-body physics kernels driven by MLP/RNN/evo on orientation/hand/pointer/audio, residual predictors, competitive free-agents on resource fields, and WebRTC shared particle fields (F171–F178). New axes: true WebXR gaze as causal input, competitive RNN genomes controlling physical DOM embodiments, sealed transfer, hybrid DOM+canvas without particle simulation.

## Architecture
- Single self-contained index.html.
- 4 agents, each with position and a tiny RNN (input 4: gaze_x, gaze_y, gaze_vx, energy → hidden 6 recurrent → output 3: dx, dy, scale).
- WebXR: requestSession('immersive-vr' or 'inline'), poll XRFrame for gaze ray or viewerSpace pose; map to 2D target.
- Fallback: pointer movement or DeviceOrientation beta/gamma as gaze proxy.
- DOM cards: absolute, transform updated from RNN output each frame.
- Competition: fitness = inverse distance of card to gaze target + low residual; every ~4s transfer mutated best genome.
- IndexedDB: seal best weights + hidden states.
- Canvas2D: draw gaze reticle and agent trails for spatial context.
- Offline, no external models or network.

## Expected outcome
Enter XR (or move pointer/tilt): gaze steers the field; competitive agents' cards chase and morph to track it; best genome spreads. Seal persists. Fully local.

## Mechanics
- Gaze extraction: if XR session, use inputSources with targetRayMode==='gaze' or pose of viewer; else pointer delta.
- RNN forward: h = tanh(W_xh * x + W_hh * h + b); y = W_hy * h.
- Transfer: copy best weights, add small noise, reset losers' hidden.
- Mapping: card.style.left/top = agent.pos; transform scale = y[2].
- Seal: IDB put of {weights, fitness, timestamp}.

## Failure modes
- No WebXR / no gaze → pointer or orientation proxy.
- No IndexedDB → in-memory only.
- CSP blocks nothing (all inline).
- Low performance → reduce agents or hidden size.

## Building blocks for next
WebGPU compute of the RNN kernel itself, multi-user WebRTC genome broadcast of gaze-driven agents, true eye-tracking when available, soft-body attachment of DOM cards to XR anchors.

## Lands in V01D
Spatial stage mini under skills/mini/webxr-gaze-rnn-dom.js. Test: gaze sequence of length 40 produces measurable card displacement > 30px and fitness increase after one transfer cycle; seal round-trips via IDB.
