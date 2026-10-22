# Resonance Field Agent

**Slug:** webgpu-resonance-agent  
**Run:** 171 (frontier-engine)  
**Date:** 2026-10-17  

## Concept
Novel combination: a local (browser-only) agent that classifies spatial gestures and modulates a particle field simulation. The field is the canvas UI; the agent's state is visible as collective particle behavior (gather / disperse / orbit). Designed so the update step can move to a WebGPU compute shader without changing the agent or interaction model.

## Architecture
- Gesture path → lightweight feature extractor (speed, axis bias, curvature)  
- Rule-based local agent updates internal state and field parameters  
- Particle system (CPU baseline; WebGPU compute target) responds to parameters  
- No network, no model download, no attestation claims  

## Expected outcome
User draws on the canvas; particles reorganize according to the agent's interpretation of the gesture. The spatial structure changes in response to local reasoning. Runnable in any modern browser; WebGPU path is a direct lift of the update kernel.

## Mechanics
Pointer move → features → agentStep → fieldStrength / hueShift / attractor mode → particle integration → visual field.  
Fallback is Canvas 2D; the same logic maps to a WebGPU compute + render pipeline.

## Failure modes
- WebGPU unavailable → stays on Canvas 2D (documented).  
- High particle counts on low-end devices → reduce N.  
- Gesture classifier is intentionally simple; richer local models can replace the feature step without touching the field.

## Where it lands in Void
Potential skill under `skills/` or a stage mini that can be summoned. Test: gesture class changes agent state within 100 ms and particle centroid moves toward/away from center accordingly.
