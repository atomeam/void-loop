# F176-audio-residual-swarm-mind

## Concept
Novel combination: Canvas2D particle swarm whose cohesion, separation, and hue are driven in real time by the residual error of a local Web Worker evolutionary multi-modal linear predictor. Inputs are recent pointer velocity + optional microphone volume envelope (Web Audio AnalyserNode). Draggable/clickable DOM orbs act as spatial attractors and gene-injection points. Global chrome (background hue, glow) morphs with residual and confidence. Seal persists best genes to localStorage.

Deliberately expands beyond residual-on-pointer-only (F-049), WebRTC shared fields (F-175), and pure WebGPU agents. New axis: audio energy as causal residual channel for the local mind; orbs as bidirectional feedback (attract + inject).

## Architecture
- Single self-contained index.html
- Canvas2D swarm (N≈160 particles)
- Web Audio: getUserMedia → AnalyserNode → volume/rms as second input channel (graceful fallback if denied)
- Worker: evolutionary population of linear predictors (genes for pointer bias/scale + audio scale); fitness from residual + coherence
- DOM orbs: drag to move attractors; click to inject a small gene perturbation into the Worker
- CSS custom properties for hue/glow morph
- Offline-capable; mic optional

## Expected outcome
Interactive spatial swarm that anticipates pointer motion and reacts to voice/volume peaks by tightening or dispersing. Orbs provide embodied feedback. Runnable offline (pointer-only if no mic). Seal stores best multi-modal genes.

## Mechanics
Pointer history + audio rms → residual. Residual scales separation (chaos on surprise) vs cohesion (order on prediction). Orbs attract within range. Evolution ~1.5 Hz. Click orb posts a "thought" gene delta.

## Failure modes
Mic permission denied or no getUserMedia → pointer-only residual. CSP blocks blob Worker → static genes. localStorage blocked → seal fails. Low motion + silence → high residual/chaotic field.

## Building block for future
WebGPU compute swarm with MLP residual on multi-modal (pointer+audio+orientation), sealed genome transfer, WebXR hand as additional causal input.

Lands in V01D as spatial stage skill (skills/mini/audio-residual-swarm.js); testable via residual→cohesion and audio-rms→hue mapping.
