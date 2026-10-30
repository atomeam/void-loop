# F-225 Acoustic Causal Lattice Mind + Morphing Echo Orbs

## Concept
Novel combination for The Void canvas: live acoustic energy (Web Audio AnalyserNode) and pointer trajectories deposit into a Canvas2D causal lattice. A Web Worker evolutionary mind maintains a small population of parameter genomes (diffusion, reaction, bias) and selects by residual/variance fitness. The selected mind modulates the lattice step and drives floating DOM echo orbs that physically relocate, scale, and rewrite short phrases toward high-activity regions. Global chrome (hue, background) morphs with field entropy. Seal hashes the best genome into IndexedDB.

Not a superficial variation of prior F- experiments (F-020 agents, F-021 orientation density, F-221 MLP physics learner, F-224 thought-trace, acoustic-only, pure RD lattices). The mind is an online residual selector over acoustic+spatial deposits that also owns the physical DOM participants.

## Architecture
- Single self-contained `index.html`.
- Canvas2D grid (64×64) evolves with diffusion/reaction seeded by pointer + frequency bins.
- Blob Worker: 6 genomes, fitness = variance × (1 - residual), mutate losers, return best params.
- 5 absolute-positioned DOM `.orb` elements lerp to peak cells; text and scale driven by local energy.
- CSS variables + body background morph continuously.
- Seal: SHA-256 of genome+entropy into IndexedDB (localStorage fallback).

## Expected outcome
Interactive spatial field that responds to voice/noise and pointer, discovers parameter regimes that sustain interesting activity, and physically rearranges and rewrites floating echo cards. Sealed genomes form a local persistent memory of successful minds.

## Mechanics
1. User enables mic (or moves pointer).
2. Frequency bins and pointer deposit energy into grid cells.
3. Worker receives mean/residual/variance each frame and returns selected params.
4. Lattice steps; peaks attract orbs.
5. Entropy drives chrome hue/background.
6. Seal button stores receipt.

## Failure modes
- Mic permission denied → pointer-only (still functional).
- IndexedDB blocked → localStorage fallback.
- Low-end devices: reduce N or drop orb count.
- No WebGPU (intentional Canvas2D for reliability); future building block is GPU compute for larger grids.

## Building blocks for next
- True WebGPU compute lattice with spatial hash.
- Tiny local transformer or RNN in Worker for longer causal prediction.
- WebXR head/hand tracking to seed deposits.
- Multi-orb competition for attention.
