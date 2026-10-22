# F-187 WebGPU Spectral Fluid Mind

Runnable prototype: open index.html in a WebGPU-capable browser (Chrome/Edge 113+).

- WebGPU compute grid fluid (velocity + density + vorticity proxy) with orientation and pointer force injection.
- Web Worker evolutionary population optimizes viscosity / forceGain / morphAmp for interaction coherence.
- Floating DOM echo cards are advected by velocity field and morph (scale/rotate/border) with local vorticity.
- Global CSS hue morphs with energy.
- Seal button persists best genes to localStorage.

Not a variation of prior F-020 agents, F-021 orientation density, F-182 spectral NCA, F-184 SPH, or F-186 trajectory attention: fluid continuum + evolutionary parameter mind + advected morphing DOM embodiment.

Failure modes: no WebGPU (Canvas2D notes fallback), orientation denied (pointer only), CSP blocks Worker (static genes).
