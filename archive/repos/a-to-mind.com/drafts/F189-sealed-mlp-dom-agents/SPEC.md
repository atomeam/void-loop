# F189 — Sealed MLP DOM Agents (Persistent WebRTC Field)

## Concept
Local tiny MLPs (pure JS, no WebGPU) control physical DOM agent cards. DeviceOrientation (or mouse proxy) is causal input to the networks. Agents compete for fitness by responding to tilt. Genomes are sealed with a deterministic hash; export/import verifies the seal before acceptance. Field state persists in IndexedDB. BroadcastChannel provides multi-tab peer signaling as a lightweight WebRTC stand-in for sealed genome transfer.

## Branch
Deliberately leaves the recent cluster of WebGPU compute physics (SPH, softbody, fluid, vortex, genetic portals), spectral/NCA orientation hybrids, WebXR hand/gaze competitive MLPs, trajectory attention lattices, and residual predictors. Focuses on under-explored persistent IndexedDB + sealed genome transfer + local MLP controlling pure DOM embodiment.

## Files
- index.html — single self-contained interactive prototype

## Mechanics
- MLP: 4-in → 6-hidden → 2-out (tanh), random init or restored weights.
- Step: orientation/mouse → forward → delta position; fitness accumulates near-center stability.
- Seal: full agent list (weights + hash + pose) → IndexedDB.
- Transfer: base64 payload of {hash, weights}; import rejects on hash mismatch.
- Offline-first; works without network or sensors (mouse proxy).

## Failure modes
- IndexedDB blocked / private mode → session only.
- No DeviceOrientation permission → mouse-only.
- Hash collision (demo hash is weak) → rare false accept; production would use SHA-256.

## Building blocks for next
Sealed genome exchange protocol, pure-DOM physical agents driven by local models, IndexedDB field persistence, multi-tab peer channel.
