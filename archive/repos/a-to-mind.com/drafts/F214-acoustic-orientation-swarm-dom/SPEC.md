# F-214 Acoustic Orientation Swarm DOM Curators

**Novel combination:** Microphone audio spectrum bins inject multi-channel energy forces into a WebGPU particle swarm (storage-buffer positions/velocities). DeviceOrientation provides global bias force (tilt as wind). Particles form emergent clusters; a lightweight CPU reduction samples high-energy particle centroids to drive absolutely-positioned DOM curator cards (scale, hue, and short procedural labels). Pointer drags on cards apply inverse attraction forces uploaded each frame. Cluster cohesion fitness mutates a small force-scale genome sealed to IndexedDB + BroadcastChannel.

**Branches away from:** F213 neural-kernel DOM chains, orientation-MLP/RNN main-thread loops, pure reaction-diffusion or fluid without audio injection, WebXR hand curators, compression-oracle worlds, and residual attention portals (F205–F213). Moves the continuous physics to WebGPU while audio becomes the primary causal multi-channel input and DOM cards are pure embodiment of cluster centroids.

**Architecture:** single self-contained index.html; WebGPU compute pipeline (WGSL particle integrate + force); Web Audio AnalyserNode frequency bins; DeviceOrientation; CSS-transformed DOM cards; IndexedDB seal; BroadcastChannel; progressive JS/Canvas2D fallback if no WebGPU. Offline-capable after first load, no external deps.

**Expected:** living swarm of particles (visualized via canvas or implicit) whose clusters birth and move DOM cards that grow/shrink and recolor under live microphone and device tilt. Dragging a card pulls nearby particles. Leader genome persists across reloads/tabs.

**Failure modes:** no WebGPU (JS particle loop + canvas); mic permission denied (zero-energy fallback + pointer seeds); no DeviceOrientation (mouse-as-tilt or zero); IndexedDB blocked (in-memory); high particle count on low-end (cap at 256).

**Building blocks:** audio-spectrum as multi-channel GPU force injection, orientation-as-wind into particle compute, cluster-centroid DOM embodiment, sealed force-scale genome. Next: WebXR hand poses as additional force sources or cross-device audio-sync via WebRTC.

V01D landing: spatial acoustic swarm skill under void-live-deploy/skills/; testable by mic energy driving card scale and genome round-trip.
