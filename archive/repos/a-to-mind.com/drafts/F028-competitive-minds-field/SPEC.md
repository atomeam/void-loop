# F-028 Competitive Minds Field

## Concept
Novel combination: Shared Canvas2D particle field (lightweight boids) simultaneously influenced by two competing local evolutionary minds. Mind A is selected for engagement reward (pointer proximity + dwell). Mind B is selected for exploration reward (velocity variance + field entropy). The dominant mind's genome drives the field step, morphs the surrounding UI chrome (hue-rotate, brightness, scale), and drives dual Web Audio oscillators. Pointer motion injects forces and votes for dominance. Seal hashes both genomes + fitness into IndexedDB.

Not a superficial variation of:
- F-020 discrete agents + FSM
- F-021 observer classifier / reaction-diffusion
- F-022 fluid regime bias
- F-023 evolutionary lattice rules
- F-024 volumetric noise + evolutionary controller
- F-025 single RL mind on boids behavioral params
- F-026 trajectory-prediction intent lattice
- F-027 spectral phase resonance / Kuramoto

Here two minds compete for control of one continuous substrate; dominance is explicit and visible; rewards are opposing (engage vs explore).

## Architecture
Single self-contained HTML. Evolutionary populations of 4 genomes each live in main thread (Worker path noted). Main steps ~280 particles under the dominant genome, draws trails, applies CSS morph, updates stereo-ish audio. Graceful: no audio until gesture; low-end drops N.

## Expected outcome
Interactive spatial field that shifts between "seeking the pointer" and "spreading chaotically" as minds compete; page chromatics and tone follow the winner; sealed dual genomes form local memory of successful competitive policies.

## Mechanics
- ~280 particles, neighborhoods ~60/24 px
- params per mind: align/coh/sep/maxSpeed/attract
- minds ~1.25 Hz
- morph: hue/brightness/scale from dominance ratio
- seal: SHA-256 truncated of both genomes + IndexedDB

## Failure modes
- Low-end devices: reduce N or skip evolution
- Audio blocked until user gesture
- No orientation dependency

## Building block for future
True multi-Worker minds, WebGPU compute particles, WebXR tracked competition, sealed genome breeding across sessions, more than two minds.

Lands in V01D as a spatial stage skill (skills/mini/competitive-minds.js) testable via tools/competitive-minds.test.mjs for dominance→morph mapping.
