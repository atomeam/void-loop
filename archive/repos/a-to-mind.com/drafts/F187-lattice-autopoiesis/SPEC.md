# F187 Lattice Autopoiesis Mind

**Concept**: Continuous reaction-diffusion lattice (Gray-Scott) on Canvas2D whose control parameters (feed F, kill K, diffusivities) are evolved by a local Web Worker population of genomes. Fitness rewards field variance (pattern diversity) and mean activity. User pointer acts as nutrient source; floating DOM "cells" are attracted to high-concentration loci, scale/color with local value, and on click inject seeds. Page hue and luminance morph with global activity. Genes sealable via localStorage (demo shows live).

**Not a variation of**: F-020 (discrete FSM agents), F-023 (evolved lattice update rules), F-025 (boids params), F-049 (residual swarm), F-186 (trajectory attention echo). Here the substrate is fixed RD, the mind evolves the *control* parameters of an autopoietic loop, and DOM cells are active embodied agents that both respond to and feed the field.

**Architecture**: Single self-contained HTML. Main thread: RD step + render (ImageData upsample) + cell physics. Blob Worker: pop of 6 genomes, receives fitness ~1 Hz, returns best. CSS variables for morph. No external deps.

**Expected outcome**: Interactive living patterns that adapt parameters to sustain interesting structures; cells chase and seed the field; page breathes with activity. Runnable offline.

**Mechanics**: Pointer → nutrient injection; cells → gradient ascent + click seed; fitness → variance + mean; evolution mutates best.

**Failure modes**: High F/K can extinguish patterns; low resolution blurs; Worker CSP block → static genes; small screens crowd cells.

**Building blocks**: RD control evolution, gradient-driven DOM agents, activity-morph UI, sealed genome transfer for future WebGPU compute version.
