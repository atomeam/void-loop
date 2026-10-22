# F-212 — Resonant Imagination

Date: 2026-10-21 · Draft: `drafts/F212-resonant-imagination/`

## Concept (novel combination)
An agent that imagines the future as sound. Each candidate action is rendered offline in an `OfflineAudioContext` (oscillators plus a small feedback delay network), and the agent "listens" to every rendered future and keeps the one with the least beating. That audio-engine imagination is paired with a thinking budget driven by the device's real CPU load through the Compute Pressure API (`PressureObserver`), a 3D world of 28 resonator stars on a rotating sphere, and HUD cards whose weight, letter-spacing, skew and corner radius physically follow the world's dissonance.

## Why it is not a variation
Earlier Frontier runs reasoned with MLPs, RNNs, attention, genomes, NCA, SPH or compression (F-210). None used the Web Audio render graph as a compute and simulation substrate, and none tied how much the agent thinks to real device pressure. The ledger and drafts had no prior use of `OfflineAudioContext`, `PressureObserver` or a feedback delay network.

## Architecture
- World: 28 nodes on a Fibonacci sphere, each with a pitch; 3 nearest neighbours form each node's cluster. Edges are coloured and wobble by analytic Plomp–Levelt roughness. Clicking a star detunes it; `d` or Scatter detunes six at random.
- Attention: every 450 ms, take the roughest cluster.
- Imagination: render the current pitch plus up to `budget` candidate retunings (just-intonation ratios over 110 Hz). Each render is 0.3 s mono at 8 kHz through a 13 ms delay, a lowpass and 0.45 feedback. The judgement is the coefficient of variation of a 10 ms amplitude envelope over the last 75%, which is beating as heard. The lowest wins, and the current pitch is kept if nothing beats it.
- Metabolism: Compute Pressure states map to futures per thought (nominal 10, fair 6, serious 3, critical 1). Without the API, the budget adapts to how long imagination took (>120 ms shrinks it, <40 ms grows it).
- UI: global harmony sets the CSS variables `--d/--w/--ls/--r`, so the cards turn heavy, skewed and sharp-cornered under dissonance and light and round when the sphere is consonant. The Listen button plays the live chord quietly.

## Measured outcome (headless Chrome, virtual time)
- Ear calibration (envelope CV): unison 0.033, octave 0.052, fifth 0.054; a 6 Hz beat 0.550, a semitone 0.480, a 15 Hz beat 0.454. Beating and consonant intervals separate by about 10x.
- Full run, 14 s: 31 thoughts, 10 retunings; global harmony went from 72.4% to 90.5%.
- Agreement with the analytic Plomp–Levelt choice: only 4 of 31 (13%).

## Failure modes / knowledge
- The ear only hears beating. Among already-consonant candidates (octave, fifth, fourth) the CVs are all about 0.03–0.06, so its choice is close to random there, while Plomp–Levelt still ranks them. That explains the low agreement even though harmony rises. Next time, add a second spectral feature (an AnalyserNode-free FFT on the rendered buffer, or the period of the autocorrelation) to rank consonances.
- Envelope windows shorter than the beat period miss slow beats, and 10 ms smooths out the fundamental of low fifths, which is intentional.
- `PressureObserver` is Chromium-only and needs a secure context; the frame-time fallback is required everywhere else.
- Many tiny OfflineAudioContexts in `Promise.all` are cheap at 8 kHz (a whole thought took tens of ms in headless).

## Building blocks for next runs
`imagine()` is a reusable "simulate it as sound and listen" primitive: any candidate set that can be expressed as signal parameters can be ranked by the audio thread off the main thread. The pressure-to-budget map is a reusable metabolism for any Void mind, so it thinks less on a struggling phone (relevant to the board-game lag work).
