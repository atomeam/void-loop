# F203 · WebXR Gaze-Driven WebGPU Neural Kernel Field with IndexedDB Persistence

**Branch away from:** Recent cluster of WebXR hand-tracking MLP/RNN DOM chains and physics (F202, F200), multi-agent sealed genome particle competitions (F201), orientation MLP gravity swarms (F198), causal particle/fluid minds and residual predictors (F199–F200, F190+). Explicitly leaves hand-causal DOM, pure multiagent resource chasing, and attention/residual lattices.

**Novel combination:** True WebXR gaze (pointer + DeviceOrientation fallback as gaze proxy) as causal input to a local tiny MLP. MLP outputs modulate parameters of a WebGPU compute shader that executes a simple recurrent neural kernel on a spatial grid (diffusion + local recurrence). Grid state visualized on canvas; hybrid DOM probe cards are positioned and styled by querying the kernel output. Field snapshots and sealed MLP genomes persisted to IndexedDB for multi-session continuity. Offline-capable single file.

## Capability
- Gaze/pointer deposits causal energy; DeviceOrientation adds tilt bias to the kernel.
- Tiny 4-input → 3-output MLP (JS) runs each frame, outputs kernel modulation (decay, diffusion, recurrence strength).
- WebGPU compute path (Canvas2D CPU fallback): updates a 64×64 grid via WGSL compute shader implementing local recurrence: state = decay * state + diffusion * neighbors + mlp_mod * gaze_input.
- DOM probes (3 floating cards) sample grid peaks and morph position/scale/hue.
- Seal current MLP weights (FNV-like hash) to IndexedDB; inject on reload or button.
- Persist full grid snapshot to IDB every 5s; restore on load.
- Fully offline after first load; progressive (works without WebGPU/XR).

## Building blocks for next
- Gaze-causal MLP → WebGPU neural kernel parameter upload.
- IndexedDB field + genome persistence primitive for shared/multi-session minds.
- Hybrid canvas kernel + DOM probe embodiment ready for WebRTC data-channel field sync or true WebXR immersive gaze.

## Failure modes
- WebGPU unavailable → CPU Canvas2D kernel (still interactive).
- WebXR gaze not universally supported; pointer is primary.
- DeviceOrientation requires permission/gesture on iOS.
- IndexedDB private-mode or quota → in-memory only, no persistence.
- Compute shader compile fail → fallback.
- MLP may saturate; simple mutation on inject.

## Test
Open index.html offline. Move pointer (gaze), observe field evolve and probes react. Tilt device if available. Seal genome, reload, Inject. Confirm IDB restore of field and genome. Check console for WebGPU status.
