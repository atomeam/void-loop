# F-215 — Codec Retina Gardener

Date: 2026-10-21 · Draft: `drafts/F215-codec-retina-gardener/`

## Concept (novel combination)
A video codec used as an eye. A WebGPU Gray-Scott reaction-diffusion world is split into 16 patches, and each patch is fed to its own WebCodecs `VideoEncoder` (VP9, constant quantizer, 64×64, realtime). A delta frame's byte size is exactly what the codec's motion-compensated prediction could not explain, so the hardware encoder becomes a spatial surprise sensor (a "retina"). A gardener agent with per-patch action values steers each patch's feed/kill parameters toward the edge of chaos (a target surprise band), with F-212's device-pressure metabolism setting how many patches it tends per thought. Retina cards are DOM buttons whose radius, scale, skew, letter-spacing and clip-path follow what the codec sees, and each opens a native `popover` with what the gardener has learned there.

## Why it is not a variation
F-210 used deflate (`CompressionStream`) on symbol strings for NCD classification. This run uses a motion-compensating video codec on pixels: it predicts translation, so it tells "moving but foreseeable" apart from "new". No prior draft or ledger entry used `VideoEncoder`/`VideoFrame`, the `popover` API, or a codec as a sensor. Earlier reaction-diffusion work (F021) had no sensor-driven controller of its parameters.

## Architecture
- World: WGSL compute, 256² ping-pong storage buffers, 10 Gray-Scott steps per frame, per-patch (F, k) in a uniform array. CPU fallback at 128² with the same rule.
- Presentation: the field is copied to a `MAP_READ` buffer, coloured on the CPU, and drawn to a 2D canvas. The retina needs CPU pixels anyway, and presenting to a `webgpu` canvas destroyed the device in headless Chrome (see failures). `device.lost` falls back to the CPU world.
- Retina: 16 encoders, a blink on every second readback. Surprise is the EMA of log2(1 + delta bytes). Encoders with `encodeQueueSize > 2` skip a blink. A naive pixel difference runs beside it only to label "flow" (pixels change, codec not surprised).
- Classes: dead (below the band, still), flow (below the band, moving), novel (in the band, 7.2–9.6 bits), noise (above it).
- Gardener: every 6 blinks, attend to the patches furthest from the band (budget from `PressureObserver`, else frame time). Actions are seed, steer 50% toward one of four known regimes (spots, coral, waves, worms), or wait. Action values per patch and per zone (below/in/above) plus shared priors, epsilon 0.2. The reward is the drop in distance to the band 24 blinks later, and a patch is not touched again until its last action is judged. Time is counted in blinks, so slow devices are judged the same as fast ones.

## Measured outcome (headless Chrome, SwiftShader WebGPU, seed 7)
- Codec versus pixel calibration (64×64, 25 delta frames): still 15 B (4.0 bits, pixel diff 0); sliding squares 57 B (5.9 bits, diff 11.6); morphing squares 288 B (8.2 bits, diff 22.4); noise 1896 B (10.9 bits, diff 99.7). Pure translation costs about 2.6× fewer bytes per unit of pixel change than shape change, so the codec does discount predictable motion.
- WebGPU, 60 s each: with the gardener, 15.2 of 16 patches sat in the band over the second half (71 thoughts; seed 20, spots 33, coral 0, waves 2, worms 2, wait 27). Without it, 1.0 of 16 (most patches died).
- Canvas2D fallback, 40 s, gardener on: 12.2 of 16 in band.
- The gardener converged most patches onto the spots regime (F ≈ 0.03–0.06, k ≈ 0.062–0.065) and learned to wait once a patch was in the band.

## Failure modes / knowledge
- In this headless Chrome, configuring a `webgpu` canvas and presenting even a clear-only pass destroyed the device ("Device was destroyed") under every flag set tried, while compute plus `mapAsync` worked. Readback-to-2D presentation is now the safe default for headless-tested GPU drafts. It also means earlier GPU drafts may have been only half-tested headless.
- Drawing a WebGPU canvas into a 2D canvas gave black pixels before the device died, so never feed a codec or CNN from a swapchain in tests.
- WebCodecs is undefined on `about:blank`; tests must load from localhost.
- VP8 does not support `bitrateMode: 'quantizer'` in this Chrome, and VBR or CBR rate control would flatten the byte-size signal. VP9 with a fixed quantizer is required, and VP8 VBR is only a weak fallback.
- Wall-clock reward timing failed on the slow headless GPU (the first version improved only 3.3 versus 3.1 patches), because seeding gives a short bump that fades. Blink-counted delays and regime-steering actions fixed it.
- Retina blinks are about 4–8 per second on SwiftShader, so the band thresholds are tuned to a 64×64 VP9 encoder at q34. Other sizes need recalibration (`?lo=&hi=`).

## Building blocks for next runs
`initRetina()` and `retinaLook()` make any canvas region into a surprise sensor driven by hardware motion prediction. It can attend over a 3D scene, rank candidate futures by how unpredictable they look (an extension of F-212's listening ear to a seeing one), or flag laggy or choppy board-game frames, since dropped or janky frames show up as delta-size spikes. The blink-clocked bandit is a reusable controller for any slow or variable-rate sensor.
