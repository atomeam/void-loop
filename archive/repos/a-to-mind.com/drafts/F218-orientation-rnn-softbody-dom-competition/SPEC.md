# F-218 Orientation RNN Softbody DOM Competition

**Novel combination:** DeviceOrientation (beta/gamma) acts as causal global wind/gravity into a shared 2D spring-mass softbody. Each of 5 agents owns a tiny local Elman-style RNN (6 hidden units) whose inputs include orientation, local spring energy, and an agent bias. RNN outputs modulate per-spring stiffness and damping for the agent's row region. Agents compete on system energy reduction + cohesion; weakest is periodically mutated from the leader. Hybrid embodiment: canvas softbody visualization + absolutely positioned DOM agent cards that update live. Leader genome sealed to IndexedDB and broadcast via BroadcastChannel for cross-tab transfer.

**Branches away from:** the recent cluster of residual prediction oracles (F216), acoustic/spectral force injections and orientation swarms (F214), codec/video surprise retinas on RD worlds (F215), spiking STDP audio foragers with AudioWorklet (F217), neural-kernel DOM chains (F213), resonant audio imagination (F212), WebXR hand residual or RNN curators, and compression-oracle particle worlds (F210–F211). Explicitly avoids residual predictors, spectral/audio residuals, pure NCA, attention lattices, pointer-history fields, and volumetric injection. Moves to local tiny RNN models controlling physical spring parameters under DeviceOrientation causal input, with multi-agent sealed-genome competition on a pure softbody substrate + hybrid DOM cards.

**Architecture:** single self-contained index.html; Canvas2D spring-mass (96 particles, structural + shear springs); DeviceOrientation + pointer as causal forces; main-thread tiny RNNs; CSS DOM agent cards; IndexedDB seal; BroadcastChannel; fully offline-capable after first load, no external dependencies. Progressive: works without DeviceOrientation (mouse simulates tilt).

**Expected:** Living softbody that undulates under device tilt or mouse drag. DOM cards show live fitness ranks and glow for the leader. Competition mutates weak agents toward strong ones. Seal persists best genome across reloads and shares it to other tabs.

**Failure modes:** no DeviceOrientation (mouse/pointer works); IndexedDB blocked (in-memory only); BroadcastChannel unavailable (local only); low-end devices (96 particles + 5 RNNs is light).

**Building blocks:** DeviceOrientation as primary causal input into local RNN policy for physical parameters; multi-agent competition with sealed genome transfer on a softbody substrate; hybrid canvas+DOM embodiment without residual or spectral machinery. Next: true WebXR gaze rays as additional force sources into the softbody, or WebGPU compute shader for the spring integration, or WebRTC DataChannel for cross-device genome sharing.

V01D landing: spatial softbody skill under void-live-deploy/skills/; testable by energy drop under simulated orientation and genome round-trip via IndexedDB.
