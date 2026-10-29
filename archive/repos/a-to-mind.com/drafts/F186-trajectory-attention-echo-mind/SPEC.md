# F186 Trajectory Attention Echo Mind

## Concept
Pointer trajectories build a persistent spatial memory field (coarse grid of local embeddings). A tiny multi-head attention mechanism (pure local JS) continuously queries the field using current pointer/orientation + a learned query. Attention outputs drive a simple generative echo engine that produces short phrases, rendered on morphing DOM cards attracted to high-attention loci. Canvas visualizes the memory density and attention flows. User can inject seed words that bias specific grid cells. IndexedDB seals the memory field across sessions.

Deliberately new axis after F177–F185 (WebGPU probes, RNN softbodies, WebXR, orientation MLPs, compute genomes, spectral NCA, genetic portals, SPH vortices, sealed RNN DOM agents). Focus: trajectory-as-memory + local multi-head attention + generative echoes + hybrid canvas/DOM embodiment, without compute shaders, particle physics kernels, or pure recurrent agents.

## Architecture
- Single self-contained index.html
- Memory grid: 16x12 cells, each holding a 8-dim embedding vector (updated by pointer path + seeds)
- Tiny attention: 2 heads, query from [norm pointer, orient, time], keys/values from grid embeddings
- Echo generator: attention-weighted template + simple bigram fallback over seed lexicon, or char sampling from attention-modulated logits
- DOM cards: 3–5 floating "echo" cards whose position/scale/opacity follow top attention peaks; text updates live
- Canvas2D: heatmap of memory energy + attention lines
- Persistence: IndexedDB stores grid embeddings + last seeds
- Offline-capable, no external models or WebGPU required (optional future)

## Interaction
Move pointer or tilt device to write trajectories into memory. Type a seed word and inject to bias a region. Watch attention focus, cards migrate to peaks, and echo phrases emerge/morph. Seal button persists field. Reload restores.

## Expected outcome
Interactive spatial canvas where the user's path becomes a memory the local attention "reads", generating living echo text on physically moving cards. Persistent local mind. Runnable in any modern browser.

## Failure modes
- No orientation: pointer-only
- IndexedDB blocked: session memory only
- Sparse trajectories: low attention contrast, generic echoes
- Very small viewport: cards stack, still readable

## Building blocks
Spatial trajectory memory grid, local multi-head attention over embeddings, generative echo cards driven by attention, hybrid canvas visualization + DOM embodiment, IndexedDB seal protocol for field state.
