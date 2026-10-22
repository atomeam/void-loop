# F-226 WebXR Gaze-Driven Sealed MLP Agents

**Novel combination:** True WebXR immersive session (or progressive pointer/orientation fallback) provides gaze ray as primary causal input to a population of tiny local MLPs (3-6-2). Each MLP emits 2D force for its hybrid DOM agent card. Agents compete on gaze-proximity fitness; weakest replaced by mutated copy of leader. Leader genome sealed to IndexedDB. Canvas2D overlay draws gaze intersection and short trails. Fully offline after load.

**Branches away from:** WebGPU neural-kernel competitions (F223), spatial attention lattices (F219/F224), main-thread MLP physics learners (F221), screen-grazing organisms (F222), surprisal strata (F225), residual predictors, pure NCA, spectral/audio residuals, volumetric injection, and pointer-history fields. Elevates true WebXR gaze as the causal driver and keeps the neural kernel tiny + local while embodiment stays hybrid DOM+canvas.

**Architecture:** single self-contained index.html. WebXR for immersive-vr session with pose → gaze ray; main-thread MLP inference and simple Euler physics; absolutely-positioned DOM cards for agents; Canvas2D for ray + trails; IndexedDB for sealed genome; DeviceOrientation optional secondary input. No external deps.

**Expected:** User enters XR (or moves pointer). Agents drift toward current gaze point under individual MLP policies. Competition cycle mutates losers. Seal button persists best weights; reload restores. DOM cards show live rank/fitness.

**Failure modes:** no WebXR (pointer fallback works); permission denied (pointer only); IndexedDB blocked (in-memory); low-end (reduce agent count).

**Building blocks:** WebXR gaze as first-class causal input to local MLP controllers; sealed multi-agent genome transfer on hybrid DOM embodiment; IndexedDB persistence. Next: hand-tracked XR forces, WebRTC sealed weight broadcast, or WebGPU particle skin on the same agents.

V01D landing: local-AI + WebXR skill under void-live-deploy/skills/; testable by gaze-proximity fitness drop and weight round-trip via IndexedDB.
