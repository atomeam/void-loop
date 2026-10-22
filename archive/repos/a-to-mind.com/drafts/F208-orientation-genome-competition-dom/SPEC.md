# F-208 Orientation Genome Competition DOM Embodiments

**Novel combination:** Evolutionary multi-agent competition where each agent is a tiny local MLP genome that computes force/hue policy from relative pointer position + DeviceOrientation (causal tilt bias). Agents are embodied as both Canvas2D particle bodies and hybrid draggable-looking DOM cards that track their positions. Fitness rewards energy capture near pointer + survival. Weakest are culled; leader genome is mutated and spawned. Leader can be sealed to IndexedDB and transferred across tabs via BroadcastChannel (local stand-in for WebRTC shared field).

**Branches away from:** residual predictors, attention lattices, sequence transformers, pure NCA, spectral residuals, pointer-history fields, recent WebXR-hand/gaze + softbody clusters.

**Architecture:** single index.html; Canvas2D simulation; 6+ agents; DeviceOrientation + pointer as inputs; IndexedDB seals; BroadcastChannel transfer; no external deps; offline-capable.

**Expected:** living competition where tilting the device biases all agent policies, pointer injects contested energy, DOM cards follow their agents, best genomes persist and can be shared across tabs.

**Failure modes:** no DeviceOrientation (desktop still runs with pointer), IndexedDB blocked (seal fails gracefully), low performance (reduce agents).

**Building blocks:** orientation-as-causal-policy-input, sealed evolutionary genomes, hybrid canvas+DOM agent embodiments, local multi-tab genome transfer. Next: true WebRTC data channels + WebGPU compute kernel for the force field.
