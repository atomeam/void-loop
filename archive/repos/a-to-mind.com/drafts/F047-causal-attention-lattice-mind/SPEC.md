# F-047 Causal Attention Lattice Mind

**Ledger ID:** F-047 (frontier series)

## Concept
Novel combination: Canvas2D spatial lattice whose local update is driven by a causal (pointer-history-conditioned) attention kernel whose parameters are evolved by a Web Worker genetic algorithm. Attention residuals and gradients physically displace floating DOM "thought nodes" that the user can drag; drag reinforcement and node proximity bias the evolutionary fitness. Global chrome (hue) morphs with prediction confidence. Seal persists best genes to localStorage.

Not a superficial variation of:
- F-020 (discrete agents + FSM)
- F-021 (observer classifier)
- F-022 (fixed fluid)
- F-023/F-025 (evolved substrate rules or boids)
- F-038 (living cards without causal attention)
- F-043 (velocity residual predictor)
- F-046 (volumetric thought injection)

The mind is an evolutionary search over the attention mechanism itself that is causally grounded in recent pointer trajectory and embodied by movable DOM nodes.

## Architecture
- Single `index.html`
- Blob Worker maintains population of 8 gene vectors (radius, decay, pointer weight, residual gain, node attract, energy threshold)
- Main thread steps 64×36 field ~60 Hz, renders via ImageData + nearest upsample
- 5 floating circular nodes driven by attention gradients; drag to reposition and reinforce
- Pointer history (12 samples) provides causal bias

## Expected outcome
Interactive spatial field that attends to recent gesture, warps its dynamics, moves thought nodes toward high-attention regions, and offers embodied feedback via drag. Runnable fully offline; Worker failure falls back to static genes.

## Mechanics
- Attention kernel: local neighborhood weighted average + exponential pointer-history bias
- Residual = |attn - field|; conf = 1 - residual
- Node velocity from attention finite differences
- Fitness: (1-residual) + conf + node-proximity
- Evolution ~1 Hz; morph via CSS custom property

## Failure modes
- CSP blocks blob Worker → fixed genes, still interactive
- No pointer history → low causal bias, low conf
- Small viewports → nodes overlap; field still readable

## Building blocks for next
True WebGPU compute attention over multi-channel lattice, multi-head kernels, sealed genome transfer, WebXR pointer ray as causal input.

## V01D landing
Spatial stage skill (`skills/mini/causal-attention-lattice.js`); testable via residual→field and conf→node-glow mapping.
