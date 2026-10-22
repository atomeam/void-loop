# 020-webgpu-void-agents

## Concept
Novel combination: WebGPU compute shaders driving an emergent particle "agent" simulation, where each agent has a local finite-state "reasoning" layer (JS-side decision based on local neighborhood stats fed back from GPU), and the surrounding UI chrome (border, ambient color, "seal" status) physically responds to the global entropy and agent consensus of the simulation.

This expands the Void canvas with a living, interactive spatial field that is not a static tile but a GPU-native system whose "thoughts" alter the interface itself.

## Architecture
- Single HTML file with inline WebGPU (if available) or Canvas2D fallback.
- Compute pass (or CPU sim) updates agent positions/velocities.
- JS reads reduced stats (mean velocity, density, entropy proxy) each frame.
- Local agent FSM: idle / exploring / clustering / dispersing based on mouse proximity and stats.
- UI morphs: border width, color hue, and a status pill update in response.

## Expected outcome
Runnable prototype that demonstrates interactive spatial AI-like behavior entirely in-browser, no external models. Failure modes: WebGPU unsupported → graceful 2D fallback; high agent count → throttled.

## Mechanics
Mouse moves attract/repel agents. Click seeds a new cluster. Global "mood" (entropy) changes the canvas frame.
