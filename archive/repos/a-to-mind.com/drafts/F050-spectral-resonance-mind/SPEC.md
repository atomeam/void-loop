# F-050 Spectral Resonance Lattice Mind

## Concept
Novel combination of a coarse Canvas2D lattice of coupled oscillators (spectral field), a local Web Worker evolutionary mind that adapts coupling/damping/prediction genes under selection for low pointer-velocity residual and high field coherence, generative Web Audio driven by the dominant spectral peak, and draggable resonator orbs that inject frequency bias. Global chrome morphs (hue, blur, glow) with residual and coherence.

Not a variation of:
- F-020 (discrete FSM agents + entropy morph)
- F-021 (orientation density)
- F-043 / F-047 (RD or attention lattices)
- F-049 (particle swarm on velocity residual + memory orbs)

Here the substrate is a continuous spectral lattice; the mind minimizes a predictive residual of gesture that controls wave excitation; audio closes a perceptual loop; orbs are frequency seeds.

## Architecture
- Single self-contained HTML.
- Main thread: lattice step (neighbor coupling + residual excitation + orb injection), residual computation from pointer history, CSS morph, canvas draw, Web Audio oscillator bank.
- Worker (blob): population of 8 genomes, fitness = low residual + high coherence, elitism + mutation, returns best genes ~1.5 Hz.
- Orbs: 5 draggable DOM elements that bias local frequency.
- Seal: localStorage of best genes.

## Expected outcome
Interactive spatial field that anticipates gesture via residual, resonates with coherence, warps page chrome, and sings a generative drone whose pitch tracks the lattice peak. Draggable resonators seed local modes. Runnable offline; Worker fallback to static genes; audio starts on first gesture.

## Mechanics
- Grid: 48×32 oscillators (phase, freq, amp).
- Residual: |actual recent pointer speed − predicted from older history × gene|.
- Coupling/damping/ampGain/orbPull from genes.
- PeakHz derived from amplitude-weighted average frequency.
- Morph: hue ← residual+coherence; glow ← coherence.
- Evolution fitness rewards low residual and high coherence.

## Failure modes
- CSP blocks blob Worker → static genes.
- No pointer motion → residual drifts, field damps.
- Audio blocked until user gesture (or permanently if policy).
- Low-end devices: reduce COLS/ROWS if needed.
- localStorage disabled → seal no-ops.

## Building blocks
WebGPU compute lattice (storage buffer of phases/amps), WebXR controller as residual input, multi-genome competition for orb proximity, sealed genome breeding, FFT-based true spectral residual.

## V01D landing
Spatial stage skill (`skills/mini/spectral-resonance-mind.js`). Test: residual→excitation and coherence→audio-gain mapping.
