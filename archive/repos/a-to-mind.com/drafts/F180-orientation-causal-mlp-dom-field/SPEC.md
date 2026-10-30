# F180 Orientation-Causal MLP DOM Agents

## Concept
Pure DeviceOrientation as causal input driving tiny local JS MLPs that control hybrid DOM physical agents. Sealed genomes (SHA-256 of weights) persist and transfer via IndexedDB only. Multi-agent energy competition with mutation/spawn. No WebXR, no WebRTC, no audio residuals, no pure compute lattices or NCA.

## Branch
Away from F172–F179 cluster: WebGPU competitive genomes, MLP orientation physics, WebXR hand MLP swarm, WebRTC shared field, audio residual swarm, probe swarm, RNN softbody DOM, WebXR gaze RNN DOM competition.

## Interaction
- Request orientation permission (iOS).
- Tilt biases MLP force outputs.
- Click agents to inject energy.
- Seed button, Seal & Persist to IndexedDB.
- Agents decay, compete, spawn mutated children when energy high.
- Canvas trails.

## Offline
Fully self-contained. IndexedDB for persistence. Works without network.

## Failure modes
- iOS requires user gesture for DeviceOrientationEvent.requestPermission.
- Desktop orientation usually zero → agents still move via self-MLP + click.
- High agent count may lag pure JS physics (capped ~24).
- No WebGPU dependency.

## Building blocks
- Local tiny MLP (5→4→2) as causal controller.
- IndexedDB sealed genome store.
- Hybrid DOM embodiment + canvas overlay.
- Energy-based multi-agent competition with sealed transfer potential.
