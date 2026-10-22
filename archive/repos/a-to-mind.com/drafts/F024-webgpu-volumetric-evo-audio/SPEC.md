# F-024 WebGPU Volumetric Noise Void with Local Evolutionary Controller and Spatial Audio Morph

## Concept
Novel combination for The Void canvas: a volumetric density field (projected to 2D canvas via layered noise slices or simple ray-density) generated with multi-octave value noise, representing the empty potential of the void. A local Web Worker maintains a population of noise-parameter genomes (scale, octaves, lacunarity, persistence, warp strength, seed offsets) and evolves them via selection/mutation, using field entropy + edge density + user interaction proxy as fitness. The best genome drives the field. User pointer warps local density (injects structure); DeviceOrientationEvent (if granted) tilts the sampling plane / view bias. Surrounding UI morphs (border radius, hue, thickness, floating card transform) according to fitness and diversity. Web Audio API creates a generative spatial soundscape: field stats drive oscillator frequencies, and simple panning/gain based on active regions so sound "emerges" from the field. Seal button hashes the current genome + stats into IndexedDB for local persistent memory of successful generative rules.

This is not a superficial variation of prior frontier work:
- F-020: discrete particle agents + FSM.
- F-021: RD or orientation density + pattern classifier (observer).
- F-022: fluid advection + regime classifier biasing fixed params.
- F-023: 2D lattice evolutionary rule search + basic audio.

Here the substrate is a continuous volumetric noise field (spatial generative potential), the mind evolves the generative parameters themselves (not discrete CA rules), and spatial audio + morphing close a multi-modal feedback loop. Expands the frontier by treating the void as a navigable generative volume whose physics/parameters are searched locally, with sound as an additional spatial channel.

## Architecture
- Single self-contained HTML/CSS/JS (Worker via Blob URL).
- Canvas2D (256×256 or adaptive) renders layered noise density; optional WebGPU compute path sketched for noise generation when `navigator.gpu` present (falls back to JS noise).
- Every ~15–20 frames, main computes coarse field stats (mean, variance, entropy proxy, edge count) and posts to Worker with interaction score.
- Worker: population of 6–8 genomes (float vectors), fitness = entropy * (1 + edge density) * interaction; selection, mutation, crossover; returns best genome + gen + fitness.
- Main applies genome to noise params, sets CSS custom properties / transforms, updates audio nodes (Oscillator + Gain + StereoPanner).
- Seal: SHA-256 of genome+stats+ts to IndexedDB store "void-vol-seals".
- Fallback: no Worker → fixed params; no AudioContext → visual only; no orientation → pointer only; no WebGPU → JS noise.
- No external dependencies, no network, no large models.

## Expected outcome
An interactive spatial generative volume that continuously evolves its own noise parameters under local selection for interesting, structured density. The page chrome warps, a generative spatial tone follows activity, and user can seed/warp structures. Sealing builds a local ledger of assimilated generative genomes. Runnable in modern browsers with graceful degradation. Demonstrates browser-native volumetric potential + evolutionary local mind + multi-modal (visual+audio+spatial) interface response.

## Mechanics
- Noise: value noise with 3–5 octaves, params from genome.
- Pointer drag injects local warp or high-density seed.
- Orientation beta/gamma (permission) biases sampling offset / "gravity" plane.
- Mind updates ~2 Hz.
- Morph: border-radius 8–50px, hue from fitness, card scale 0.8–1.25 and slight rotate, background gradient shift.
- Clear resets field; Seal stores; recent seals listed in HUD.
- Generation, fitness, regime-like label shown.

## Failure modes
- Worker blob blocked by CSP → inline fixed-genome fallback with note.
- AudioContext requires user gesture → start on first pointer/click.
- High res on low-end → auto drop resolution or octave count.
- IndexedDB blocked → in-memory seals.
- Orientation denied or unavailable → pointer + optional keys for bias.
- WebGPU unavailable → pure JS noise path (expected).

This prototype is a building block: future runs can replace the JS noise with a full WebGPU compute/raymarch shader for true volumetric rendering, feed sealed genomes as seeds into multi-tile Void systems, couple to WebXR for immersive volume navigation, or add haptic feedback via Vibration API mapped to density.
