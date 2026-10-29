# F-037 Resonant Voice Lattice Mind

## Concept
Continuous lattice substrate (Canvas2D grid) whose local update parameters are evolved by a local Web Worker population of genomes under selection for spectral resonance with live microphone input (Web Audio AnalyserNode). The mind's fitness morphs the surrounding UI chrome (hue-rotate, blur, scale, background) and the field activity is sonically responsive. Pointer seeds energy into the lattice. Seal hashes current genome + fitness into IndexedDB.

## Architecture
Single self-contained HTML. Worker via blob maintains pop of 8 parameter vectors (diffusion, reaction, attractor, decay), returns best under resonance reward. Main steps lattice, computes crude field spectrum by spatial binning, compares to voice spectrum, applies CSS morph. Not a variation of prior F- series (agents, RD observer, fluid, evo lattice, volumetric, boids RL, XR NCA, spectral oscillators, competitive minds, attention lattices, trajectory memory, graphs, vector fields, spectral resonance, evo swarm, evolving NCA). Novel combination: live voice spectral feedback as the selection pressure for an evolutionary mind controlling a spatial lattice, with UI morph.

## Expected outcome
Interactive spatial field that discovers parameter regimes which visually and dynamically resonate with the user's voice or humming, warps the page, and can be sealed as local memory of successful "resonant minds". Runnable with graceful fallbacks (no mic → pointer only; no Worker → fixed params).

## Mechanics
80×50 float grid, logistic+diffusion+decay rule parameterized by 4 floats; mind ~2 Hz; morph driven by resonance score; seal SHA-256 truncated + IndexedDB.

## Failure modes
Mic permission denied or insecure context → pointer-only mode; CSP blocks blob Worker → static params; low-end drops resolution or frame rate.

## Building block for future
True WebGPU compute lattice with spectral hash, WebXR spatial voice field, multi-band resonance minds, sealed genome breeding that transfers resonant policies across sessions.

## V01D landing
Spatial stage skill (`skills/mini/resonant-voice-lattice.js`); testable via tools/resonant-voice.test.mjs for spectrum-match → morph mapping.
