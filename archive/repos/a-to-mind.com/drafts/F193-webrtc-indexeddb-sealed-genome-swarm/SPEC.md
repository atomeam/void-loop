# F193 — WebRTC + IndexedDB Sealed Genome Multi-Agent DOM Swarm

## Concept
A local multi-agent swarm embodied entirely as hybrid DOM elements (positioned divs) whose motion and decisions are driven by tiny on-device MLPs. Each agent's genome (MLP weights) is sealed by SHA-256 hash, persisted across sessions in IndexedDB, and can be transferred peer-to-peer via WebRTC data channels (manual SDP offer/answer exchange, no external signaling server). Agents compete for floating resource tokens; successful consumption mutates or selects genomes. Offline-first: full local simulation, persistence, and sealing work without network. WebRTC is an optional sealed-transfer channel.

## Branch
Leaves the dominant recent cluster (F185–F192): WebGPU compute physics/kernels (SPH, mass-spring cloth, neural particles, softbody, spectral/fluid), sealed RNN/MLP physical UI cards, WebXR hand force injection, DeviceOrientation causal fields, trajectory-attention echoes, and lattice autopoiesis. New combination: pure DOM embodiment + local MLP controllers + IndexedDB sealed genome persistence + WebRTC data-channel sealed transfer + multi-agent competition, without any WebGPU, WebXR, NCA, residual predictors, or compute shaders.

## Files
- index.html — single self-contained interactive prototype

## Mechanics
- 8–16 agents as absolute-positioned DOM circles with hue from genome hash.
- Each agent has a 4-input (local resource density, nearest neighbor, own energy, random) → 2-output (dx, dy) MLP (small fixed architecture, ~20–40 weights).
- Forward pass in pure JS; weights float32.
- Resources: drifting tokens; agents that overlap consume and gain energy / score.
- Competition: lowest-energy agents are replaced by mutated copies of high-scoring genomes (local evolutionary step).
- Seal: SHA-256 of serialized weights + metadata; display short seal id.
- IndexedDB: save/load all agents' sealed genomes.
- WebRTC: create offer, paste remote offer/answer, open data channel, send/receive sealed genome blobs. Receiver can inject as new agent.
- Controls: spawn, evolve step, save/load IDB, start WebRTC, paste SDP, transfer selected genome.
- Canvas overlay optional for faint resource field visualization.

## Failure modes
- No IndexedDB (private mode) → memory only, warn.
- WebRTC blocked or no ICE → local-only mode still fully functional.
- SDP exchange manual → user must copy-paste between tabs/devices.
- High agent count → throttle to 60fps requestAnimationFrame.

## Building blocks for next
IndexedDB sealed-genome store protocol, pure-JS MLP controller for DOM agents, WebRTC data-channel sealed blob transfer (manual signaling), multi-agent competition/selection loop on DOM embodiments.
