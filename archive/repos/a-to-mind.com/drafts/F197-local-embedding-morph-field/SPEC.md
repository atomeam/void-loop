# F-197-local-embedding-morph-field

## Concept
Novel combination: Spatial particle field (Canvas2D with WebGPU path noted) where each particle carries a local embedding vector. A pure-JS cosine-similarity attention layer (softmax over query-particle similarities) acts as the local AI reasoning. Attention weights update particle forces and simultaneously drive a morphing CSS/SVG overlay whose geometry (clip-path or filter radius) echoes the attention concentration. DeviceOrientation injects tilt as query bias. Persistent localStorage of recent query embeddings for memory traces.

Not a superficial variation of F-020 (FSM agents), F-021 (orientation density morph), F-190 (causal memory orbs), F-195 (GPU attention swarm), or F-196 (XR causal lattice): the reasoning is an explicit embedding-space attention whose output directly morphs UI geometry rather than only particle motion or color.

## Architecture
- Single self-contained `index.html`.
- Particles: position, velocity, 8-dim embedding (random or seeded).
- Query vector from mouse position (normalized) + orientation tilt.
- Attention: for each particle, score = cosine(query, embed); softmax; force = weight * direction.
- Global entropy and peak weight drive CSS vars for morph: border-radius, backdrop-filter, and a dynamic clip-path or radial gradient overlay.
- localStorage persists last few query embeddings.

## Expected outcome
Runnable interactive spatial field that "reasons" via local attention over embeddings, visibly morphs its own chrome in response to concentration, and remembers recent queries. Offline, no external models.

## Mechanics
Move mouse or tilt device to change query. Attention pulls similar-embedding particles. High concentration (low entropy) tightens UI morph (smaller radius, stronger filter). Click seeds new particles with random embeds.

## Failure modes
No orientation permission → mouse only. High particle count → throttle. No localStorage → no persist.

## Building blocks
Embedding-space local attention, geometry-morphing UI from attention stats, persistent query memory. Next: WebGPU compute for attention matrix or WebXR projection of the field.

V01D landing: spatial attention skill under void-live-deploy/skills/; testable by attention entropy correlating with CSS morph radius.
