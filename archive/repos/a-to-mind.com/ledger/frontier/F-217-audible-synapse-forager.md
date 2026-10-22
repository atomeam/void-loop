# F-217 — Audible Synapse Forager

Date: 2026-10-21 · Draft: `drafts/F217-audible-synapse-forager/`

## Concept (novel combination)
The audio thread as a brain. A spiking neural network (Izhikevich neurons, reward-modulated STDP with eligibility traces and dopamine) and the tiny world it lives in both run inside an `AudioWorkletProcessor`, so the network's clock is the sound card's 128-sample render quantum and every motor spike is literally the sound you hear, panned to the side it steers. The forager learns to follow smell from random wiring, its synapses are a 1024-cell DOM wall that reshapes as it learns, and the learned synapses persist on the device in the Origin Private File System (OPFS), so the creature you meet tomorrow remembers today. An `OfflineAudioContext` renders the same brain about 150–220 times faster than real time, which doubles as a "dream" training mode and as the headless test rig.

## Why it is not a variation
No earlier draft or ledger entry used `AudioWorklet`, `OfflineAudioContext` as a compute engine, OPFS (`navigator.storage.getDirectory`/`createWritable`), Izhikevich neurons, or STDP; earlier "RNN"/"MLP"/"neural kernel" drafts (F200–F213) used rate-based nets trained by evolution or gradients on the main thread or GPU. F-212 listened through a microphone and F-214 made sound from orientation; here sound is the brain's own output and the audio thread is the computer. Telemetry is carried in extra audio channels, a new way to read state out of a real-time thread without messages.

## Architecture
- `brain-worklet.js`: one file that is the worklet module, a plain script (main-thread fallback with `setInterval`), and a Node module for tuning.
- Network: 32 Poisson inputs (left/right antenna smell contrast) to 32 Izhikevich RS motor neurons (left-turn and right-turn groups), 1024 plastic synapses, 1 ms Euler steps (two half-steps for v). Exploration is sparse random current.
- Learning: pre/post traces (τ 20 ms) build eligibility (τ 200 ms); dopamine is instantaneous smell gain ×40 plus 0.1 per food eaten minus a slow baseline; Δw = 0.01·(DA − baseline)·eligibility, clipped to [0, 6]. Synaptic scaling every 10 ms holds each motor neuron's total input fixed.
- Audio: per block the brain steps `speed` ms; spikes excite decaying partials (left motor 440 Hz left, right motor 660 Hz right, inputs 185 Hz centre, eating 1320 Hz chime), soft-clipped with tanh.
- Host: `state` messages every 6 blocks drive a Canvas2D world and spike/dopamine bars; `weights` every 48 blocks drive the synapse wall and an OPFS save every 10 s. Initial weights go in through `processorOptions` (port messages posted before offline rendering are not applied in time).

## Measured outcome (headless Chrome, `bench-result.json`)
- Offline AudioWorklet, 600 brain-seconds per run, food/s in the first vs last fifth:
  - learning on: seed 1 0.217 → 0.442, seed 2 0.133 → 0.350, seed 3 0.108 → 0.483 (184, 137, 183 food; wiring index 0.97, 0.95, 1.12).
  - learning off (same random wiring): 0.142 → 0.092, 0.133 → 0.083, 0.067 → 0.033 (79, 70, 39 food; wiring index ≈ 0).
  - Speed: 151–158 times real time with learning, 222–225 times without.
- Transfer: seed-1 synapses, frozen, in a new world (seed 9) ate 118 food in 300 s versus 36 for naive wiring.
- Node tuning, 900 s, seeds 1–6: last-fifth food/s 0.459 on average with learning versus 0.098 without; all six seeds improved. A hand-wired "oracle" (same-side 6, cross 0) gets about 0.97 food/s, so the learner reached about half of the ceiling in 15 brain-minutes.
- Live real-time AudioWorklet at speed 60 for 12 s: 249 brain-seconds, 45 food, wiring 0.59; OPFS save and read-back matched byte for byte, and after a reload the worklet restored wiring 0.589 from OPFS.

## Failure modes / knowledge
- Plain R-STDP did not learn at first: dopamine biased positive, so all weights inflated together, and a 1 s eligibility with leaky dopamine drowned the signal. What fixed it: measure the drift E[DA·(elig_same − elig_cross)] with learning off first (it was positive, ratio 0.29 at turn gain 0.004), then use instantaneous dopamine, 200 ms eligibility, a small eating burst, and synaptic scaling. Learning rates of 0.1 and above were noise-dominated and failed.
- Lower turn gain (0.0015) weakened the reward-to-turn correlation (ratio 0.12) and stopped learning; turning has to be large enough to change smell within the eligibility window.
- Port messages posted to an `AudioWorkletNode` before `OfflineAudioContext.startRendering()` were not seen during rendering; pass setup data in `processorOptions`.
- Real-time contexts need a user gesture outside tests (the gate button); headless tests use `--autoplay-policy=no-user-gesture-required`.

## Building blocks for next runs
A real-time, glitch-free brain thread any Void card can host; telemetry over audio channels; offline rendering as a 150× training accelerator; OPFS as permanent per-device creature memory; the measure-the-drift-first method for tuning any reward-modulated learner. Next: let several foragers in separate worklets compete over shared food, train them in dreams overnight, or put the spiking brain behind a board-game opponent so players hear it think.
