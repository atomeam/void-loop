# F-048 Resonant Spatial Audio Mind

**Ledger ID:** F-048 (frontier series)

## Concept
Novel combination of a Canvas2D spatial particle field, a local Web Worker evolutionary policy mind that controls a multi-oscillator Web Audio synthesizer (frequency, stereo pan, gain, and detune from local density and pointer proximity), real-time AnalyserNode spectrum feedback that injects resonant forces back into the particle velocities, and CSS morphing of the Void chrome driven by a harmonic resonance metric. Pointer interaction seeds particles and supplies corrective fitness that rewards policies producing coherent, low-dissonance soundscapes. Seal persists the best genome to localStorage.

Not a superficial variation of prior experiments:
- Not F-042 predictive audio particles (here the mind *generates* the audio from spatial state; spectrum residual closes the loop as force, not just residual visualization)
- Not F-037 resonant voice lattice or pure spectral fields
- Not F-021/F-047 attention or density observers without generative audio policy
- Not volumetric or NCA substrate controllers
The core is an evolutionary search over a spatial-to-audio policy whose sonic harmony becomes the fitness signal that reshapes both the particles and the surrounding interface.

## Architecture
Single self-contained `index.html`.
- Main thread: 180 particles with velocity damping; pointer seeds density; samples local density around each particle; sends summary features to Worker; receives policy parameters; drives 4 OscillatorNodes + GainNodes + StereoPannerNodes; AnalyserNode (fftSize 256) extracts 8-bin spectrum; residual between expected harmonic peaks and actual spectrum adds force to nearby particles; applies CSS custom properties for hue/blur/scale from resonance score; handles seal.
- Blob Worker: population of 6 genomes (each a small MLP-like vector of 12 weights mapping 6 features → 8 audio params); evaluates fitness from reported resonance + pointer proximity + spectral coherence; mutates and returns best ~1 Hz.
- Fallbacks: no Web Audio / gesture required → silent visual field; no Worker → fixed harmonic policy; Analyser blocked → density-only forces.

## Expected outcome
Particles that stream and cluster into structures whose density the local mind translates into evolving harmonic tones; spectrum analysis pulls particles toward resonant regions; page chrome warps chromatically and with blur as resonance rises; sealed genomes remember policies that produce pleasing spatial-audio coherence. Fully offline-runnable after a user gesture to start audio.

## Mechanics
- Particles: position/velocity; force = damping + mild repulsion + spectrum-residual attraction scaled by bin energy.
- Policy features: mean density, pointer density, particle count near center, recent velocity variance, current resonance, time phase.
- Audio: 4 oscillators (base freq from policy, harmonics 1x/2x/3x/5x), gain and pan from policy outputs, detune for richness.
- Resonance score: inverse of spectral flatness + peak concentration (higher = more harmonic).
- Evolution ~1 Hz; morph 0–1 from resonance drives hue-rotate, filter, transform.
- Seal: truncated SHA-256 of best weights + resonance + timestamp → localStorage.

## Failure modes
AudioContext suspended until gesture; Worker CSP block → static policy, still visual+audio if started; low-end devices → drop particle count to 80; spectrum analysis may be silent if no oscillators connected.

## Building block for future
True WebGPU compute for particle forces + spectral texture feedback; WebXR hand-tracked spatialization with HRTF; multi-mind competition on different harmonic series; sealed genome breeding across sessions; local tiny RNN for temporal audio policy.

## V01D landing
Spatial stage skill (`skills/mini/resonant-spatial-audio-mind.js`); testable via `tools/resonant-spatial-audio-mind.test.mjs` for density→policy param and spectrum-residual→particle-force mapping.
