# F-026 Pointer Trajectory Lattice Mind

## Concept
Novel combination: Canvas2D particle field attracted to a dynamic "intent lattice" computed by a local Web Worker from short-term pointer trajectory memory (recent velocity vectors averaged into a sparse grid of predicted attraction points). Dominant lattice cell confidence morphs the surrounding UI (CSS custom properties for HUD grid positions, hue, and scale) and drives multi-oscillator Web Audio with stereo panning based on lattice coordinates. Pointer injects direct forces; Seal hashes current lattice state into IndexedDB.

Not a superficial variation of:
- F-020 discrete agents + FSM
- F-021 observer classifier on density/orientation or reaction-diffusion
- F-022 fluid regime bias of fixed params
- F-023 evolutionary lattice update rules
- F-024 volumetric noise + evolutionary controller
- F-025 boids flocking with RL on behavioral params

Here the substrate is a continuous particle field under external lattice attractors derived from temporal sequence memory of user input (trajectory prediction), rather than local agent rules or evolved substrate parameters. The mind is a lightweight sequence predictor, not an evolutionary population.

## Architecture
Single self-contained HTML. Worker (blob) maintains a ring buffer of recent pointer vectors, updates an 8×8 intent lattice (attraction points + strengths) via exponential moving average + light noise, returns top cell. Main thread steps ~300 particles attracted to active lattice points, draws with trails, applies CSS morph, updates audio. Graceful: no Worker → static center attractor; no audio until gesture.

## Expected outcome
Interactive spatial field that anticipates pointer motion, warps the page layout and color according to predicted intent, and generates spatial audio. Sealed lattice states form local memory of interaction styles.

## Mechanics
- ~300 particles, attraction to lattice points within range
- Mind ~2 Hz
- Morph 0–1 scales CSS --intent-x/--intent-y for HUD translate, hue-rotate, scale
- Seal: SHA-256 truncated of lattice JSON + IndexedDB

## Failure modes
- Low-end devices: drop particle count
- CSP blocks blob Worker → fixed attractor
- Audio blocked until user gesture
- No orientation dependency

## Building block for future
True WebGPU compute particles with spatial hash for lattice, WebXR tracked trajectory, sealed lattice breeding, multi-modal (mic + pointer) sequence memory.

Lands in V01D as a spatial stage skill (skills/mini/trajectory-lattice.js) testable via tools/trajectory-lattice.test.mjs for trajectory→morph mapping.
