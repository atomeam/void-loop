# F-051 WebGPU Causal Echo Lattice Mind

## Concept

Novel combination of:

- WebGPU compute (with Canvas2D fallback) running a causal wave/echo lattice: each cell holds phase and amplitude that propagates from pointer and planted anchors
- Local Web Worker evolutionary residual predictor (tiny linear + bias genome) of next-step field energy from pointer trajectory and recent lattice samples
- Residual error modulates lattice damping, propagation speed, and global page chrome (hue, glow, filter)
- Clickable/plantable DOM "echo anchors" that inject persistent causal sources; the lattice resonates around them and the AI associates their influence into the predictor fitness
- Seal persists best genome + anchor positions to localStorage

Not a superficial variation of prior frontier work:

- F-020 WebGPU agents (discrete FSM, no continuous wave residual)
- F-021 orientation + density morph (no causal echo or predictor)
- F-043 / F-049 predictive residual lattice/swarm (RD or particle cohesion, no planted causal anchors + wave echo)
- F-047 causal attention lattice (attention kernel, not physical wave propagation with residual control)

Mind is a causal residual minimizer whose prediction error steers the echo dynamics of a spatial lattice and the surrounding UI.

## Architecture

Single self-contained `index.html`.

- Main thread: lattice step (WebGPU compute if available, else Canvas2D wave), pointer history, residual, DOM anchors, CSS morph, render
- Blob Worker: population of 8 genomes (5 genes: speed bias, damp scale, residual gain, anchor weight, coherence boost); fitness from residual + lattice coherence; mutates elite; returns best ~1.5 Hz
- Fallback: static genes if Worker or WebGPU unavailable

## Expected outcome

Interactive spatial echo lattice that anticipates gesture, resonates around planted anchors, warps its own propagation, and morphs the page. Runnable offline. Seal persists genome and anchors.

## Mechanics

- Pointer and anchors inject phase/energy into lattice cells
- Lattice updates via neighbor diffusion + damping modulated by residual
- Residual computed from predicted vs observed field energy near pointer
- Anchors are draggable DOM elements that bias nearby cells
- Evolution rewards low residual and sustained coherence around anchors
- Chrome: hue from residual, glow from confidence, optional chromatic filter

## Failure modes

- No WebGPU → Canvas2D wave fallback (still interactive)
- CSP blocks blob Worker → static genes
- Low motion → high residual, more damped lattice
- Small screens crowd anchors; localStorage blocked → seal fails gracefully

## Building blocks for future

- True WebGPU multi-scale wave + MLP residual in compute shader
- WebXR hand rays as causal injectors
- Multi-genome competition for anchor resonance
- Sealed genome + anchor transfer across sessions

## Lands in V01D

Spatial stage skill (`skills/mini/causal-echo-lattice.js`). Testable via residual→damping and conf→anchor-influence mapping.
